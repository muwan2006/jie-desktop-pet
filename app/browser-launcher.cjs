'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {safeURL}=require('./utilities.cjs');
function edgePaths(env=process.env){return [...new Set([env['ProgramFiles(x86)'],env.ProgramFiles,'C:\\Program Files (x86)','C:\\Program Files'].filter(Boolean).map(root=>path.win32.join(root,'Microsoft','Edge','Application','msedge.exe')).concat(env.LOCALAPPDATA?[path.win32.join(env.LOCALAPPDATA,'Microsoft','Edge','Application','msedge.exe')]:[]))];}
function browserExecutable(browser,{exists=fs.existsSync,readShortcut,paths=edgePaths()}={}){
 let target=browser?.target;
 if(target){if(!exists(target))throw Error('选定的浏览器入口已失效，请刷新软件列表或选择 Microsoft Edge。');if(path.win32.extname(target).toLowerCase()==='.lnk'){try{target=readShortcut?.(target)?.target;}catch{target=null;}}
  if(!target||path.win32.extname(target).toLowerCase()!=='.exe'||!path.win32.isAbsolute(target)||!exists(target))throw Error('浏览器快捷方式没有指向可用程序，请选择 Microsoft Edge。');
 }else target=paths.find(exists);
 if(!target)throw Error('未找到 Microsoft Edge，请安装或重新选择浏览器。');
 return target;
}
function launchWebsite(value,browser,options={}){
 const url=safeURL(value);if(!url)return Promise.reject(Error('网站地址无效，只能打开 HTTP 或 HTTPS 页面。'));
 let target;try{target=browserExecutable(browser,options);}catch(e){return Promise.reject(e);}
 return new Promise((resolve,reject)=>{let child,settled=false,timer;const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve({result:'已进入 '+url});};
  try{child=(options.run||spawn)(target,[url],{shell:false,windowsHide:true,detached:true,stdio:'ignore'});child.once('error',()=>finish(Error('浏览器未能启动，请检查 Edge 是否安装完整。')));child.once('exit',code=>{if(code!==0&&code!==null)finish(Error('浏览器启动失败，退出码：'+code));});child.once('spawn',()=>{child.unref();timer=setTimeout(()=>finish(),options.grace??350);});}catch{finish(Error('浏览器未能启动，请检查 Edge 是否安装完整。'));}
 });
}
module.exports={edgePaths,browserExecutable,launchWebsite};
