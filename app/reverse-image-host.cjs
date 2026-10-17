'use strict';
const {randomUUID}=require('node:crypto');
const {webURL}=require('./web-search.cjs');
function bytes(part){const match=typeof part?.image_url==='string'&&part.image_url.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match||match[2].length>6000000)throw Error('以图搜图需要有效且小于4MB的图片。');const value=Buffer.from(match[2],'base64');if(!value.length||value.length>4*1024*1024)throw Error('以图搜图图片过大。');return {value,mime:'image/'+match[1]};}
function sourceURL(value){const url=webURL(value);if(!url)return null;const u=new URL(url),host=u.hostname;if(/(^|\.)(?:graph\.baidu\.com|bdstatic\.com|jd\.com|taobao\.com|tmall\.com)$/.test(host)||/\.(?:jpg|png|webp|gif|jpeg)$/i.test(u.pathname)||/^\d+(?:\.\d+){3}$/.test(host)||host==='localhost')return null;return url;}
async function search(part,{BrowserWindow,signal,fetch,nativeImage}){
 const image=bytes(part);signal.throwIfAborted();const win=new BrowserWindow({show:false,width:1100,height:800,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,partition:'jie-reverse-'+randomUUID()}});
 const wc=win.webContents;wc.setWindowOpenHandler(()=>({action:'deny'}));wc.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));wc.session.on('will-download',(event)=>event.preventDefault());
 const allowed=url=>{try{const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='graph.baidu.com'||u.hostname.endsWith('.baidu.com'));}catch{return false;}};
 wc.on('will-navigate',(event,url)=>{if(!allowed(url))event.preventDefault();});wc.on('will-redirect',(event,url)=>{if(!allowed(url))event.preventDefault();});
 let timer,abort;const run=async()=>{
  await win.loadURL('https://graph.baidu.com/pcpage/index');
  // Use the site's ordinary file picker flow, including its own upload SDK.
  // Never synthesize anti-bot tokens or bypass a verification challenge.
  for(let tries=0;tries<15;tries++){signal.throwIfAborted();if(await wc.executeJavaScript('!!document.querySelector("input[type=file]")'))break;await new Promise(r=>setTimeout(r,150));}
  const uploaded=await wc.executeJavaScript('(()=>{const input=document.querySelector("input[type=file]");if(!input)return false;const data=new DataTransfer();data.items.add(new File([Uint8Array.from(atob('+JSON.stringify(image.value.toString('base64'))+'),c=>c.charCodeAt(0))],"image.png",{type:'+JSON.stringify(image.mime)+'}));input.files=data.files;input.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
  if(!uploaded)throw Error('百度识图上传入口暂时不可用。');
  let result;
  for(let i=0;i<65;i++){signal.throwIfAborted();if(win.isDestroyed())throw Error('以图搜图已结束。');const url=wc.getURL();if(!allowed(url))throw Error('百度识图需要额外验证。');try{result=await wc.executeJavaScript('({url:location.href,title:document.title,text:document.body.innerText.slice(0,8000),links:Array.from(document.querySelectorAll("a[href]")).map(a=>({url:a.href,title:(a.innerText||a.title||a.querySelector("img")?.alt||"").trim().slice(0,160)})).slice(0,160)})');}catch{await new Promise(r=>setTimeout(r,400));continue;}if(/安全验证|验证码|验证后|验证失败/.test(result.title+' '+result.text))throw Error('百度识图要求安全验证，本次没有取得相似图结果。');if(new URL(result.url).pathname==='/s'&&/相似图片|相关商品|识图结果/.test(result.text)&&i>=8)break;await new Promise(r=>setTimeout(r,400));}
  if(!result||new URL(result.url).pathname!=='/s'||!/相似图片|相关商品|识图结果/.test(result.text))throw Error('百度识图没有返回有效结果。');
  // Similar-image cards carry their original page URLs in the site's Vue state.
  // Extract only those card fields, never site tokens or the whole application state.
  const cards=await wc.executeJavaScript('(()=>{const seen=new WeakSet(),out=[];let nodes=0;function walk(o,d){if(!o||typeof o!=="object"||seen.has(o)||d>8||++nodes>10000||out.length>=30)return;seen.add(o);if(typeof o.fromUrl==="string")out.push({url:o.fromUrl,title:String(o.title||o.tname||o.desc||"").slice(0,160),thumbnail:String(o.thumbUrl||o.hoverUrl||"").slice(0,2000)});for(const v of Object.values(o))if(v&&typeof v==="object")walk(v,d+1);}for(const e of document.querySelectorAll("*"))if(e.__vue__)walk(e.__vue__.$data,0);return out;})()');
  const seen=new Set(),matches=[];for(const item of [...cards,...result.links]){const url=sourceURL(item.url);if(!url||seen.has(url))continue;seen.add(url);matches.push({url,title:item.title||new URL(url).hostname,thumbnail:webURL(item.thumbnail)||''});if(matches.length>=12)break;}
  const comparisons=[];if(fetch&&nativeImage)for(const match of matches.slice(0,3)){try{if(!match.thumbnail)continue;const u=new URL(match.thumbnail);if(!/^(?:mms\d*\.baidu\.com|img\d*\.bdstatic\.com)$/.test(u.hostname)||u.username||u.password||u.port)continue;u.protocol='https:';const r=await fetch(u.href,{signal:AbortSignal.any([signal,AbortSignal.timeout(5000)]),redirect:'error'});if(!r.ok||!r.body)continue;const chunks=[],reader=r.body.getReader();let count=0;try{while(true){const v=await reader.read();if(v.done)break;count+=v.value.length;if(count>2*1024*1024)throw Error('thumbnail too large');chunks.push(Buffer.from(v.value));}}finally{await reader.cancel().catch(()=>{});}const image=nativeImage.createFromBuffer(Buffer.concat(chunks));if(image.isEmpty())continue;const size=image.getSize();if(size.width*size.height>16000000)continue;const thumb=image.resize({width:Math.min(480,size.width)});comparisons.push({source:match.url,part:{type:'input_image',image_url:thumb.toDataURL(),detail:'auto'}});}catch(e){if(signal.aborted)throw e;}}
  return {provider:'百度识图',used:true,url:result.url,text:result.text.slice(0,5000),sources:matches,comparisons,notice:'以图搜图相似候选，不代表同一人物；商品推荐不能作为角色身份依据。'};
 };
 try{return await Promise.race([run(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('百度识图超时，未取得可核对结果。')),35000);abort=()=>reject(Error('已取消以图搜图。'));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();})]);}
 finally{clearTimeout(timer);signal.removeEventListener('abort',abort);if(!win.isDestroyed())win.destroy();}
}
module.exports={search,bytes,sourceURL};
