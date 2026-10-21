'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {intent,MediaControl}=require('../media-control.cjs');
test('spoken media commands accept natural strict phrasing without acting on quotations',()=>{
 for(const phrase of ['换一首','换首歌','切歌','帮我切到下一首吧','网易云音乐下一首','播放下一首歌。','请帮我播放下一首歌曲','放下一首音乐','切换到下一首歌'])assert.equal(intent(phrase)?.action,'next',phrase);
 for(const phrase of ['播放歌曲','播放','放歌','放音乐','开始播放','开始播放歌曲','播放这首歌','继续播放歌曲','恢复播放当前歌曲'])assert.equal(intent(phrase)?.action,'play',phrase);
 for(const phrase of ['暂停','暂停！','先暂停','暂停一下吧','请暂停一下','帮我暂停歌曲','把歌暂停','把音乐先暂停一下'])assert.equal(intent(phrase)?.action,'pause',phrase);
 assert.deepEqual(intent('网易云播放歌曲'),{action:'play',target:'netease'});
 assert.deepEqual(intent('暂停网易云音乐'),{action:'pause',target:'netease'});
 assert.deepEqual(intent('停止音乐'),{action:'stop'});
 assert.deepEqual(intent('帮我把网易云声音调小一点'),{action:'adjust',value:-10,target:'netease'});
 assert.deepEqual(intent('系统音量调到百分之二十'),{action:'volume',value:20,target:'system'});
 for(const phrase of ['他说换一首','不要切歌','为什么下一首没用','音乐声音小一点是不是会好点','音量调到一百零一','不要暂停','别播放歌曲','她说暂停','为什么播放歌曲没用','暂停任务','暂停通话','继续任务','播放歌曲晴天','播放歌曲和暂停没用'])assert.equal(intent(phrase),null,phrase);
});
test('spoken next-song request uses the local route before the task planner',async()=>{
 const {AssistantRuntime}=require('../assistant-runtime.cjs');let request;
 const runtime={tasks:{owner:()=>({profile:'a'})},emit:()=>{},h:{companionRoute:async text=>{request=intent(text);return {ok:true,result:'已切换'};}}};
 const result=await AssistantRuntime.prototype.recognizedImpl.call(runtime,{text:'播放下一首歌。',confidence:.6,autoSend:true});
 assert.equal(result.companionHandled,true);assert.equal(request.action,'next');
});

test('spoken play and pause reach the playback backend through the actual local voice route',async()=>{
 const {AssistantRuntime}=require('../assistant-runtime.cjs'),{CompanionToolsRuntime}=require('../companion-tools-runtime.cjs'),calls=[],replies=[];
 const media=new MediaControl({saved:{target:'netease'},run:(_exe,args,_options,callback)=>{calls.push({action:args[args.indexOf('-Action')+1],target:args[args.indexOf('-Target')+1]});callback(null,JSON.stringify({accepted:true,verified:false,player:'网易云音乐'}));}});
 const tools={media,h:{append(){},reply:(message,voice)=>replies.push({message,voice}),save(){}},publish(){}};
 const runtime={tasks:{owner:()=>({profile:'fixture'})},emit(){},h:{companionRoute:(text,voice)=>CompanionToolsRuntime.prototype.mediaRequest.call(tools,text,voice)}};
 for(const phrase of ['播放歌曲','暂停','暂停播放。','播放下一首歌。']){const r=await AssistantRuntime.prototype.recognizedImpl.call(runtime,{text:phrase,confidence:.6,autoSend:true});assert.equal(r.companionHandled,true);assert.equal(r.ok,true);}
 assert.deepEqual(calls,[{action:'play',target:'netease'},{action:'pause',target:'netease'},{action:'pause',target:'netease'},{action:'next',target:'netease'}]);assert.ok(replies.every(r=>r.voice===true));
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

test('NetEase fallback uses the configured global shortcut and reports confirmed play/pause without claiming a track change',async()=>{
 const {shortcut}=require('../media-control.cjs');assert.equal(shortcut('Ctrl＋Alt＋p'),'Control+Alt+P');assert.equal(shortcut('shift+CTRL+P'),'Control+Shift+P');assert.equal(shortcut(''),'');
 for(const value of ['Space','P','Win+P','Ctrl+Ctrl+P','Ctrl+Alt+P; exit','Control+Alt+F25',null])assert.equal(shortcut(value),null);
 let args,reply={verified:true,accepted:true,status:'Playing',method:'netease-shortcut'};const c=new MediaControl({run:(_p,a,_o,cb)=>{args=a;cb(null,JSON.stringify(reply));}});c.configure({shortcut:'Ctrl+Shift+P'});
 assert.equal((await c.execute({action:'play'})).result,'已恢复播放。');assert.equal(args[args.indexOf('-Shortcut')+1],'Control+Shift+P');reply={...reply,status:'Paused'};assert.equal((await c.execute({action:'pause'})).result,'已暂停播放。');reply.already=true;assert.match((await c.execute({action:'pause'})).result,/已暂停，未重复切换/);
 c.configure({shortcut:''});await c.execute({action:'pause'});assert.equal(args[args.indexOf('-Shortcut')+1],'off');assert.throws(()=>c.configure({shortcut:'Space'}),/全局快捷键/);
});
