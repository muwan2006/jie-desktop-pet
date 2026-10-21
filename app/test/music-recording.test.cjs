'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{lifeBlocked}=require('../music-priority.cjs'),{CompanionPlus}=require('../companion-plus.cjs'),{DesktopLife}=require('../desktop-life.cjs'),{CelPlayback}=require('../music-cels.js');
const now=1700000000000;
function state(extra={}){return {now,musicPriority:true,background:false,backgroundReason:'前台应用正在全屏',desktopProcess:'SnippingTool',desktopFullscreen:true,quietApp:false,engine:{mode:'idle',action:{until:0},messageUntil:0},...extra};}
test('Windows recording selection keeps the existing music cel animation running while fullscreen notifications remain blocked',()=>{
 const plus=new CompanionPlus();plus.native={available:true,process:'SnippingTool',fullscreen:true};assert.equal(plus.allowed({now}),false);
 const s=state({backgroundReason:plus.blockReason}),life=new DesktopLife({},now),input={position:{x:200,y:200},area:{x:0,y:0,width:1920,height:1080},geom:{width:300,height:320},builtin:true,form:'classic'};life.configure({music:true,auto:false});life.observe({audioAvailable:true,peak:.2},now);
 const first=life.tick(now+100,{...input,blocked:lifeBlocked({...s,now:now+100})}),second=life.tick(now+200,{...input,blocked:lifeBlocked({...s,now:now+200})});assert.equal(first.motion.source,'music');assert.equal(second.motion.started,first.motion.started);assert.deepEqual(first.position,input.position);assert.deepEqual(second.position,input.position);
 const cels=new CelPlayback(),frames=new Set();for(let t=100;t<=420;t+=16)frames.add(cels.sample(second.motion,now+t).index);assert.ok(frames.size>1);assert.equal(plus.allowed({now:now+200}),false);
});
test('the recorder exception cannot override explicit quiet, meeting apps, rest, active speech or user interactions',()=>{
 for(const extra of [{musicPriority:false},{quietApp:true},{backgroundReason:'你让她稍后再聊'},{backgroundReason:'前台是你设定的会议软件'},{desktopProcess:'Game.exe'},{desktopProcess:'SnippingTool-fake'},{desktopFullscreen:false},{drag:true},{chatBusy:true},{preparingChat:true},{performanceActive:true},{voiceBusy:true},{speechInput:{}},{tasksBusy:true},{engine:{mode:'rest',action:{until:0},messageUntil:0}}])assert.equal(lifeBlocked(state(extra)),true,JSON.stringify(extra));
 for(const desktopProcess of ['SnippingTool','snippingtool.exe','ScreenClippingHost'])assert.equal(lifeBlocked(state({desktopProcess})),false);
});
test('manual do-not-disturb still suppresses music during recording and ordinary full-screen apps remain unchanged',()=>{
 const plus=new CompanionPlus();plus.native={available:true,process:'SnippingTool',fullscreen:true};plus.postpone(30,now);assert.equal(plus.allowed({now}),false);assert.equal(lifeBlocked(state({backgroundReason:plus.blockReason})),true);plus.resume();plus.native.process='OrdinaryFullScreenApp';assert.equal(plus.allowed({now}),false);assert.equal(lifeBlocked(state({desktopProcess:plus.native.process,backgroundReason:plus.blockReason})),true);
});
