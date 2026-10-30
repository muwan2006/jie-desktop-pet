'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {captureWindows,windowsPixels}=require('../capture-screens.cjs');
function helper(onInput){const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();child.stdin.end=text=>onInput(text,child);child.kill=()=>child.killed=true;return child;}
test('Windows capture uses physical monitor rectangles including negative origins, not a global guessed scale',()=>{
 const displays=[{id:1,bounds:{x:0,y:0,width:1920,height:1080}},{id:2,bounds:{x:-1280,y:0,width:1280,height:720}}],seen=[];
 const screen={dipToScreenRect:(win,rect)=>{seen.push(rect);assert.equal(win,null);return rect.x<0?{x:-1920,y:0,width:1920,height:1080}:{x:0,y:0,width:1920,height:1080};}};
 assert.deepEqual(windowsPixels(displays,screen),[{id:'1',x:0,y:0,width:1920,height:1080},{id:'2',x:-1920,y:0,width:1920,height:1080}]);assert.equal(seen.length,2);
 assert.throws(()=>windowsPixels(displays,{dipToScreenRect:()=>({x:0,y:0,width:99999,height:99999})}));
});
test('screen helper receives only structured rectangles via stdin and incomplete or failed output is rejected',async()=>{
 const rects=[{id:'1',x:0,y:0,width:1920,height:1080}];let options;
 const child=helper((text,c)=>{assert.deepEqual(JSON.parse(text),rects);queueMicrotask(()=>{c.stdout.emit('data',Buffer.from('[{"id":"1","png":"AA=="}]'));c.emit('close',0);});});
 const result=await captureWindows(rects,{run:(exe,args,opts)=>{options=opts;assert.match(exe,/powershell\.exe$/);assert.equal(args[0],'-NoProfile');assert.ok(args.at(-1).endsWith('capture-screen.ps1'));return child;}});assert.equal(options.windowsHide,true);assert.deepEqual(result,[{id:'1',png:'AA=='}]);
 await assert.rejects(captureWindows(rects,{run:()=>helper((text,c)=>queueMicrotask(()=>{c.stdout.emit('data',Buffer.from('[]'));c.emit('close',0);}))}),/完整返回/);
 await assert.rejects(captureWindows(rects,{run:()=>helper((text,c)=>queueMicrotask(()=>c.emit('close',1)))}),/读取屏幕/);
});
test('capture timeout terminates only its own helper and late output cannot resolve the failed operation',async()=>{
 let child;const pending=captureWindows([{id:'1'}],{timeout:20,run:()=>child=helper(()=>{})});const keepAlive=setTimeout(()=>{},60);await assert.rejects(pending,/超时/);clearTimeout(keepAlive);assert.equal(child.killed,true);child.stdout.emit('data',Buffer.from('[{"id":"1"}]'));child.emit('close',0);
});
