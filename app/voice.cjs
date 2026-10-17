'use strict';
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs'),crypto=require('node:crypto');
const defaults={source:'local',systemVoice:'',enabled:true,autoChat:true,autoInteraction:true,presetGreetings:true,dailyPresetsVersion:1,volume:.75,speed:1,port:9880,maxChars:500,reference:'default',refPath:'',promptText:'让旁人知道自己的想法，那是天下一等一的难事。'};
function settings(v={}){
 const s={...defaults};if(['local','system','cloud'].includes(v.source))s.source=v.source;if(typeof v.systemVoice==='string')s.systemVoice=v.systemVoice.trim().slice(0,200);for(const k of ['enabled','autoChat','autoInteraction','presetGreetings'])if(typeof v[k]==='boolean')s[k]=v[k];
 for(const [k,lo,hi] of [['volume',0,1],['speed',.7,1.3],['port',1024,65535],['maxChars',100,1200]])if(Number.isFinite(v[k]))s[k]=Math.min(hi,Math.max(lo,v[k]));
 s.port=Math.round(s.port);s.maxChars=Math.round(s.maxChars);
 if(['default','alternate','custom'].includes(v.reference))s.reference=v.reference;
 if(typeof v.refPath==='string'&&v.refPath.length<=2000&&!/[\r\n\0]/.test(v.refPath))s.refPath=v.refPath;
 if(typeof v.promptText==='string')s.promptText=v.promptText.trim().slice(0,1500);
 return s;
}
const {spokenText}=require('./speech-text.cjs');
function wavInfo(buffer){
 if(!Buffer.isBuffer(buffer)||buffer.length<44||buffer.toString('ascii',0,4)!=='RIFF'||buffer.toString('ascii',8,12)!=='WAVE')throw Error('未收到有效 WAV 音频。');
 let pos=12,fmt=null,dataBytes=0;
 while(pos+8<=buffer.length){const id=buffer.toString('ascii',pos,pos+4),len=buffer.readUInt32LE(pos+4),start=pos+8;if(start+len>buffer.length)throw Error('WAV 音频不完整。');
  if(id==='fmt '&&len>=16)fmt={format:buffer.readUInt16LE(start),channels:buffer.readUInt16LE(start+2),rate:buffer.readUInt32LE(start+4),byteRate:buffer.readUInt32LE(start+8),bits:buffer.readUInt16LE(start+14)};
  if(id==='data')dataBytes+=len;pos=start+len+(len%2);
 }
 if(!fmt||![1,3,65534].includes(fmt.format)||fmt.channels<1||fmt.channels>2||fmt.rate<8000||fmt.rate>192000||!fmt.byteRate||!dataBytes)throw Error('WAV 格式不支持或没有声音。');
 return {...fmt,duration:dataBytes/fmt.byteRate};
}
function localRequest(port,route,{body,signal,timeout=180000,maxBytes=16000000}={}){
 // Numeric loopback and fixed caller-owned routes: bypass DNS and system HTTP proxies.
 if(!Number.isInteger(port)||port<1024||port>65535||!['/tts','/openapi.json'].includes(route))return Promise.reject(Error('本机语音地址无效。'));
 return new Promise((resolve,reject)=>{
  const raw=body===undefined?null:Buffer.from(JSON.stringify(body));
  const req=http.request({hostname:'127.0.0.1',port,path:route,agent:false,method:raw?'POST':'GET',headers:raw?{'Content-Type':'application/json','Content-Length':raw.length}:{},signal},res=>{
   const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){reject(Error('语音返回数据过大。'));res.destroy();req.destroy();return;}chunks.push(chunk);});
   res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,buffer:Buffer.concat(chunks),contentType:res.headers['content-type']||''}));
  });
  const deadline=setTimeout(()=>req.destroy(Error('语音生成超时。请检查语音服务窗口。')),timeout);req.once('close',()=>clearTimeout(deadline));req.on('error',reject);if(raw)req.write(raw);req.end();
 });
}
class Voice {
 constructor(saved={},hooks={}){this.settings=settings(saved);this.hooks=hooks;this.generation=0;this.controller=null;this.state='idle';this.error='';this.text='';this.duration=0;this.playId=null;this.lastText='';this.started=0;this.deadline=null;}
 snapshot(){return {services:this.hooks.serviceState?.()||{},settings:{...this.settings},state:this.state,error:this.error,text:this.text,duration:this.duration,sequence:this.sequence?{index:this.sequence.index+1,total:this.sequence.segments.length}:null};}
 save(){return {...this.settings};}
 emit(){this.hooks.onChange?.(this.snapshot());}
 configure(input){this.stop();this.settings=settings({...this.settings,...input});this.error='';this.emit();return {ok:true};}
 refPath(){return this.settings.reference==='custom'?this.settings.refPath:this.hooks.referencePath?.()||path.join(__dirname,'assets/voice',this.settings.reference==='alternate'?'jie-reference-alt.wav':'jie-reference.wav');}
 stop(){this.generation++;this.controller?.abort();this.controller=null;clearTimeout(this.deadline);this.deadline=null;this.playId=null;this.state='idle';const sequence=this.sequence;this.sequence=null;sequence?.resolve?.('canceled');sequence?.onFinish?.('canceled');this.hooks.onAudio?.({type:'stop'});this.emit();return {ok:true};}
 async probe(){
  try{if(this.settings.source!=='local'){if(!this.hooks.probe)throw Error('此语音服务尚未配置。');const result=await this.hooks.probe(this.settings);this.error='';this.emit();return result;}const r=await (this.hooks.request||localRequest)(this.settings.port,'/openapi.json',{timeout:5000,maxBytes:2000000});let doc;try{doc=JSON.parse(r.buffer);}catch{}if(r.status!==200||!doc?.paths?.['/tts']?.post)throw Error('此端口不是兼容的 GPT-SoVITS API v2 服务。');this.error='';this.emit();return {ok:true,result:'本机语音服务已连接。'};}
  catch(e){this.error=e.code==='ECONNREFUSED'?'语音服务未启动。请先运行 START-JIE-VOICE.bat。':e.message||'无法连接本机语音服务。';this.emit();return {error:this.error};}
 }
 preset(text){
  try{const directory=this.hooks.presetDirectory?.()||path.join(__dirname,'assets/voice/presets');const manifest=JSON.parse(fs.readFileSync(path.join(directory,'index.json'),'utf8'));
   const clip=manifest.clips.find(c=>c.text===text||c.id===text);if(!clip)return this.musicPreset(text);if(!/^[-a-z]+\.wav$/.test(clip.file))return null;
   const buffer=fs.readFileSync(path.join(directory,clip.file));if(crypto.createHash('sha256').update(buffer).digest('hex')!==clip.sha256)return null;
   return {...clip,buffer,info:wavInfo(buffer)};
  }catch{return null;}
 }
 musicPreset(text){try{const directory=path.join(__dirname,'assets/voice/music-presets'),manifest=JSON.parse(fs.readFileSync(path.join(directory,'index.json'),'utf8')),clip=manifest.clips.find(c=>c.id===text||c.text===text);if(!clip||!/^music-[-a-z]+\.wav$/.test(clip.file))return null;const buffer=fs.readFileSync(path.join(directory,clip.file));if(crypto.createHash('sha256').update(buffer).digest('hex')!==clip.sha256)return null;return {...clip,buffer,info:wavInfo(buffer)};}catch{return null;}}
 playPreset(text,{manual=false,daily=false}={}){
  if(!this.settings.enabled)return {error:'语音已关闭，请先开启。'};
  if(!manual&&!(daily?this.settings.autoInteraction:this.settings.presetGreetings))return {skipped:true};
  if(!manual&&this.state!=='idle')return {skipped:true};
  const clip=this.preset(text);if(!clip)return {error:'这句预存录音不存在或损坏。'};
  this.stop();const id=this.generation;this.state='playing';this.error='';this.text=clip.text;this.lastText=clip.text;this.duration=clip.info.duration/this.settings.speed;this.playId=id;
  this.hooks.onAudio?.({type:'play',id,data:clip.buffer.toString('base64'),volume:this.settings.volume,rate:this.settings.speed,preset:true});this.emit();
  this.deadline=setTimeout(()=>{if(this.playId===id)this.playback(id,'error','预存语音播放没有完成。');},(this.duration+15)*1000);this.deadline.unref?.();return {ok:true,preset:true};
 }
 async synthesize(text,config,signal){
  let audio;
  if(config.source!=='local'){if(!this.hooks.generate)throw Error('请先配置所选语音服务。');audio=await this.hooks.generate(text,config,signal);}
  else {const ref=this.refPath();if(!ref)throw Error('请先选择参考 WAV 录音。');this.hooks.validateReference?.(ref);const result=await (this.hooks.request||localRequest)(config.port,'/tts',{signal,body:{text,text_lang:'zh',ref_audio_path:ref,prompt_lang:'zh',prompt_text:config.promptText,text_split_method:'cut5',batch_size:1,parallel_infer:false,split_bucket:false,media_type:'wav',streaming_mode:false,speed_factor:config.speed,seed:42,repetition_penalty:1.35}});if(result.status!==200){let detail='';try{const v=JSON.parse(result.buffer);detail=String(v.Exception||v.message||'').slice(0,240);}catch{}throw Error('语音合成失败'+(detail?'：'+detail:'。请查看服务窗口。'));}audio={buffer:result.buffer,rate:1};}
  const info=wavInfo(audio.buffer);if(info.duration>240)throw Error('生成语音过长，请缩短台词。');return {buffer:audio.buffer,info,rate:Number.isFinite(audio.rate)?audio.rate:1,preset:false};
 }
 async speak(text,{manual=false}={}){
  if(!this.settings.enabled)return {error:'语音已关闭，请先开启。'};
  const spoken=spokenText(text,this.settings.maxChars);if(!spoken)return {error:'没有可朗读的文字。'};
  if(this.settings.presetGreetings&&this.preset(spoken))return this.playPreset(spoken,{manual});
  // Ignore rapid background interactions while speaking; explicit requests replace the old voice.
  if(!manual&&this.state!=='idle')return {skipped:true};
  this.stop();const generation=this.generation,controller=new AbortController();this.controller=controller;this.state='generating';this.error='';this.text=spoken;this.lastText=text;this.started=Date.now();this.emit();
  try{
   const audio=await this.synthesize(spoken,this.settings,controller.signal);if(generation!==this.generation)return {canceled:true};const {buffer,info,rate}=audio;
   this.duration=info.duration/rate;this.controller=null;this.state='playing';this.playId=generation;
   this.hooks.onAudio?.({type:'play',id:generation,data:buffer.toString('base64'),volume:this.settings.volume,rate});this.emit();
   this.deadline=setTimeout(()=>{if(this.playId===generation)this.playback(generation,'error','语音播放没有完成，请检查声音输出设备。');},Math.max(15000,(info.duration+15)*1000));this.deadline.unref?.();
   return {ok:true};
  }catch(e){if(generation!==this.generation)return {canceled:true};this.controller=null;this.state='idle';this.error=e.code==='ECONNREFUSED'?'语音服务未启动。请先运行 START-JIE-VOICE.bat。':e.message||'语音没有完成。';this.emit();return {error:this.error};}
 }
 async speakSegments(segments,{onSegment=()=>{},onFinish=()=>{}}={}){
  if(!this.settings.enabled){onFinish('error');return {error:'语音已关闭。'};}
  const lines=(Array.isArray(segments)?segments:[]).slice(0,64).filter(s=>typeof s?.text==='string'&&s.text.trim()&&s.text.length<=160);
  if(!lines.length){onFinish('error');return {error:'没有可朗读的句段。'};}
  this.stop();const generation=this.generation,controller=new AbortController(),config={...this.settings};this.controller=controller;
  const sequence={segments:lines,index:0,onSegment,onFinish,resolve:null,started:false};this.sequence=sequence;this.state='generating';this.error='';this.lastText=lines.map(s=>s.text).join('');this.text=lines[0].text;this.emit();
  const prepare=async segment=>{
   if(generation!==this.generation)throw Error('已停止朗读。');
   const tone=segment.voiceTone||{},spokenConfig={...config,speed:Math.min(1.3,Math.max(.7,config.speed*(tone.speed||1)))};const clip=config.presetGreetings?this.preset(segment.text):null;
   if(clip)return {buffer:clip.buffer,info:clip.info,rate:spokenConfig.speed,preset:true};
   return this.synthesize(segment.text,spokenConfig,controller.signal);
  };
  // Always handle a prefetched rejection immediately, including after cancellation.
  const pending=segment=>prepare(segment).then(value=>({value}),error=>({error}));
  try{
   let next=pending(lines[0]);
   for(let index=0;index<lines.length;index++){
    sequence.index=index;sequence.started=false;this.text=lines[index].text;this.state='generating';this.emit();
    const prepared=await next;if(generation!==this.generation)return {canceled:true};if(prepared.error)throw prepared.error;
    const audio=prepared.value,id=generation+':'+index;this.duration=audio.info.duration/audio.rate;this.playId=id;this.state='playing';
    const ended=new Promise(resolve=>{sequence.resolve=resolve;});
    this.hooks.onAudio?.({type:'play',id,data:audio.buffer.toString('base64'),volume:config.volume*(lines[index].voiceTone?.volume??1),rate:audio.rate,preset:audio.preset});this.emit();
    this.deadline=setTimeout(()=>this.playback(id,'error','句段语音播放没有完成。'),(this.duration+15)*1000);this.deadline.unref?.();
    next=index+1<lines.length?pending(lines[index+1]):null;
    const status=await ended;if(generation!==this.generation)return {canceled:true};if(status==='error')throw Error(this.error||'句段语音未能播放。');const pause=Number(lines[index].voiceTone?.pause)||0;if(index+1<lines.length&&pause>0)await new Promise(resolve=>{let timer;const finish=()=>{clearTimeout(timer);controller.signal.removeEventListener('abort',finish);resolve();};timer=setTimeout(finish,Math.min(600,pause));controller.signal.addEventListener('abort',finish,{once:true});if(controller.signal.aborted)finish();});if(generation!==this.generation)return {canceled:true};
   }
   this.sequence=null;this.controller=null;this.state='idle';this.emit();onFinish('ended');return {ok:true};
  }catch(e){if(generation!==this.generation)return {canceled:true};controller.abort();clearTimeout(this.deadline);this.deadline=null;this.sequence=null;this.controller=null;this.playId=null;this.state='idle';this.error=e.code==='ECONNREFUSED'?'语音服务未启动，已按文字节奏切换表情。':e.message||'句段语音没有完成。';this.hooks.onAudio?.({type:'stop'});this.emit();onFinish('error');return {error:this.error};}
 }
 playback(id,event,error){if(id!==this.playId)return;
  if(event==='started'){if(this.sequence&&!this.sequence.started){this.sequence.started=true;this.sequence.onSegment(this.sequence.segments[this.sequence.index],this.sequence.index);}return;}
  clearTimeout(this.deadline);this.deadline=null;this.playId=null;this.state='idle';if(event==='error'){this.error=typeof error==='string'?error.slice(0,160):'播放失败。';this.hooks.onAudio?.({type:'stop'});}this.emit();
  if(this.sequence){const resolve=this.sequence.resolve;this.sequence.resolve=null;resolve?.(event);}
 }
}
module.exports={Voice,settings,spokenText,wavInfo,localRequest};
