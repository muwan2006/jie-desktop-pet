"""Resolve a public Bilibili/Douyin video into bounded, time-stamped observations."""
import sys,json,socket,ipaddress,importlib.util,re,urllib.request,heapq,math
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8');sys.stdin.reconfigure(encoding='utf-8')
APP=Path(__file__).resolve().parent
sys.path.insert(0,str(APP))
sys.path.insert(0,str(APP/'media-ytdlp.whl'))
sys.path.insert(0,str(APP/'asr-runtime/vendor'))
MAX=64*1024*1024

def guard_network():
 original=socket.getaddrinfo
 def public_addresses(host,*args,**kwargs):
  records=original(host,*args,**kwargs)
  if any(not ipaddress.ip_address(row[4][0].split('%')[0]).is_global for row in records):
   raise ValueError('视频服务返回非公网地址，读取已停止。')
  return records
 socket.getaddrinfo=public_addresses

def read(config):
 from urllib.parse import urlparse
 u=urlparse(config['url'])
 if u.scheme not in ('http','https') or u.hostname not in ('www.bilibili.com','bilibili.com','m.bilibili.com','b23.tv','www.b23.tv','douyin.com','www.douyin.com','v.douyin.com','iesdouyin.com','www.iesdouyin.com'):
  raise ValueError('只支持B站、抖音的视频链接。')
 root=Path(config['workspace']).resolve()
 root.mkdir(parents=True,exist_ok=True)
 guard_network()
 import yt_dlp
 class Quiet:
  def debug(self,*args):pass
  def info(self,*args):pass
  def warning(self,*args):pass
  def error(self,*args):pass
 def progress(v):
  if int(v.get('downloaded_bytes') or 0)>MAX:raise ValueError('视频超过64MB，请改发较短视频或压缩后的文件。')
 options={'quiet':True,'no_warnings':True,'logger':Quiet(),'noprogress':True,'noplaylist':True,'playlistend':1,
  'format':'best[height<=480]/bestvideo[height<=480][vcodec^=avc]/worstvideo',
  'outtmpl':str(root/'source.%(ext)s'),'max_filesize':MAX,'socket_timeout':20,'retries':1,'fragment_retries':1,
  'progress_hooks':[progress],'enable_file_urls':False,'plugin_dirs':[],'cachedir':False,'overwrites':True,'continuedl':False,
  'proxy':'','geo_bypass':False,'writesubtitles':False}
 # Credentials are a temporary owner-provided, platform-filtered Netscape file.
 if config.get('cookie'):options['cookiefile']=config['cookie']
 with yt_dlp.YoutubeDL(options) as downloader:
  info=downloader.extract_info(config['url'],download=True)
  if not info or info.get('_type') in ('playlist','multi_video'):raise ValueError('请提供单个视频的链接。')
  file=Path(downloader.prepare_filename(info))
  if not file.is_file() or not 0<file.stat().st_size<=MAX:raise ValueError('没有取得64MB以内的可用视频。')
  if info.get('acodec')=='none':
   audio_formats=[f for f in info.get('formats',[]) if f.get('vcodec')=='none' and f.get('acodec') not in (None,'none') and f.get('url','').startswith('https://')]
   if audio_formats:
    chosen=min(audio_formats,key=lambda f:float(f.get('abr') or f.get('tbr') or 999))
    audio=root/'audio.m4a';downloader.dl(str(audio),{**chosen,'http_headers':{**info.get('http_headers',{}),**chosen.get('http_headers',{})}})
    if audio.is_file():
     if file.stat().st_size+audio.stat().st_size>MAX:raise ValueError('视频加音轨超过64MB。')
     import av
     merged=root/'merged.mp4'
     with av.open(str(file)) as video_input,av.open(str(audio)) as audio_input,av.open(str(merged),'w') as output:
      inputs=[(video_input,video_input.streams.video[0]),(audio_input,audio_input.streams.audio[0])]
      streams={stream:output.add_stream_from_template(stream) for _,stream in inputs}
      def packets(container,stream):
       for packet in container.demux(stream):
        if packet.dts is not None:yield packet
      for packet in heapq.merge(*(packets(c,s) for c,s in inputs),key=lambda p:float(p.dts*p.time_base)):
       packet.stream=streams[packet.stream];output.mux(packet)
     file=merged
 actual_subtitles=[]
 for language,entries in (info.get('subtitles') or {}).items():
  if not any(k in language.lower() for k in ('zh','cmn')):continue
  for sub in entries[:4]:
   try:
    subtitle_url=sub.get('url','');parsed=urlparse(subtitle_url)
    if parsed.scheme!='https' or not any(parsed.hostname==h or parsed.hostname.endswith('.'+h) for h in ('hdslb.com','bilibili.com')):continue
    with urllib.request.urlopen(urllib.request.Request(subtitle_url,headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.bilibili.com/'}),timeout=15) as response:
     raw=response.read(2*1024*1024+1)
    if len(raw)>2*1024*1024:continue
    values=json.loads(raw).get('body',[])
    actual_subtitles=[dict(start=float(s['from']),end=float(s['to']),text=str(s['content'])[:500]) for s in values[:3000] if s.get('to',0)>s.get('from',0)]
    if actual_subtitles:break
   except Exception:continue
  if actual_subtitles:break
 spec=importlib.util.spec_from_file_location('jie_video',APP/'qq-video-file.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 start=max(0,min(7200,float(config.get('start') or 0)))
 sections=[];max_seconds=max(60,min(480,float(config.get('maxSeconds') or 300)));segment_count=max(1,min(8,math.ceil(min(max_seconds,max(1,float(info.get('duration') or max_seconds)-start))/60)))
 for i in range(segment_count):
  part=module.extract(file,dict({'language':'zh-CN','words':[],**(config.get('settings') or {})},start=start,skipSpeech=bool(actual_subtitles),frameCount=max(1,min(4,8//segment_count))))
  if actual_subtitles:
   part['subtitles']=[s for s in actual_subtitles if s['end']>part['start'] and s['start']<part['end']]
   part['transcript']='\n'.join(str(s['start'])+'秒：'+s['text'] for s in part['subtitles'])[:5000]
   part['audioStatus']='已读取平台提供的实际字幕，可能含自动识别误差；音轨未另行转写'
  sections.append(part);start=part['end']
  if start>=part['duration']:break
 return dict(title=str(info.get('title') or '')[:200],platform='B站' if 'bili' in u.hostname else '抖音',
  videoId=str(info.get('id') or '')[:100],url=str(info.get('webpage_url') or config['url'])[:2000],
  duration=sections[0]['duration'],start=sections[0]['start'],end=sections[-1]['end'],
  truncated=sections[0]['start']>0 or sections[-1]['end']<sections[0]['duration'],
  frames=[v for p in sections for v in p['frames']],
  transcript='\n'.join(str(p['start'])+'—'+str(p['end'])+'秒：'+p['transcript'] for p in sections)[:8000],
  audioStatus='；'.join(dict.fromkeys(p['audioStatus'] for p in sections)),
  subtitles=[s for p in sections for s in p['subtitles']])

if __name__=='__main__':
 try:print(json.dumps(read(json.loads(sys.stdin.readline())),ensure_ascii=False),flush=True)
 except Exception as e:
  if '--diagnostic' in sys.argv:
   import traceback
   traceback.print_exc(file=sys.stderr)
  text=str(e)
  if re.search('cookie|login|登录|登录态',text,re.I):message='平台要求登录或有效Cookie，请在图片与视频设置中导入对应平台Cookie后重试。'
  elif re.search('403|412|429|captcha|验证',text,re.I):message='平台暂时拒绝读取或要求验证，请稍后重试；尚未读到视频内容。'
  elif re.search('No module|No such file',text,re.I):message='视频解码或下载组件缺失，请检查本地识别组件和视频功能包。'
  elif re.search('64MB|超过|单个视频|公网|只支持',text):message=text[:160]
  else:message='未能取得或解码视频，可能是网络、链接失效或平台解析规则变化；没有根据标题猜测内容。'
  print(json.dumps({'error':message},ensure_ascii=False),flush=True);sys.exit(1)
