'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('mouse following yields during all speech, inter-sentence waits, silent dialogue and drag, then resumes',async()=>{
 let onSnapshot,onCursor,onVoiceState,drawFrame;const drawn=[];
 const element=()=>({hidden:true,style:{},setAttribute(){},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:384,height:416}),getContext:()=>({clearRect(){},getImageData:()=>({data:[0,0,0,0]}),drawImage(){}})});
 const elements=Object.fromEntries(['#pet','#bubble','#timer','#voice-badge'].map(k=>[k,element()]));
 const state={settings:{scale:1,form:'classic'},action:'idle',mode:'companion',performanceActive:false,performance:null,emote:null};
 const sandbox={document:{querySelector:s=>elements[s],body:{classList:{toggle(){}}},addEventListener(){}},Image:class{constructor(){this.complete=true;this.naturalWidth=384;}},performance:{now:()=>0},Date,Math,setTimeout,clearTimeout,requestAnimationFrame:cb=>drawFrame=cb,window:{devicePixelRatio:1,
  JieFrames:{load(){},ready:()=>true},JieRepair:{load(){}},JieLift:{load(){},ready:()=>false},JieDesk:{dimensions:()=>({width:384,height:416})},JieEmotes:{active:()=>false},JieClassicHD:{load(){},drawBase:(c,row,col)=>{drawn.push([row,col]);return true;}},
  jie:{onSnapshot:cb=>onSnapshot=cb,snapshot:async()=>state,onCursor:cb=>onCursor=cb,onVoiceState:cb=>onVoiceState=cb,voiceState:async()=>({state:'idle'}),hit(){}}}};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../pet.js'),'utf8'),sandbox);await Promise.resolve();
 const frame=()=>{onCursor({x:500,y:150});drawFrame(0);return drawn.at(-1)[0];};
 assert.ok(frame()>=9);
 onVoiceState({state:'playing'});assert.equal(frame(),0);
 onVoiceState({state:'generating'});assert.equal(frame(),0);
 onVoiceState({state:'idle'});onSnapshot({...state,performanceActive:true,performance:{mode:'voice',index:1,total:3}});assert.equal(frame(),0);
 onSnapshot({...state,performanceActive:true,performance:null});assert.equal(frame(),0);
 onSnapshot({...state,performanceActive:true,performance:{mode:'reading'}});assert.equal(frame(),0);
 onSnapshot({...state,dragging:true});assert.equal(frame(),0);
 onSnapshot({...state,emotionHold:{until:Date.now()+5000}});assert.equal(frame(),0);
 onSnapshot({...state,bodyMotion:{id:'landing',until:Date.now()+2000}});assert.equal(frame(),0);
 onSnapshot(state);assert.ok(frame()>=9);
});
