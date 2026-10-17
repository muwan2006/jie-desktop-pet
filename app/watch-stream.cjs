'use strict';
const path=require('node:path'),{pathToFileURL}=require('node:url');
const {selectedDisplay,selectedSource}=require('./display-sources.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
class NativeFrameStream{
 constructor({BrowserWindow,desktopCapturer,screen,directory}){Object.assign(this,{BrowserWindow,desktopCapturer,screen,directory});this.window=null;this.target=null;this.version=0;this.lastPeak=0;}
 stop(){this.version++;const win=this.window;this.window=null;this.target=null;this.lastPeak=0;if(win&&!win.isDestroyed())win.destroy();}
 sync(session,mode){if(!session||session.paused||mode!=='companion'||this.target&&this.target.sessionId!==session.sessionId)this.stop();}
 async start(target){
  this.stop();const version=this.version,url=pathToFileURL(path.join(this.directory,'watch-stream.html')).href;
  const win=new this.BrowserWindow({show:false,width:100,height:100,skipTaskbar:true,title:'颉 · 画面采集',webPreferences:{partition:'jie-watch-stream-'+version+'-'+Date.now(),sandbox:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});this.window=win;this.target=target;
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,next)=>{if(next!==url)e.preventDefault();});
  const own=wc=>this.window===win&&!win.isDestroyed()&&wc===win.webContents&&wc.getURL()===url;
  win.webContents.session.setPermissionCheckHandler((wc,permission,_origin,details)=>own(wc)&&['media','display-capture'].includes(permission)&&details?.mediaType!=='audio');
  win.webContents.session.setPermissionRequestHandler((wc,permission,callback,details)=>callback(own(wc)&&['media','display-capture'].includes(permission)&&!(details?.mediaTypes||[]).includes('audio')));
  let captureError='';win.webContents.session.setDisplayMediaRequestHandler(async(request,callback)=>{
   if(this.version!==version||win.isDestroyed()||request.frame!==win.webContents.mainFrame||request.frame.url!==url||request.audioRequested||!request.videoRequested)return callback({});
   try{const entries=await this.desktopCapturer.getSources({types:[target.kind==='window'?'window':'screen'],thumbnailSize:{width:0,height:0}}),displays=target.kind==='window'?[]:this.screen.getAllDisplays();selectedDisplay(target,displays);const source=selectedSource(target,entries,displays);if(!source){captureError=target.kind==='region'?'无法确认选区所属屏幕，请改选完整屏幕或窗口。':'所选屏幕或窗口已不可用，请刷新后重新选择。';return callback({});}if(this.version!==version||win.isDestroyed())return callback({});callback({video:source});}catch(e){captureError=e.message;callback({});}
  });
  let timeout;
  try{const begin=async()=>{await win.loadFile(path.join(this.directory,'watch-stream.html'));if(version!==this.version||win.isDestroyed())throw Error('观察已停止。');await win.webContents.executeJavaScript('window.captureStart('+JSON.stringify({rect:target.rect||null,bounds:target.bounds||null})+')',true);if(version!==this.version||win.isDestroyed())throw Error('观察已停止。');};await Promise.race([begin(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('共享窗口启动超时。')),15000);})]);}
  catch(e){if(this.window===win)this.stop();else if(!win.isDestroyed())win.destroy();throw Error(captureError||'连续画面采集没有启动，请重新选择窗口。'+(e.message?.includes('NotAllowed')?'系统没有允许共享此窗口。':''));}
  finally{clearTimeout(timeout);}
 }
 async grab(target){
  if(target.kind!=='window')selectedDisplay(target,this.screen.getAllDisplays());
  if(!this.target||this.target.sessionId!==target.sessionId)await this.start(target);const win=this.window,version=this.version;
  for(let i=0;i<35;i++){if(!win||win.isDestroyed()||version!==this.version)throw Error('观察已停止。');const state=await win.webContents.executeJavaScript('window.captureRead()');if(state.ended)throw Error('共享窗口已关闭或共享已结束，请重新选择。');if(state.frame){if(Date.now()-state.frame.at>3000)throw Error('共享窗口暂时没有新画面，请恢复窗口后重试。');const extra=state.peak&&state.peak.at>this.lastPeak?[state.beforePeak,state.peak].filter(Boolean):[];if(state.peak)this.lastPeak=Math.max(this.lastPeak,state.peak.at);return {...state.frame,streaming:true,extra};}await wait(100);}throw Error('共享窗口没有返回画面，请恢复窗口后重试。');
 }
}
module.exports={NativeFrameStream};
