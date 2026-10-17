'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
class LocalVoiceService{
 constructor({spawnChild=spawn,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){this.spawnChild=spawnChild;this.wait=wait;this.pending=null;}
 ensure(voice){if(this.pending)return this.pending;this.pending=this.prepare(voice).then(async result=>{if(!result.error&&voice.settings.source==='local'){const signature=JSON.stringify([voice.settings.port,voice.settings.reference,voice.settings.refPath]);if(this.warmed!==signature){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);try{await voice.synthesize('好，我陪着你。',{...voice.settings},controller.signal);this.warmed=signature;}catch(e){return {error:'语音预热未完成：'+e.message};}finally{clearTimeout(timer);}}}return result;}).finally(()=>{this.pending=null;});return this.pending;}
 async prepare(voice){if(!voice.settings.enabled)return {error:'语音已关闭，请先打开声音再通话。'};const probe=await voice.probe();if(!probe.error||voice.settings.source!=='local')return probe;
  if(!/未启动/.test(probe.error))return probe;const recordPath=path.join(process.env.LOCALAPPDATA||'','JieDesktopPet/voice-install.json');let record;try{record=JSON.parse(fs.readFileSync(recordPath,'utf8').replace(/^\uFEFF/,''));}catch{return {error:'没有找到已安装的语音服务，请在声音设置中配置语音。'};}
  const root=path.resolve(record.root||''),python=path.resolve(record.python||''),inside=path.relative(root,python);if(inside.startsWith('..')||path.isAbsolute(inside)||!/^python\.exe$/i.test(path.basename(python))||!fs.existsSync(python)||!fs.existsSync(path.join(root,'api_v2.py'))||record.port!==voice.settings.port)return {error:'已有语音安装位置或端口不匹配，请检查声音设置。'};
  const child=this.spawnChild(python,['-u',path.join(__dirname,'voice-engine/bootstrap.py'),'--root',root,'--port',String(record.port)],{cwd:root,windowsHide:true,detached:true,stdio:'ignore'});let failed='';child.once('error',e=>{failed=e.message;});child.unref?.();
  for(let i=0;i<90;i++){await this.wait(500);if(failed)return {error:'语音服务未能启动：'+failed};const next=await voice.probe();if(!next.error)return next;if(child.exitCode!==null&&child.exitCode!==undefined)return {error:'语音服务启动失败，请在声音设置中检查本地模型。'};}
  return {error:'语音服务仍在准备，请稍后重新接通。'};
 }
}
module.exports={LocalVoiceService};
