'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {NativeFrameStream}=require('../watch-stream.cjs');
test('continuous source permission is confined to the selected target and requesting frame',async()=>{
 let win,queries=[];class Window{
  constructor(options){win=this;this.options=options;this.destroyed=false;const session={setPermissionCheckHandler:f=>session.check=f,setPermissionRequestHandler:f=>session.request=f,setDisplayMediaRequestHandler:f=>session.display=f};this.webContents={session,mainFrame:{url:''},getURL:()=>this.url,setWindowOpenHandler:()=>{},on:()=>{},executeJavaScript:async()=>({ok:true})};}
  async loadFile(file){this.url=require('node:url').pathToFileURL(file).href;this.webContents.mainFrame.url=this.url;}
  isDestroyed(){return this.destroyed;}destroy(){this.destroyed=true;}
 }
 const capture=new NativeFrameStream({BrowserWindow:Window,directory:path.resolve(__dirname,'..'),screen:{},desktopCapturer:{getSources:async options=>{queries.push(options);return [{id:'window:42:0'},{id:'window:99:0'}];}}});
 await capture.start({kind:'window',id:'window:42:0',sessionId:'chosen'});const s=win.webContents.session,wc=win.webContents,request={frame:wc.mainFrame,videoRequested:true,audioRequested:false};
 assert.equal(s.check(wc,'display-capture','',{}),true);assert.equal(s.check(wc,'media','',{mediaType:'audio'}),false);assert.equal(s.check({...wc},'display-capture','',{}),false);
 let granted;await s.display(request,v=>granted=v);assert.equal(granted.video.id,'window:42:0');assert.equal(granted.audio,undefined);assert.deepEqual(queries[0].types,['window']);
 await s.display({...request,audioRequested:true},v=>granted=v);assert.deepEqual(granted,{});await s.display({...request,frame:{url:wc.mainFrame.url}},v=>granted=v);assert.deepEqual(granted,{});
 capture.stop();await s.display(request,v=>granted=v);assert.deepEqual(granted,{});assert.equal(win.destroyed,true);assert.equal(capture.window,null);
});
test('renderer crops a selected region correctly on a display at 200 percent scaling without audio',async()=>{
 const canvases=[],draws=[],video={readyState:2,videoWidth:3840,videoHeight:2160,play:async()=>{}},track={addEventListener:()=>{},stop:()=>{}};let constraints;
 const context={window:{},Date,setInterval:()=>1,clearInterval:()=>{},navigator:{mediaDevices:{getDisplayMedia:async value=>{constraints=value;return {getVideoTracks:()=>[track],getTracks:()=>[track]};}}},document:{querySelector:()=>video,createElement:()=>{const c={width:0,height:0,toDataURL:type=>'data:'+type+';base64,AA==',getContext:()=>({drawImage:(...args)=>draws.push({canvas:c,args}),getImageData:()=>({data:new Uint8ClampedArray(64*36*4)})})};canvases.push(c);return c;}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../watch-stream.js'),'utf8'),context);
 await context.window.captureStart({bounds:{width:1920,height:1080},rect:{x:100,y:50,width:300,height:200}});
 assert.equal(constraints.audio,false);assert.deepEqual(draws[0].args.slice(1,5),[200,100,600,400]);assert.equal(canvases[0].width,600);assert.equal(canvases[0].height,400);assert.ok(context.window.captureRead().frame);context.window.captureStop();assert.equal(context.window.captureRead().frame,null);
});
test('capture preserves the actual keyframe time and clears nested temporary frames',async()=>{
 const {ScreenWatch}=require('../screen-watch.cjs');const frame={data:'data:image/jpeg;base64,AA==',at:9950,fingerprint:[1,2,3],streaming:true,extra:[]};const watch=new ScreenWatch({profile:()=> 'p',now:()=>10000,grab:async()=>frame});watch.start({id:'window:42:0',kind:'window'});await watch.capture();assert.equal(watch.frame.at,9950);assert.equal(watch.frame.extra,undefined);watch.stop();assert.equal(watch.frames.frames.length,0);
});
