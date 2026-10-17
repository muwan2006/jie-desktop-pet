"""Transcribe explicitly received QQ audio. No microphone is opened."""
import sys,json,importlib.util
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
sys.stdin.reconfigure(encoding='utf-8')
try:
 import av,numpy as np
 config=json.loads(sys.stdin.readline());file=Path(sys.argv[1])
 if not file.is_file() or file.stat().st_size>16000000:raise ValueError('QQ语音文件为空或过大。')
 spec=importlib.util.spec_from_file_location('qq_speech',Path(__file__).with_name('speech-local.py'));speech=importlib.util.module_from_spec(spec);spec.loader.exec_module(speech)
 frames=[];samples=0
 with av.open(str(file)) as source:
  track=source.streams.audio[0];resampler=av.AudioResampler(format='flt',layout='mono',rate=16000)
  for frame in source.decode(track):
   for converted in resampler.resample(frame):
    audio=converted.to_ndarray().reshape(-1);samples+=len(audio)
    if samples>16000*120:raise ValueError('QQ语音超过两分钟，请分几条发送。')
    frames.append(audio)
  for converted in resampler.resample(None):frames.append(converted.to_ndarray().reshape(-1))
 if not frames:raise ValueError('QQ语音没有可识别的声音。')
 speech.transcribe(np.concatenate(frames),16000,config,Path(__file__).parent/'asr-runtime');speech.emit('done')
except Exception as e:
 print(json.dumps(dict(type='error',message=str(e)[:300]),ensure_ascii=False),flush=True);sys.exit(1)
