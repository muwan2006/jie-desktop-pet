'use strict';
const path=require('node:path'),{spawn}=require('node:child_process');
function windowsPixels(displays,screen){return displays.map(display=>{const rect=screen.dipToScreenRect(null,display.bounds);if(![rect.x,rect.y,rect.width,rect.height].every(Number.isInteger)||rect.width<=0||rect.height<=0||rect.width*rect.height>50000000)throw Error('屏幕尺寸暂不支持截图。');return {id:String(display.id),...rect};});}
function captureWindows(rects,{run=spawn,timeout=15000}={}){
 return new Promise((resolve,reject)=>{
  const executable=path.win32.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');let child;
  try{child=run(executable,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'capture-screen.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});}catch{return reject(Error('暂时无法启动屏幕截图，请重试。'));}
  let output=[],length=0,settled=false;const fail=message=>{if(settled)return;settled=true;clearTimeout(timer);child.kill();reject(Error(message));};
  const timer=setTimeout(()=>fail('读取屏幕超时，已退出截图。请重新尝试。'),timeout);timer.unref?.();
  child.stdout.on('data',chunk=>{length+=chunk.length;if(length>140000000)return fail('屏幕画面过大，请降低分辨率后重试。');output.push(chunk);});child.stderr.on('data',()=>{});
  child.on('error',()=>fail('暂时无法读取屏幕，请重试。'));child.stdin.on('error',()=>fail('暂时无法读取屏幕，请重试。'));
  child.on('close',code=>{if(settled)return;settled=true;clearTimeout(timer);if(code!==0)return reject(Error('暂时无法读取屏幕画面，请重试。'));
   try{const values=JSON.parse(Buffer.concat(output).toString('utf8').replace(/^\uFEFF/,''));if(!Array.isArray(values)||values.length!==rects.length)throw Error();resolve(values);}catch{reject(Error('截图数据没有完整返回，请重试。'));}
  });child.stdin.end(JSON.stringify(rects),'utf8');
 });
}
async function captureScreens({displays,screen,nativeImage,desktopCapturer,platform=process.platform}){
 if(platform==='win32'){
  const rects=windowsPixels(displays,screen),values=await captureWindows(rects);
  return rects.map(rect=>{const value=values.find(v=>v.id===rect.id);if(typeof value?.png!=='string'||value.png.length>100000000)throw Error('截图数据无效，请重试。');const thumbnail=nativeImage.createFromBuffer(Buffer.from(value.png,'base64'));if(thumbnail.isEmpty()||thumbnail.getSize().width!==rect.width||thumbnail.getSize().height!==rect.height)throw Error('屏幕尺寸发生变化，请重新截图。');return {display_id:rect.id,thumbnail};});
 }
 const maxWidth=Math.max(...displays.map(d=>Math.round(d.bounds.width*d.scaleFactor))),maxHeight=Math.max(...displays.map(d=>Math.round(d.bounds.height*d.scaleFactor)));
 let timer;try{return await Promise.race([desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.min(8192,maxWidth),height:Math.min(8192,maxHeight)},fetchWindowIcons:false}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('读取屏幕超时，请重试。')),15000);})]);}finally{clearTimeout(timer);}
}
module.exports={captureScreens,captureWindows,windowsPixels};
