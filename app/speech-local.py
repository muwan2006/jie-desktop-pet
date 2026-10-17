"""Explicit, in-memory recording and offline ASR. Never listens in probe mode."""
import argparse
import json
import math
import queue
import sys
import threading
import time
import wave
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
sys.stdin.reconfigure(encoding='utf-8')

def emit(kind, **values):
    print(json.dumps(dict(type=kind, **values), ensure_ascii=False), flush=True)

def devices(sd):
    apis = sd.query_hostapis()
    result = []
    default = int(sd.default.device[0])
    all_devices = sd.query_devices()
    default_name = all_devices[default]['name'] if default >= 0 else ''
    for index, device in enumerate(all_devices):
        api = apis[device['hostapi']]['name']
        if device['max_input_channels'] < 1 or api not in ('Windows WASAPI', 'MME'):
            continue
        name = device['name']
        # The generic MME mapping adds no useful choice and changes with Windows defaults.
        if api == 'MME' and (index == apis[device['hostapi']]['default_input_device']
                            or '声音映射器' in name or 'Sound Mapper' in name):
            continue
        result.append(dict(id=api+':'+name, name=name, host=api, index=index,
                           default=name == default_name))
    return result

def transcribe(audio, sample_rate, config, runtime, model=None, fast=False):
    import numpy as np
    if not len(audio) or len(audio) / sample_rate < .25:
        emit('diagnostic', message='说话时间太短，请看到“正在听”后再开始说话。')
        return
    if float(np.max(np.abs(audio))) < .002 or float(np.sqrt(np.mean(audio ** 2))) < .0004:
        emit('diagnostic', message='没有收到足够清晰的声音。请检查收音设备、麦克风音量和 Windows 麦克风权限。')
        return
    emit('processing', message='正在本机识别你说的话……')
    from faster_whisper import WhisperModel
    from opencc import OpenCC
    if model is None:
        model = WhisperModel(str(runtime/'model'), device='cpu', compute_type='int8',
                             cpu_threads=4, local_files_only=True)
    # Pass normalized samples directly: no temporary recordings or media decoder API dependency.
    import av
    pcm = (np.clip(audio, -1, 1)*32767).astype('<i2')
    frame = av.AudioFrame.from_ndarray(pcm.reshape(1, -1), format='s16', layout='mono')
    frame.sample_rate = sample_rate
    resampler = av.AudioResampler(format='flt', layout='mono', rate=16000)
    frames = resampler.resample(frame) + resampler.resample(None)
    samples = np.concatenate([f.to_ndarray().reshape(-1) for f in frames])
    language = {'zh-CN': 'zh', 'en-US': 'en', 'ja-JP': 'ja'}[config['language']]
    segments, _ = model.transcribe(samples, language=language, beam_size=1 if fast else 5,
        vad_filter=True, vad_parameters=dict(min_silence_duration_ms=500, speech_pad_ms=250),
        initial_prompt=('中文普通话。Edge 浏览器，谷歌浏览器，微软，打开，即梦，哔哩哔哩，B站，颉，豆包。'+ '，'.join(str(w)[:40] for w in config.get('words', [])[:100]))[:1200]
                       if language == 'zh' else None,
        condition_on_previous_text=False, hallucination_silence_threshold=1.5)
    converter = OpenCC('t2s') if language == 'zh' else None
    for segment in segments:
        if segment.no_speech_prob > .6 or segment.avg_logprob < -1.25:
            continue
        text = segment.text.strip()
        if converter:
            text = converter.convert(text)
        # This is a quality heuristic, not a calibrated probability of correctness.
        confidence = min(.95, math.exp(segment.avg_logprob) * (1 - segment.no_speech_prob))
        if text:
            emit('final', text=text, confidence=confidence, start=float(segment.start), end=float(segment.end))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--probe', action='store_true')
    parser.add_argument('--wav')
    args = parser.parse_args()
    import numpy as np
    import sounddevice as sd
    runtime = Path(__file__).parent/'asr-runtime'
    if args.probe:
        emit('devices', devices=devices(sd), engine='local', modelReady=(runtime/'model/model.bin').is_file())
        return
    config = json.loads(sys.stdin.readline())
    if config.get('language') not in ('zh-CN', 'en-US', 'ja-JP'):
        raise ValueError('识别语言无效。')
    if not (runtime/'model/model.bin').is_file():
        raise RuntimeError('本机识别模型不完整，请重新安装语音识别修复包。')
    if args.wav:
        with wave.open(args.wav, 'rb') as source:
            if source.getnchannels() != 1 or source.getsampwidth() != 2:
                raise ValueError('Test audio must be PCM16 mono')
            rate = source.getframerate()
            audio = np.frombuffer(source.readframes(source.getnframes()), dtype='<i2').astype('float32') / 32768
        transcribe(audio, rate, config, runtime)
        emit('done')
        return
    available = devices(sd)
    device_id = config.get('device', '')
    chosen = next((d for d in available if d['id'] == device_id), None)
    if device_id and chosen is None:
        raise RuntimeError('选中的麦克风已断开，请刷新收音设备并重新选择。')
    index = chosen['index'] if chosen else None
    info = sd.query_devices(index, 'input')
    rate = int(info['default_samplerate'])
    # Read commands before importing/loading the ASR model. A quick release must stop recording.
    commands = queue.Queue()
    def read_commands():
        for line in sys.stdin:
            commands.put(line.strip())
        commands.put('cancel')
    threading.Thread(target=read_commands, daemon=True).start()
    if not commands.empty():
        emit('diagnostic', message='麦克风还没准备好就结束了，请等“正在听”后说话。')
        emit('done')
        return
    blocks = queue.Queue(maxsize=2000)
    overflows = []
    def on_audio(indata, frames, timing, status):
        if status:
            overflows.append(str(status))
        try:
            blocks.put_nowait(indata[:, 0].copy())
        except queue.Full:
            overflows.append('buffer full')
    audio_parts = []
    started = time.monotonic()
    last_meter = 0
    peak = 0
    stopped = False
    speech_seen = 0
    silence_frames = 0
    endpoint = config.get('endpoint') is True
    noise = .0004
    with sd.InputStream(device=index, samplerate=rate, channels=1, dtype='float32',
                        blocksize=int(rate/10), callback=on_audio):
        emit('ready', engine='local', device=info['name'])
        while time.monotonic() - started < 60:
            try:
                command = commands.get_nowait()
                if command != 'stop':
                    emit('canceled')
                    return
                stopped = True
                break
            except queue.Empty:
                pass
            try:
                data = blocks.get(timeout=.1)
            except queue.Empty:
                continue
            audio_parts.append(data)
            rms = float(np.sqrt(np.mean(data ** 2)))
            peak = max(peak, float(np.max(np.abs(data))))
            if endpoint:
                # Endpoint only in the explicitly enabled continuous session. Never stores recordings.
                threshold = max(.0015, min(.008, noise * 3.5))
                if rms > threshold:
                    speech_seen += 1
                    silence_frames = 0
                else:
                    silence_frames += 1
                    if speech_seen == 0: noise = noise * .95 + rms * .05
                if speech_seen >= 4 and silence_frames >= 12:
                    stopped = True
                    break
                if speech_seen == 0 and time.monotonic() - started > 15:
                    emit('diagnostic', message='没有听到后续说话，已关闭麦克风。')
                    emit('done')
                    return
            if time.monotonic() - last_meter > .25:
                last_meter = time.monotonic()
                emit('level', level=min(100, int(rms*1500)), peak=peak,
                     quiet=last_meter-started > 3 and peak < .002)
        while not blocks.empty():
            audio_parts.append(blocks.get_nowait())
    if overflows:
        emit('diagnostic', message='收音出现丢帧；可换一个麦克风或关闭占用声音设备的程序。')
    audio = np.concatenate(audio_parts) if audio_parts else np.array([], dtype='float32')
    transcribe(audio, rate, config, runtime)
    emit('done', limited=not stopped)

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        emit('error', message='本机语音识别：'+str(exc)[:400])
        sys.exit(1)
