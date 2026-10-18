'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {intent,MediaControl}=require('../media-control.cjs');
test('spoken media commands accept natural strict phrasing without acting on quotations',()=>{
 for(const phrase of ['换一首','换首歌','切歌','帮我切到下一首吧','网易云音乐下一首','播放下一首歌。','请帮我播放下一首歌曲','放下一首音乐','切换到下一首歌'])assert.equal(intent(phrase)?.action,'next',phrase);
 assert.deepEqual(intent('帮我把网易云声音调小一点'),{action:'adjust',value:-10,target:'netease'});
 assert.deepEqual(intent('系统音量调到百分之二十'),{action:'volume',value:20,target:'system'});
 for(const phrase of ['他说换一首','不要切歌','为什么下一首没用','音乐声音小一点是不是会好点','音量调到一百零一'])assert.equal(intent(phrase),null,phrase);
});
test('spoken next-song request uses the local route before the task planner',async()=>{
 const {AssistantRuntime}=require('../assistant-runtime.cjs');let request;
 const runtime={tasks:{owner:()=>({profile:'a'})},emit:()=>{},h:{companionRoute:async text=>{request=intent(text);return {ok:true,result:'已切换'};}}};
 const result=await AssistantRuntime.prototype.recognizedImpl.call(runtime,{text:'播放下一首歌。',confidence:.6,autoSend:true});
 assert.equal(result.companionHandled,true);assert.equal(request.action,'next');
});
test('backend errors reach UI and voice, and requested player is passed explicitly',async()=>{
 let args;const media=new MediaControl({saved:{target:'netease'},run:(p,a,o,cb)=>{args=a;cb(Error('exit 1'),JSON.stringify({error:'网易云未响应切歌'}));}});
 await assert.rejects(media.execute({action:'next'}),/网易云未响应切歌/);
 assert.equal(args[args.indexOf('-Target')+1],'netease');assert.equal(media.busy,false);
 await assert.rejects(media.execute({action:'volume',value:NaN}),/参数/);
});
test('confirmed track changes and actual player volume have distinct truthful feedback',async()=>{
 const media=new MediaControl({run:(p,a,o,cb)=>cb(null,JSON.stringify(a.includes('next')?{verified:true,title:'新曲',player:'网易云音乐'}:{scope:'player',volume:20,muted:false}))});
 assert.match((await media.execute({action:'next'})).result,/新曲/);
 assert.match((await media.execute({action:'volume',value:20})).result,/网易云音乐音量 20%/);
 media.configure({target:'system'});assert.equal(media.settings.target,'system');
});
