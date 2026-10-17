'use strict';
const path=require('node:path'),{execFile}=require('node:child_process');
const NUM={'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
function number(s){if(/^\d{1,3}$/.test(s))return Number(s);if(s==='一百')return 100;const p=s.split('十');if(p.length===2&&p[0].length<=1&&p[1].length<=1)return (p[0]?NUM[p[0]]:1)*10+(p[1]?NUM[p[1]]:0);return NUM[s];}
function intent(raw){let s=String(raw||'').trim().replace(/[，,。！!？?\s]/g,'').replace(/^(?:颉|小小颉)[，,]?/,'').replace(/^(?:请你?|帮我|麻烦你)(?:把)?/,'').replace(/(?:一下|吧|就行)$/,'');
 const keys={'暂停音乐':'pause','暂停播放':'pause','暂停歌曲':'pause','继续音乐':'play','继续播放':'play','播放音乐':'play','恢复播放':'play','下一首':'next','下一曲':'next','切到下一首':'next','上一首':'previous','上一曲':'previous','停止音乐':'stop','停止播放':'stop','静音':'mute','系统静音':'mute','取消静音':'unmute','关闭静音':'unmute','音量多少':'status','现在音量多少':'status','查看音量':'status'};
 if(keys[s])return {action:keys[s]};
 let m=s.match(/^(?:把)?(?:系统)?音量(?:调(?:整)?到|设(?:置)?(?:为)?|降到|提高到)(?:百分之)?([零一二两三四五六七八九十百\d]+)%?$/);if(m){const value=number(m[1]);return Number.isFinite(value)&&value>=0&&value<=100?{action:'volume',value}:null;}
 m=s.match(/^(?:把)?(?:系统)?音量(?:调)?(小|低|大|高|降低|提高)(?:一点|些|点)?(?:百分之)?([零一二两三四五六七八九十\d]*)%?$/);if(m){const v=m[2]?number(m[2]):10;return v>0&&v<=100?{action:'adjust',value:/(小|低|降低)/.test(m[1])?-v:v}:null;}return null;
}
class MediaControl{
 constructor({run=execFile}={}){this.run=run;this.busy=false;this.last=null;}
 async execute(v){if(!['status','volume','adjust','mute','unmute','pause','play','next','previous','stop'].includes(v?.action)||(['volume','adjust'].includes(v.action)&&(!Number.isInteger(v.value)||Math.abs(v.value)>100||v.action==='volume'&&v.value<0)))throw Error('音乐控制参数无效。');if(this.busy)throw Error('正在调整，请稍等。');this.busy=true;try{const value=await new Promise((resolve,reject)=>this.run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'media-control.ps1'),'-Action',v.action,'-Value',String(v.value||0)],{windowsHide:true,timeout:12000,maxBuffer:64000},(e,out)=>{if(e)return reject(Error('系统媒体控制没有完成，请检查播放设备和播放器。'));try{resolve(JSON.parse(out.replace(/^\uFEFF/,'').trim()));}catch{reject(Error('没有收到系统媒体控制结果。'));}}));this.last={...value,at:Date.now()};const labels={pause:'暂停播放',play:'继续播放',next:'下一首',previous:'上一首',stop:'停止播放'};return {ok:true,result:labels[v.action]?'已向播放器发送“'+labels[v.action]+'”；播放器需要支持系统媒体按键。':`系统音量 ${value.volume}%${value.muted?'，已静音':'。'}`,evidence:{kind:'system-media',verified:!labels[v.action],...value}};}finally{this.busy=false;}}
}
module.exports={MediaControl,intent,number};
