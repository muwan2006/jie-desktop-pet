"""Bounded QQ video frames and speech; never opens a microphone or runs media instructions."""
import sys,json,base64,io,importlib.util,contextlib
from pathlib import Path
from fractions import Fraction
sys.stdout.reconfigure(encoding='utf-8');sys.stdin.reconfigure(encoding='utf-8')
def extract(file,config):
 import av,numpy as np
 file=Path(file)
 if not file.is_file() or not 0<file.stat().st_size<=64*1024*1024:raise ValueError('QQ短视频为空或超过64MB。')
 frames=[];start=max(0,min(7200,float(config.get('start',0))))
 with av.open(str(file)) as source:
  if not source.streams.video:raise ValueError('文件没有视频画面。')
  stream=source.streams.video[0]
  duration=float(source.duration or 0)/av.time_base or float(stream.duration or 0)*float(stream.time_base)
  if duration<=0 or start>=duration:raise ValueError('视频时长无法取得，或起始位置超过视频长度。')
  end=min(duration,start+60);times=[start+(end-start)*fraction for fraction in ((.45,) if config.get('frameCount')==1 else (0,.32,.65,.94))]
  for at in times:
   source.seek(int(at*av.time_base),backward=True)
   count=0
   for frame in source.decode(stream):
    count+=1
    if count>600:raise ValueError('视频关键帧读取超出限制。')
    actual=float(frame.pts or 0)*float(stream.time_base)
    if actual+.08<at:continue
    if frame.width*frame.height>32*1024*1024:raise ValueError('视频分辨率过大。')
    ratio=min(1,720/max(frame.width,frame.height));width=max(1,round(frame.width*ratio));height=max(1,round(frame.height*ratio))
    image=frame.reformat(width=width,height=height,format='rgb24');image.pts=0;image.time_base=Fraction(1,1)
    codec=av.CodecContext.create('png','w');codec.width=width;codec.height=height;codec.pix_fmt='rgb24';codec.time_base=Fraction(1,1)
    png=b''.join(bytes(packet) for packet in codec.encode(image))
    if not png or len(png)>1000000:raise ValueError('视频帧过大或无法编码。')
    frames.append(dict(at=round(actual,2),png=base64.b64encode(png).decode('ascii')));break
  if not frames:raise ValueError('没有取得有效视频帧。')
 subtitles=[];transcript='';audio_status='没有音轨'
 with av.open(str(file)) as source:
  if source.streams.audio:
   source.seek(int(start*av.time_base),backward=True);track=source.streams.audio[0];resampler=av.AudioResampler(format='flt',layout='mono',rate=16000);audio=[];samples=0
   for frame in source.decode(track):
    at=float(frame.pts or 0)*float(track.time_base)
    if at>=end:break
    for converted in resampler.resample(frame):
     array=converted.to_ndarray().reshape(-1)
     if at<start:array=array[min(len(array),max(0,int((start-at)*16000))):]
     array=array[:max(0,60*16000-samples)];samples+=len(array)
     if len(array):audio.append(array)
    if samples>=60*16000:break
   audio_status='音轨没有可识别的人声'
   if audio:
    try:
     spec=importlib.util.spec_from_file_location('qq_video_speech',Path(__file__).with_name('speech-local.py'));speech=importlib.util.module_from_spec(spec);spec.loader.exec_module(speech)
     records=[];speech.emit=lambda kind,**data:records.append(dict(type=kind,**data))
     with contextlib.redirect_stdout(io.StringIO()):speech.transcribe(np.concatenate(audio),16000,config,Path(__file__).parent/'asr-runtime')
     transcript='，'.join(str(v.get('text','')) for v in records if v.get('type')=='final' and float(v.get('confidence',0))>=.1)[:5000]
     subtitles=[dict(start=round(start+float(v['start']),3),end=round(min(end,start+float(v['end'])),3),text=str(v.get('text',''))[:500]) for v in records if v.get('type')=='final' and float(v.get('confidence',0))>=.1 and isinstance(v.get('start'),(int,float)) and isinstance(v.get('end'),(int,float)) and v['end']>v['start']]
     audio_status='已转写人声，可能有识别误差' if transcript else '音轨没有听清人声；不猜测声音内容'
    except Exception:audio_status='画面已读取，音轨转写未完成；不猜测声音内容'
 return dict(frames=frames,duration=round(duration,2),start=start,end=round(end,2),truncated=start>0 or end<duration,transcript=transcript,audioStatus=audio_status,subtitles=subtitles)
def extract_many(file,config):
 if not config.get('full'):return extract(file,config)
 config={**config,'frameCount':1};parts=[];start=float(config.get('start',0))
 for _ in range(4):
  part=extract(file,{**config,'start':start});parts.append(part);start=part['end']
  if start>=part['duration']:break
 return dict(frames=[f for p in parts for f in p['frames']],duration=parts[0]['duration'],start=parts[0]['start'],end=parts[-1]['end'],truncated=parts[0]['start']>0 or parts[-1]['end']<parts[0]['duration'],transcript='\n'.join(str(p['start'])+'—'+str(p['end'])+'秒：'+p['transcript'] for p in parts)[:5000],audioStatus='已按实际时间段读取；人声以分段转写为准',subtitles=[s for p in parts for s in p['subtitles']],segments=[{**p,'frameTimes':[f['at'] for f in p['frames']],'frames':None} for p in parts])
if __name__=='__main__':
 try:print(json.dumps(extract_many(sys.argv[1],json.loads(sys.stdin.readline())),ensure_ascii=False),flush=True)
 except Exception as e:print(json.dumps({'error':str(e)[:200]},ensure_ascii=False),flush=True);sys.exit(1)
