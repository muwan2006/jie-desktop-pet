"""Prepare ordinary, bounded WAV voice messages from the real finished cover."""
from pathlib import Path
import argparse,json,hashlib,os
import numpy as np
import soundfile as sf
import librosa
parser=argparse.ArgumentParser()
parser.add_argument('--source',required=True)
parser.add_argument('--output',required=True)
args=parser.parse_args()
source,output=Path(args.source).resolve(),Path(args.output).resolve()
info=sf.info(source)
if not 1<=info.duration<=901:raise ValueError('歌曲时长不适合发送。')
audio,rate=sf.read(source,dtype='float32',always_2d=True)
audio=librosa.resample(audio.mean(axis=1),orig_sr=rate,target_sr=24000)
if not np.isfinite(audio).all():raise ValueError('歌曲音频有无效采样。')
output.mkdir(parents=True,exist_ok=True)
parts=[]
start=0
while start<len(audio):
    end=min(len(audio),start+55*24000)
    if end<len(audio):
        # Choose a relatively quiet join near 55 seconds. This is our
        # compatibility policy, not a claim about a universal QQ limit.
        low=start+50*24000
        candidates=np.arange(low,end,480,dtype=np.int64)
        scores=[float(np.mean(audio[max(start,i-2400):min(len(audio),i+2400)]**2)) for i in candidates]
        end=int(candidates[int(np.argmin(scores))])
    part=audio[start:end]
    name=f'voice-{len(parts)+1:02d}.wav'
    file=output/name
    temp=file.with_suffix('.wav.part')
    sf.write(temp,part,24000,format='WAV',subtype='PCM_16')
    os.replace(temp,file)
    parts.append(dict(name=name,seconds=len(part)/24000,bytes=file.stat().st_size,
        sha256=hashlib.sha256(file.read_bytes()).hexdigest()))
    start=end
if not 1<=len(parts)<=20:raise ValueError('语音分段数异常。')
print(json.dumps(dict(ok=True,sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    duration=len(audio)/24000,sampleRate=24000,parts=parts)),flush=True)
