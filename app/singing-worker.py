"""Own-process audio stages. Dependencies and models live outside the desktop pet."""
import argparse,json,sys,os
from pathlib import Path
import numpy as np

def read_audio(file,limit=900):
 import av
 with av.open(str(file)) as container:
  stream=container.streams.audio[0]
  resampler=av.AudioResampler(format='fltp',layout='stereo',rate=44100)
  blocks=[];samples=0
  for frame in container.decode(stream):
   for converted in resampler.resample(frame):
    block=converted.to_ndarray();samples+=block.shape[1]
    if samples>limit*44100:raise ValueError('歌曲时长超过15分钟')
    blocks.append(block)
  for converted in resampler.resample(None):blocks.append(converted.to_ndarray())
  if not blocks:raise ValueError('音源没有可读取的声音')
  return np.concatenate(blocks,axis=1)

def split(job):
 import torch,soundfile as sf
 from demucs.pretrained import get_model
 from demucs.apply import apply_model
 audio=read_audio(job/'source.audio')
 request=json.loads((job/'job.json').read_text(encoding='utf-8'))
 start=max(0,float(request.get('start',0)));seconds=float(request.get('seconds',0))
 if start:audio=audio[:,round(start*44100):]
 if seconds:audio=audio[:,:round(seconds*44100)]
 if audio.shape[1]<44100:raise ValueError('所选片段太短')
 model=get_model('htdemucs');model.eval()
 device='cuda' if torch.cuda.is_available() and torch.cuda.mem_get_info()[0]>2600*1024**2 else 'cpu'
 wave=torch.from_numpy(audio);ref=wave.mean(0);std=ref.std().clamp(min=1e-6);wave=(wave-ref.mean())/std
 with torch.inference_mode():stems=apply_model(model,wave[None],device=device,shifts=0,split=True,overlap=.25,progress=True,num_workers=0)[0].cpu()*std+ref.mean()
 index=model.sources.index('vocals');vocals=stems[index];instrumental=stems.sum(0)-vocals
 sf.write(str(job/'vocals.wav'),vocals.numpy().T,44100,subtype='PCM_16')
 sf.write(str(job/'instrumental.wav'),instrumental.numpy().T,44100,subtype='PCM_16')
 print(json.dumps({'stage':'split','device':device,'seconds':audio.shape[1]/44100}),flush=True)

def mix(job):
 import soundfile as sf
 converted=list((job/'converted').glob('*.wav'))
 if len(converted)!=1:raise ValueError('没有找到唯一的歌声转换结果')
 voice,rate=sf.read(str(converted[0]),always_2d=True,dtype='float32');back,back_rate=sf.read(str(job/'instrumental.wav'),always_2d=True,dtype='float32')
 if rate!=44100 or back_rate!=rate:raise ValueError('转换后的采样率不匹配')
 if abs(len(voice)-len(back))>rate*.5:raise ValueError('歌声和伴奏长度不匹配，未自动混音')
 voice=np.pad(voice,((0,max(0,len(back)-len(voice))),(0,0)))[:len(back)]
 mixed=back*.8+voice*.95;peak=float(np.abs(mixed).max());mixed*=min(1,.97/max(1e-9,peak))
 sf.write(str(job/'cover.wav'),mixed,rate,subtype='PCM_16')
 print(json.dumps({'stage':'ready','seconds':len(mixed)/rate,'peak':float(np.abs(mixed).max())}),flush=True)

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--stage',choices=['split','mix'],required=True);parser.add_argument('--job',required=True);args=parser.parse_args()
 try:globals()[args.stage](Path(args.job).resolve())
 except Exception as e:print(str(e),file=sys.stderr,flush=True);sys.exit(1)
