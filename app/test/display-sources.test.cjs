'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {displayTarget,selectedDisplay,selectedSource}=require('../display-sources.cjs');
const display=(id,x=0)=>({id,bounds:{x,y:0,width:1280,height:800},scaleFactor:2});
const source=(id,display_id='')=>({id,name:'Entire Screen',display_id});
test('missing display_id on one screen is mapped without treating screen:0 as the display id',()=>{
 const s=source('screen:0:0'),displays=[display(1959893251)],target=displayTarget(s,[s],displays);assert.equal(target.displayId,'1959893251');assert.equal(selectedDisplay(target,displays),displays[0]);assert.equal(selectedSource(target,[s],displays),s);
});
test('multi-screen sources with absent display ids retain exact user selection without guessing display order',()=>{
 const a=source('screen:0:0'),b=source('screen:1:0'),displays=[display(200),display(100,1280)],target=displayTarget(b,[a,b],displays);assert.equal(target.displayId,'');assert.equal(selectedDisplay(target,displays),null);assert.equal(selectedSource(target,[b,a],displays),b);assert.equal(selectedSource(target,[a],displays),null);
});
test('topology changes invalidate a source with unavailable display identity',()=>{
 const s=source('screen:0:0'),target=displayTarget(s,[s],[display(1)]);assert.throws(()=>selectedDisplay(target,[display(1),display(2)]),/连接发生变化/);assert.throws(()=>selectedDisplay(target,[display(2)]),/连接发生变化/);
 assert.throws(()=>selectedDisplay(target,[display(1,1280)]),/连接发生变化/);
});
test('explicit display ids must agree and zero is a valid display id',()=>{
 const s=source('screen:0:0',0),target=displayTarget(s,[s],[display(0)]);assert.equal(target.displayId,'0');assert.equal(selectedDisplay(target,[display(0)]).id,0);assert.equal(selectedSource({...target,displayId:'99'},[source(s.id,'1')],[display(99)]),null);assert.throws(()=>selectedDisplay(target,[]),/已断开/);
});
test('region only falls back to the sole unidentified screen and never silently captures another screen',()=>{
 const d=display(1),target={kind:'region',displayId:'1',bounds:d.bounds,scaleFactor:2},s=source('screen:0:0');assert.equal(selectedSource(target,[s],[d]),s);assert.equal(selectedSource(target,[s,source('screen:1:0')],[d,display(2)]),null);assert.equal(selectedSource(target,[source(s.id,'2')],[d]),null);assert.equal(selectedSource(target,[s],[display(2)]),null);
});
test('region checks origin changes as well as scale and size',()=>{
 const d=display(1),target={kind:'region',displayId:'1',bounds:d.bounds,scaleFactor:2};assert.equal(selectedDisplay(target,[d]),d);assert.throws(()=>selectedDisplay(target,[display(1,100)]),/重新框选/);assert.throws(()=>selectedDisplay(target,[{...d,scaleFactor:1}]),/重新框选/);
});
test('picker handles a missing native display_id using Screen metadata and keeps own windows filtered',async()=>{
 const host=require('../watch-host.cjs'),s=source('screen:0:0'),result=await host.sources({screen:{getAllDisplays:()=>[display(1959893251)]},desktopCapturer:{getSources:async()=>[s,{id:'window:own',name:'own'}]},windows:()=>[{isDestroyed:()=>false,getMediaSourceId:()=> 'window:own'}]});assert.equal(result.length,1);assert.equal(result[0].displayId,'1959893251');
});
test('unmapped multi-display quiet capture uses only the exact selected screen source',async()=>{
 const host=require('../watch-host.cjs'),sizes={width:400,height:300};let otherUsed=false;const image={isEmpty:()=>false,getSize:()=>sizes,toJPEG:()=>Buffer.from('image'),resize:()=>({toDataURL:()=> 'preview',toBitmap:()=>Buffer.from('fingerprint')})};const a={...source('screen:0:0'),thumbnail:{isEmpty:()=>{otherUsed=true;return false;}}},b={...source('screen:1:0'),thumbnail:image},displays=[display(1),display(2)];const target=displayTarget(b,[a,b],displays);const result=await host.grab(target,{screen:{getAllDisplays:()=>displays},desktopCapturer:{getSources:async()=>[a,b]}});assert.match(result.data,/^data:image\/jpeg/);assert.equal(otherUsed,false);
});
