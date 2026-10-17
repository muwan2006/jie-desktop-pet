"""Local KWS and one wake-gated utterance. Audio stays in RAM; pause closes the mic."""
import importlib.util
import json
import os
import queue
import sys
import threading
import time
from collections import deque
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
sys.stdin.reconfigure(encoding='utf-8')
ROOT=Path(__file__).parent
def emit(kind,**values): print(json.dumps(dict(type=kind,**values),ensure_ascii=False),flush=True)
def load(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/file)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
def spotter(config):
    sys.path.insert(0,str(ROOT/'asr-runtime/fast/vendor'))
    dll=os.add_dll_directory(str(ROOT/'asr-runtime/fast/vendor/sherpa_onnx/lib')) if hasattr(os,'add_dll_directory') else None
    import sherpa_onnx
    model=ROOT/'wake-model'
    phrase='greeting.txt' if config.get('phrase')=='你好小小颉' else 'name.txt'
    keywords=str(model/phrase)
    if '--test-wav' in sys.argv and config.get('testKeywords'):keywords=config['testKeywords']
    threshold={'low':.4,'normal':.25,'high':.15}.get(config.get('sensitivity'),.25)
    kws=sherpa_onnx.KeywordSpotter(tokens=str(model/'tokens.txt'),encoder=str(model/'encoder.onnx'),decoder=str(model/'decoder.onnx'),joiner=str(model/'joiner.onnx'),keywords_file=keywords,num_threads=1,keywords_score=1.5,keywords_threshold=threshold,num_trailing_blanks=1,provider='cpu')
    return kws,dll
def test_wave(config,files):
    import wave
    import numpy as np
    kws,dll=spotter(config)
    for file in files:
        stream=kws.create_stream()
        with wave.open(file,'rb') as w:
            if w.getnchannels()!=1 or w.getsampwidth()!=2:raise ValueError('PCM16 mono required')
            rate=w.getframerate();audio=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype('float32')/32768
        found=[];started=time.monotonic()
        for i in range(0,len(audio),int(rate/10)):
            stream.accept_waveform(rate,audio[i:i+int(rate/10)])
            while kws.is_ready(stream):
                kws.decode_stream(stream);word=kws.get_result(stream)
                if word:found.append(word);kws.reset_stream(stream)
        stream.accept_waveform(rate,np.zeros(rate,dtype='float32'))
        while kws.is_ready(stream):
            kws.decode_stream(stream);word=kws.get_result(stream)
            if word:found.append(word);kws.reset_stream(stream)
        emit('test',file=Path(file).name,keywords=found,seconds=time.monotonic()-started,audioSeconds=len(audio)/rate)
    emit('done')
def main():
    # Imported speech helpers configure stdin too: load them before its first read.
    if '--test-wav' not in sys.argv:
        local=load('wake_local','speech-local.py');fast=load('wake_fast','speech-fast.py');endpoint_module=load('wake_endpoint','speech-call.py')
    config=json.loads(sys.stdin.readline())
    if '--test-wav' in sys.argv:
        test_wave(config,sys.argv[sys.argv.index('--test-wav')+1:]);return
    import numpy as np
    import sounddevice as sd
    from faster_whisper.vad import get_vad_model
    emit('loading',message='正在准备本地关键词与语音识别……')
    kws,dll=spotter(config);model=fast.FastAsr(ROOT/'asr-runtime','zh-CN');vad=get_vad_model()
    devices=local.devices(sd);chosen=next((d for d in devices if d['id']==config.get('device')),None)
    if config.get('device') and not chosen:raise RuntimeError('选中的麦克风已断开，请重新选择收音设备。')
    if not config.get('device'):
        usb=[d for d in devices if d['host']=='Windows WASAPI' and 'USB' in d['name'].upper()]
        if len(usb)==1:chosen=usb[0]
    index=chosen['index'] if chosen else None;info=sd.query_devices(index,'input');rate=int(info['default_samplerate'])
    commands=queue.Queue()
    def reader():
        for s in sys.stdin:commands.put(s.strip())
        commands.put('cancel')
    threading.Thread(target=reader,daemon=True).start();mode='wake'
    while True:
        if mode=='paused':
            cmd=commands.get()
            if cmd=='cancel':return
            if cmd not in ('wake','command'):continue
            mode=cmd
        blocks=queue.Queue(maxsize=30)
        def callback(audio,frames,timing,status):
            try:blocks.put_nowait(audio[:,0].copy())
            except queue.Full:pass
        stream=kws.create_stream();pre=deque(maxlen=12);window=deque(maxlen=8);parts=[];endpoint=endpoint_module.Endpoint(.75);deadline=time.monotonic()+8 if mode=='command' else 0;turn=False
        with sd.InputStream(device=index,samplerate=rate,channels=1,dtype='float32',blocksize=int(rate/10),callback=callback):
            emit('ready',device=info['name'],mode=mode)
            while True:
                try:
                    cmd=commands.get_nowait()
                    if cmd=='cancel':return
                    if cmd=='pause':mode='paused';emit('paused');break
                    if cmd in ('wake','command'):
                        mode=cmd;parts=[];pre.clear();window.clear();endpoint=endpoint_module.Endpoint(.75);stream=kws.create_stream();deadline=time.monotonic()+8 if cmd=='command' else 0
                except queue.Empty:pass
                try:block=blocks.get(timeout=.1)
                except queue.Empty:continue
                now=time.monotonic();pre.append(block);window.append(block)
                if mode=='wake':
                    stream.accept_waveform(rate,block)
                    word=''
                    while kws.is_ready(stream):
                        kws.decode_stream(stream);word=kws.get_result(stream)
                        if word:break
                    if not word:continue
                    kws.reset_stream(stream);mode='command';deadline=now+8;parts=list(pre);endpoint.started=True;endpoint.seen=2;endpoint.last=now;emit('wake',keyword=word,at=int(time.time()*1000));continue
                raw=np.concatenate(window);sampled=np.interp(np.arange(0,len(raw),rate/16000),np.arange(len(raw)),raw).astype('float32');rms=float(np.sqrt(np.mean(block**2)))
                prob=float(np.mean(vad(np.pad(sampled,(0,(-len(sampled))%512)))[-3:])) if rms>.0004 else 0
                began,ended=endpoint.update(prob,now)
                if began:parts=list(pre)
                elif endpoint.started:parts.append(block)
                if ended or endpoint.started and sum(len(p) for p in parts)/rate>=20:turn=True;break
                if now>=deadline and not endpoint.started:mode='wake';parts=[];stream=kws.create_stream();emit('expired')
        if mode=='paused':continue
        if turn:
            finals=[]
            def collect(kind,**value):
                if kind=='final':finals.append(value['text'])
            model.transcribe(np.concatenate(parts),rate,{'language':'zh-CN'},collect)
            emit('text',text=''.join(finals),at=int(time.time()*1000))
            # Host explicitly chooses whether to listen for the command or wait for a new name.
            mode='paused'
if __name__=='__main__':
    try:main()
    except Exception as exc:emit('error',message='本地唤醒：'+str(exc)[:400]);sys.exit(1)
