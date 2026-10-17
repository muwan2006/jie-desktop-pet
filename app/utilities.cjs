'use strict';
const path=require('node:path');const {aliases}=require('./launch-intent.cjs');
const {randomUUID}=require('node:crypto');
const clip=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
function nextDaily(time,now){
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return null;
 const [hours,minutes]=time.split(':').map(Number),date=new Date(now);date.setHours(hours,minutes,0,0);
 if(date.getTime()<=now)date.setDate(date.getDate()+1);return date.getTime();
}
function safeURL(value){try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}}
class Utilities {
 constructor(saved={},id=randomUUID){this.id=id;this.directLaunch=saved.directLaunch!==false;
  this.notes=Array.isArray(saved.notes)?saved.notes.filter(n=>typeof n?.id==='string'&&typeof n.text==='string').slice(0,30):[];
  this.alerts=Array.isArray(saved.alerts)?saved.alerts.filter(a=>typeof a?.id==='string'&&Number.isFinite(a.nextAt)&&['once','daily'].includes(a.repeat)).slice(0,50):[];
  this.links=Array.isArray(saved.links)?saved.links.filter(l=>typeof l?.id==='string'&&['url','file','folder','app'].includes(l.kind)&&typeof l.target==='string').slice(0,30):[];
 }
 addNote(title,text,now=Date.now()){if(this.notes.length>=30)return null;const n={id:this.id(),title:clip(title,80)||'一页便签',text:clip(text,6000),updatedAt:now,pinned:false};this.notes.push(n);return n;}
 updateNote(id,value,now=Date.now()){const n=this.notes.find(n=>n.id===id);if(!n||!value||typeof value!=='object')return false;
  if(typeof value.title==='string')n.title=clip(value.title,80)||'一页便签';
  if(typeof value.text==='string')n.text=value.text.slice(0,6000);
  if(typeof value.pinned==='boolean')n.pinned=value.pinned;
  if(value.position&&Number.isFinite(value.position.x)&&Number.isFinite(value.position.y))n.position={x:Math.round(value.position.x),y:Math.round(value.position.y)};
  n.updatedAt=now;return true;
 }
 removeNote(id){const n=this.notes.length;this.notes=this.notes.filter(v=>v.id!==id);return this.notes.length!==n;}
 addAlert(input,now=Date.now()){
  if(this.alerts.length>=50||!input||typeof input!=='object')return {error:'提醒最多 50 条。'};
  const text=clip(input.text,180);if(!text)return {error:'请填写提醒内容。'};
  const repeat=input.repeat==='daily'?'daily':'once';let nextAt;
  if(repeat==='daily')nextAt=nextDaily(input.time,now);
  else nextAt=typeof input.at==='string'?new Date(input.at).getTime():input.at;
  if(!Number.isFinite(nextAt)||nextAt<=now)return {error:'请选择一个未来的有效时间。'};
  const item={id:this.id(),text,repeat,time:repeat==='daily'?input.time:null,nextAt,enabled:true,done:false};this.alerts.push(item);return {item};
 }
 toggleAlert(id,now=Date.now()){const a=this.alerts.find(v=>v.id===id);if(!a||a.done)return false;
  if(!a.enabled&&a.repeat==='once'&&a.nextAt<=now)return false;
  a.enabled=!a.enabled;if(a.enabled&&a.repeat==='daily')a.nextAt=nextDaily(a.time,now);return true;
 }
 removeAlert(id){const n=this.alerts.length;this.alerts=this.alerts.filter(v=>v.id!==id);return this.alerts.length!==n;}
 tick(now=Date.now()){const due=[];
  for(const a of this.alerts){if(!a.enabled||a.done||a.nextAt>now)continue;due.push({id:a.id,text:a.text,scheduledAt:a.nextAt});
   if(a.repeat==='daily')a.nextAt=nextDaily(a.time,now);else{a.done=true;a.enabled=false;}
  }return due;
 }
 addLink(kind,label,target,names=[]){if(this.links.length>=30)return {error:'快捷入口最多 30 个。'};
  if(kind==='url'){target=safeURL(target);if(!target)return {error:'请输入 http 或 https 网站地址。'};}
  else if(!['file','folder','app'].includes(kind)||typeof target!=='string'||!target)return {error:'请选择文件或文件夹。'};
  if(kind==='app'&&(!path.isAbsolute(target)||!['.exe','.lnk'].includes(path.extname(target).toLowerCase())))return {error:'请选择软件的 EXE 或快捷方式。'};
  const item={aliases:aliases(names),id:this.id(),kind,label:clip(label,80)||'快捷入口',target};this.links.push(item);return {item};
 }
 editLink(id,value){const l=this.links.find(l=>l.id===id);if(!l)return {error:'入口不存在。'};if(typeof value?.label==='string'&&clip(value.label,80))l.label=clip(value.label,80);if(value?.aliases!==undefined)l.aliases=aliases(value.aliases);return {ok:true};}
 removeLink(id){const n=this.links.length;this.links=this.links.filter(v=>v.id!==id);return n!==this.links.length;}
 snapshot(){return {notes:this.notes,alerts:this.alerts,links:this.links,directLaunch:this.directLaunch};}
 save(){return this.snapshot();}
}
module.exports={Utilities,nextDaily,safeURL};
