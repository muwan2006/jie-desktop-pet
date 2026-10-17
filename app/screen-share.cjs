'use strict';
const path=require('node:path');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function cropRect(rect,bounds,size){
 if(!rect||![rect.x,rect.y,rect.width,rect.height,bounds.width,bounds.height,size.width,size.height].every(Number.isFinite)||bounds.width<=0||bounds.height<=0||rect.width<8||rect.height<8)throw Error('请框选至少 8 × 8 的区域。');
 const x=Math.max(0,Math.min(bounds.width,rect.x)),y=Math.max(0,Math.min(bounds.height,rect.y));
 const right=Math.max(x,Math.min(bounds.width,rect.x+rect.width)),bottom=Math.max(y,Math.min(bounds.height,rect.y+rect.height));
 const left=Math.floor(x*size.width/bounds.width),top=Math.floor(y*size.height/bounds.height);
 const width=Math.min(size.width-left,Math.ceil(right*size.width/bounds.width)-left),height=Math.min(size.height-top,Math.ceil(bottom*size.height/bounds.height)-top);
 if(width<2||height<2)throw Error('框选区域无效，请重新选择。');return {x:left,y:top,width,height};
}
class ScreenShare{
 constructor({BrowserWindow,screen,desktopCapturer,grabSources,secure,directory,windows,profile,add,onDone=()=>{}}){Object.assign(this,{BrowserWindow,screen,desktopCapturer,grabSources,secure,directory,windows,profile,add,onDone});this.session=null;this.version=0;}
 async start({onSelection=null}={}){
  if(this.session)return {error:'已经在选取屏幕区域，按 Esc 可取消。'};
  const version=++this.version,session={version,profile:this.profile(),hidden:[],onSelection,overlays:new Map(),pending:false};this.session=session;
  try{
   for(const win of this.windows())if(win&&!win.isDestroyed()&&win.isVisible()){session.hidden.push(win);win.hide();}
   await wait(220);if(this.session!==session)return {canceled:true};
   const displays=this.screen.getAllDisplays(),maxWidth=Math.max(...displays.map(d=>Math.round(d.bounds.width*d.scaleFactor))),maxHeight=Math.max(...displays.map(d=>Math.round(d.bounds.height*d.scaleFactor)));
   const sources=await (this.grabSources?this.grabSources(displays):this.desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.min(8192,maxWidth),height:Math.min(8192,maxHeight)},fetchWindowIcons:false}));
   if(this.session!==session)return {canceled:true};
   for(const display of displays){
    const source=sources.find(s=>String(s.display_id)===String(display.id))||(displays.length===1&&sources.length===1?sources[0]:null);if(!source||source.thumbnail.isEmpty())continue;
    const image=source.thumbnail;const win=new this.BrowserWindow({...display.bounds,frame:false,transparent:false,resizable:false,movable:false,skipTaskbar:true,alwaysOnTop:true,show:false,backgroundColor:'#151714',title:'颉 · 给她看看',webPreferences:{preload:path.join(this.directory,'capture-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    const entry={win,display,image};session.overlays.set(win.webContents.id,entry);this.secure(win,'capture.html');win.setAlwaysOnTop(true,'screen-saver');
    win.on('closed',()=>{if(this.session===session)this.cancel();});win.on('render-process-gone',()=>{if(this.session===session)this.cancel();});
    await win.loadFile(path.join(this.directory,'capture.html'));if(this.session!==session){if(!win.isDestroyed())win.close();return {canceled:true};}win.show();win.focus();
   }
   if(!session.overlays.size)throw Error('没有取得可用的屏幕画面，请重试。');
   const cursorDisplay=this.screen.getDisplayNearestPoint(this.screen.getCursorScreenPoint());const focused=[...session.overlays.values()].find(e=>e.display.id===cursorDisplay.id);focused?.win.focus();return {ok:true};
  }catch(e){if(this.session===session)this.finish();return {error:e.message||'截图没有完成，请重试。'};}
 }
 own(event){const entry=this.session?.overlays.get(event.sender.id);return entry&&entry.win.webContents===event.sender?entry:null;}
 state(event){const entry=this.own(event);if(!entry)throw Error('Invalid sender');return {image:entry.image.toDataURL(),width:entry.display.bounds.width,height:entry.display.bounds.height};}
 async accept(event,rect){
  const entry=this.own(event),session=this.session;if(!entry)throw Error('Invalid sender');if(session.pending)return {error:'截图正在加入聊天，请稍等。'};
  if(session.profile!==this.profile()){this.cancel();return {error:'账号已切换，请重新截图。'};}
  try{
   const cropped=entry.image.crop(cropRect(rect,entry.display.bounds,entry.image.getSize()));session.pending=true;
   if(session.onSelection)await session.onSelection({display:entry.display,rect:{...rect}});else await this.add(session.profile,cropped.toPNG(),'屏幕选区-'+new Date().toISOString().replace(/[:.]/g,'-')+'.png');
   if(this.session!==session||session.profile!==this.profile())return {canceled:true};this.finish();this.onDone();return {ok:true};
  }catch(e){if(this.session===session)session.pending=false;return {error:e.message||'截图未能加入聊天。'};}
 }
 finish(){const session=this.session;if(!session)return;this.session=null;this.version++;for(const e of session.overlays.values())if(!e.win.isDestroyed())e.win.close();for(const win of session.hidden)if(!win.isDestroyed())win.showInactive();}
 cancel(){this.finish();return {canceled:true};}
 cancelIfProfileChanged(){if(this.session&&this.session.profile!==this.profile())this.cancel();}
}
module.exports={ScreenShare,cropRect};
