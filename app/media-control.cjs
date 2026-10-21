'use strict';
const path=require('node:path'),{execFile}=require('node:child_process');
const NUM={'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
function number(s){if(/^\d{1,3}$/.test(s))return Number(s);if(s==='一百')return 100;const p=s.split('十');if(p.length===2&&p[0].length<=1&&p[1].length<=1)return (p[0]?NUM[p[0]]:1)*10+(p[1]?NUM[p[1]]:0);return NUM[s];}
function shortcut(value){if(value==='')return '';if(typeof value!=='string'||value.length>80)return null;const parts=value.replace(/＋/g,'+').split('+').map(s=>s.trim()),key=parts.pop()?.toUpperCase();const aliases={ctrl:'Control',control:'Control',alt:'Alt',shift:'Shift'},mods=parts.map(s=>aliases[s.toLowerCase()]);if(mods.some(s=>!s)||new Set(mods).size!==mods.length||!key||!/^([A-Z0-9]|F([1-9]|1[0-9]|2[0-4]))$/.test(key)||!mods.some(s=>['Control','Alt'].includes(s))&&!(!mods.length&&/^F\d+$/.test(key)))return null;return [...['Control','Alt','Shift'].filter(s=>mods.includes(s)),key].join('+');}
function intent(raw){let s=String(raw||'').trim().replace(/[，,。！!？?\s]/g,'').replace(/^(?:颉|小小颉)/,'').replace(/^(?:请你?|麻烦你?|帮我|替我|给我)(?:帮我|替我|给我)?(?:把)?/,'').replace(/(?:一下|吧|就行|谢谢|好吗)+$/,'');
 let target;if(/系统/.test(s))target='system';else if(/网易云(?:音乐)?/.test(s))target='netease';s=s.replace(/网易云(?:音乐)?/g,'');
 const result=v=>target?{...v,target}:v;
 if(/^(?:(?:播放|播|放|换|切|切换|跳)(?:到|成)?)?(?:下一(?:首|曲)|后一(?:首|曲))(?:歌曲|音乐|歌|曲)?$/.test(s))return result({action:'next'});
 if(/^(?:(?:播放|播|放|换|切|切换|跳|回)(?:到|成)?)?(?:上一(?:首|曲)|前一(?:首|曲))(?:歌曲|音乐|歌|曲)?$/.test(s))return result({action:'previous'});
 if(/^(?:暂停|先暂停)(?:(?:这首|当前)?(?:音乐|歌曲|播放|歌))?$/.test(s)||/^(?:把)?(?:音乐|歌曲|播放|歌)(?:先)?暂停$/.test(s))return result({action:'pause'});
 if(/^停止(?:这首|当前)?(?:音乐|歌曲|播放|歌)$/.test(s))return result({action:'stop'});
 if(/^(?:播放|开始播放|继续播放|恢复播放)(?:(?:这首|当前)?(?:音乐|歌曲|歌))?$/.test(s)||/^放(?:这首|当前)?(?:音乐|歌曲|歌)$/.test(s))return result({action:'play'});
 if(/^(?:继续|恢复)(?:这首|当前)?(?:音乐|歌曲|播放|歌)$/.test(s))return result({action:'play'});
 let relative=s.match(/^(?:调|调整)(高|低|大|小)(?:系统)?(?:音量|声音)(?:一点|些|点)?$/);if(relative)return result({action:'adjust',value:/高|大/.test(relative[1])?10:-10});
 if(/^(?:换|切)(?:一?首|歌|首歌|一首歌|首|一曲)$/.test(s)||/^(?:换|切)(?:到)?下一(?:首|曲)$/.test(s))return result({action:'next'});
 if(/^(?:切|换|回)(?:到)?上一(?:首|曲)$/.test(s))return result({action:'previous'});
 if(/^(?:播放暂停|切换播放状态)$/.test(s))return result({action:'toggle'});
 if(/^(?:声音|音量)(?:太)?(?:小了|大了)$/.test(s))return result({action:'adjust',value:/小了$/.test(s)?10:-10});
 if(/^(?:把)?(?:声音|音量)(?:调|再)?(?:大|高|响)(?:一点|点|些)$/.test(s)||/^(?:大|高|响)(?:声)?(?:一点|点|些)$/.test(s))return result({action:'adjust',value:10});
 if(/^(?:把)?(?:声音|音量)(?:调|再)?(?:小|低|轻)(?:一点|点|些)$/.test(s)||/^(?:小|低|轻)(?:声)?(?:一点|点|些)$/.test(s))return result({action:'adjust',value:-10});
 s=s.replace(/^把声音/,'把音量').replace(/^声音/,'音量');
 const keys={'暂停音乐':'pause','暂停播放':'pause','暂停歌曲':'pause','继续音乐':'play','继续播放':'play','播放音乐':'play','恢复播放':'play','下一首':'next','下一曲':'next','切到下一首':'next','上一首':'previous','上一曲':'previous','停止音乐':'stop','停止播放':'stop','静音':'mute','系统静音':'mute','取消静音':'unmute','关闭静音':'unmute','音量多少':'status','现在音量多少':'status','查看音量':'status'};
 if(keys[s])return result({action:keys[s]});
 let m=s.match(/^(?:把)?(?:系统)?音量(?:调(?:整)?到|设(?:置)?(?:为)?|降到|提高到)(?:百分之)?([零一二两三四五六七八九十百\d]+)%?$/);if(m){const value=number(m[1]);return Number.isFinite(value)&&value>=0&&value<=100?result({action:'volume',value}):null;}
 m=s.match(/^(?:把)?(?:系统)?音量(?:调)?(小|低|大|高|降低|提高)(?:一点|些|点)?(?:百分之)?([零一二两三四五六七八九十\d]*)%?$/);if(m){const v=m[2]?number(m[2]):10;return v>0&&v<=100?result({action:'adjust',value:/(小|低|降低)/.test(m[1])?-v:v}):null;}return null;
}
class MediaControl{
 constructor({run=execFile,saved={}}={}){this.run=run;this.busy=false;this.last=null;this.settings={target:['auto','netease','system'].includes(saved.target)?saved.target:'auto',shortcut:Object.hasOwn(saved,'shortcut')?shortcut(saved.shortcut)??'':'Control+Alt+P'};}
 configure(v){if(!v||!Object.hasOwn(v,'target')&&!Object.hasOwn(v,'shortcut'))throw Error('播放器设置无效。');const next={...this.settings};if(Object.hasOwn(v,'target')){if(!['auto','netease','system'].includes(v.target))throw Error('播放器选择无效。');next.target=v.target;}if(Object.hasOwn(v,'shortcut')){const value=shortcut(v.shortcut);if(value===null)throw Error('请填写网易云已启用的全局快捷键，例如 Ctrl+Alt+P；清空可关闭快捷键回退。');next.shortcut=value;}this.settings=next;return {ok:true};}
 async execute(v){
  if(!['status','volume','adjust','mute','unmute','pause','play','toggle','next','previous','stop'].includes(v?.action)||(['volume','adjust'].includes(v.action)&&(!Number.isInteger(v.value)||Math.abs(v.value)>100||v.action==='volume'&&v.value<0))||v.target!==undefined&&!['auto','netease','system'].includes(v.target))throw Error('音乐控制参数无效。');
  if(this.busy)throw Error('正在调整，请稍等。');this.busy=true;
  try{
   const value=await new Promise((resolve,reject)=>this.run(path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'media-control.ps1'),'-Action',v.action,'-Value',String(v.value||0),'-Target',v.target||this.settings.target,'-Shortcut',this.settings.shortcut||'off'],{windowsHide:true,timeout:16000,maxBuffer:64000},(e,out='')=>{
    let result;try{result=JSON.parse(out.replace(/^\uFEFF/,'').trim());}catch{return reject(Error('没有收到媒体控制结果，请重试。'));}
    if(e||result.error)return reject(Error(String(result.error||'媒体控制未完成，请检查播放器。').slice(0,500)));resolve(result);
   }));
   this.last={...value,at:Date.now()};const labels={pause:'暂停播放',play:'继续播放',toggle:'播放／暂停',next:'下一首',previous:'上一首',stop:'停止播放'};
   const playback=['play','pause','toggle'].includes(v.action)&&value.verified&&['Playing','Paused'].includes(value.status);
   const result=playback?(value.already?'播放器当前'+(value.status==='Playing'?'正在播放，未重复切换。':'已暂停，未重复切换。'):value.status==='Playing'?'已恢复播放。':'已暂停播放。'):labels[v.action]?(value.verified?'已切换到'+(value.title?'「'+value.title+'」':'曲目')+'。':'已向'+(value.player||'播放器')+'发送“'+labels[v.action]+'”'+(value.accepted?'，播放器已接收；尚未确认播放状态。':'，尚未确认播放状态。')):(value.scope==='player'?'网易云音乐':'系统')+`音量 ${value.volume}%${value.muted?'，已静音':'。'}`;
   return {ok:true,result,evidence:{kind:'system-media',verified:!labels[v.action],...value}};
  }finally{this.busy=false;}
 }
}
module.exports={MediaControl,intent,number,shortcut};
