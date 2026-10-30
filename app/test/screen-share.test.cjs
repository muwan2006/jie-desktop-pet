'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {ScreenShare,cropRect}=require('../screen-share.cjs');
let ids=0;class Window extends EventEmitter{constructor(options={}){super();this.options=options;this.webContents={id:++ids};this.visible=!!options.show;}isDestroyed(){return !!this.destroyed;}isVisible(){return this.visible;}hide(){this.visible=false;}showInactive(){this.visible=true;}show(){this.visible=true;}focus(){this.focused=true;}setAlwaysOnTop(){}async loadFile(){}close(){this.destroyed=true;this.emit('closed');}}
function fixture(){const displays=[{id:1,bounds:{x:0,y:0,width:1920,height:1080},scaleFactor:1},{id:2,bounds:{x:-1280,y:0,width:1280,height:720},scaleFactor:1.5}],crops=[],added=[];let profile='a',done=0;
 const original=new Window({show:true}),hidden=new Window({show:false}),image={isEmpty:()=>false,getSize:()=>({width:1920,height:1080}),toDataURL:()=> 'data:image/png;base64,AA==',crop:rect=>{crops.push(rect);return {toPNG:()=>Buffer.from('only selected pixels')};}};
 const share=new ScreenShare({BrowserWindow:Window,screen:{getAllDisplays:()=>displays,getCursorScreenPoint:()=>({x:-500,y:300}),getDisplayNearestPoint:()=>displays[1]},desktopCapturer:{getSources:async options=>{assert.deepEqual(options.types,['screen']);return [{display_id:'1',thumbnail:image},{display_id:'2',thumbnail:image}];}},secure(){},directory:__dirname,windows:()=>[original,hidden],profile:()=>profile,add:async(p,bytes,name)=>added.push({profile:p,bytes,name}),onDone:()=>done++});
 return {share,original,hidden,displays,crops,added,get done(){return done;},set profile(value){profile=value;}};
}
test('crop maps logical screen-local coordinates to actual pixels across DPI and negative monitor origins',()=>{
 assert.deepEqual(cropRect({x:100,y:50,width:200,height:100},{x:-1280,y:0,width:1280,height:720},{width:1920,height:1080}),{x:150,y:75,width:300,height:150});
 assert.deepEqual(cropRect({x:-10,y:-10,width:30,height:30},{width:100,height:100},{width:200,height:200}),{x:0,y:0,width:40,height:40});
 for(const rect of [{x:0,y:0,width:0,height:1},{x:Infinity,y:0,width:100,height:100},{x:200,y:200,width:20,height:20}])assert.throws(()=>cropRect(rect,{width:100,height:100},{width:200,height:200}));
});
test('capture hides only visible own windows, creates per-display selectors, and adds only confirmed crop to a draft',async()=>{
 const f=fixture();assert.equal((await f.share.start()).ok,true);assert.equal(f.original.visible,false);assert.equal(f.share.session.overlays.size,2);
 const selector=[...f.share.session.overlays.values()][1];assert.equal(selector.win.options.x,-1280);assert.equal(selector.win.focused,true);assert.equal(f.added.length,0);
 assert.equal((await f.share.accept({sender:selector.win.webContents},{x:100,y:50,width:200,height:100})).ok,true);assert.deepEqual(f.crops[0],{x:150,y:75,width:300,height:150});assert.equal(f.added.length,1);assert.equal(f.added[0].profile,'a');assert.equal(f.added[0].bytes.toString(),'only selected pixels');assert.equal(f.original.visible,true);assert.equal(f.hidden.visible,false);assert.equal(f.done,1);assert.equal(f.share.session,null);
});
test('cancel, unavailable screen capture and a changed profile restore windows and never attach screenshots',async()=>{
 const f=fixture();await f.share.start();f.share.cancel();assert.equal(f.added.length,0);assert.equal(f.original.visible,true);assert.equal(f.hidden.visible,false);
 await f.share.start();const wc=[...f.share.session.overlays.values()][0].win.webContents;f.profile='b';assert.ok((await f.share.accept({sender:wc},{x:0,y:0,width:100,height:100})).error);assert.equal(f.added.length,0);assert.equal(f.share.session,null);
 f.share.desktopCapturer.getSources=async()=>{throw Error('capture unavailable');};assert.ok((await f.share.start()).error);assert.equal(f.original.visible,true);
});
test('cancel while capture is pending rejects late sources and unexpected IPC senders cannot see or crop a screen',async()=>{
 const f=fixture();let release;f.share.desktopCapturer.getSources=async()=>new Promise(r=>release=r);const pending=f.share.start();while(!release)await new Promise(r=>setTimeout(r,10));f.share.cancel();release([]);assert.equal((await pending).canceled,true);assert.equal(f.share.session,null);
 assert.throws(()=>f.share.state({sender:{id:9000}}));await assert.rejects(f.share.accept({sender:{id:9000}},{x:0,y:0,width:100,height:100}));assert.equal(f.added.length,0);
});
test('attachment errors keep the region selector available and duplicate confirmations cannot add twice',async()=>{
 const f=fixture();await f.share.start();const event={sender:[...f.share.session.overlays.values()][0].win.webContents},rect={x:0,y:0,width:100,height:100};f.share.add=async()=>{throw Error('附件已满');};assert.match((await f.share.accept(event,rect)).error,/已满/);assert.ok(f.share.session);assert.equal(f.share.session.pending,false);
 let release;f.share.add=async()=>new Promise(r=>release=r);const pending=f.share.accept(event,rect);assert.ok((await f.share.accept(event,rect)).error);release();assert.equal((await pending).ok,true);assert.equal(f.done,1);
});
