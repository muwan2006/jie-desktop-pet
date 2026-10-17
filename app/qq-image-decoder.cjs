'use strict';
const path=require('node:path'),{format}=require('./qq-stickers.cjs');
async function decode(bytes,signal,{BrowserWindow}){
 const mime=format(bytes);if(!['gif','webp'].includes(mime)||bytes.length>10*1024*1024)throw Error('QQ动图格式无效或过大。');signal.throwIfAborted();
 const win=new BrowserWindow({show:false,width:32,height:32,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 let timer,abort;try{
  const cancel=new Promise((_,reject)=>{abort=()=>reject(Error('QQ动图读取已取消。'));signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>reject(Error('QQ动图读取超时，请重新发送。')),7000);timer.unref?.();});
  const convert=async()=>{await win.loadFile(path.join(__dirname,'qq-image-decode.html'));signal.throwIfAborted();win.webContents.on('will-navigate',e=>e.preventDefault());const url='data:image/'+mime+';base64,'+bytes.toString('base64');const png=await win.webContents.executeJavaScript('window.qqDecode('+JSON.stringify(url)+')');if(typeof png!=='string'||!png.startsWith('data:image/png;base64,')||png.length>18000000)throw Error('QQ动图首帧过大或无效。');return Buffer.from(png.split(',')[1],'base64');};
  return await Promise.race([convert(),cancel]);
 }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);if(!win.isDestroyed())win.destroy();}
}
module.exports={decode};
