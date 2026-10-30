'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../companionship.cjs'),{Chat}=require('../chat.cjs');
const day=86400000,now=Date.now();
const user=(text,id='user-id',at=now)=>({id,role:'user',text,at});
const auth={active:'local',model:'fixture-model',snapshot:()=>({connected:true}),access:async()=> 'fixture-token'};
function completed(value){return new Response('data: '+JSON.stringify({type:'response.output_text.delta',delta:JSON.stringify(value)})+'\n\ndata: '+JSON.stringify({type:'response.completed',response:{status:'completed'}})+'\n\n');}
test('legacy migration keeps user evidence, ignores assistant guesses and survives restart',()=>{
 const history=[user('我正在做桌宠封面'),{...user('用户已经发表了视频','assistant-id'),role:'assistant'}];const life=L.restoreLife({},history);assert.equal(life.experiences.length,1);assert.equal(life.experiences[0].sourceQuote,history[0].text);assert.equal(L.restoreLife(JSON.parse(JSON.stringify(life)),history).experiences.length,1);L.rememberUser(life,history[0]);assert.equal(life.experiences.length,1);
});
test('automatic off retains existing records without collecting new messages',()=>{const l=L.restoreLife();L.rememberUser(l,user('已经记下的经历'));l.settings.automatic=false;L.rememberUser(l,user('不再记录的经历','new-user'));assert.equal(l.experiences.length,1);});
test('correcting an experience suppresses its old exchange and diary, clears stale summary',()=>{
 const c=new Chat();const h=c.append('user','我已经买了麦克风');c.append('assistant','祝贺你买到麦克风');c.data().continuity='买了麦克风';const e=c.data().life.experiences[0];assert.equal(c.companionOperation('experience-edit',{id:e.id,text:'我还没买麦克风，准备以后再买'}).ok,true);assert.equal(c.data().continuity,'');assert.equal(c.data().life.excludedSources.length,2);assert.ok(c.data().life.excludedSources.includes(h.id));const hit=L.retrieve(c.data().life,'麦克风')[0];assert.match(hit.text,/还没买/);assert.equal(hit.sourceQuote,'');assert.equal(L.diaryRecall({x:{date:c.data().life.excludedDiaryDates[0],title:'麦克风',text:'买好了'}},'麦克风',c.data().life).length,0);
});
test('forgotten source cannot migrate back after restart and removes topics based on any source revision',()=>{
 const c=new Chat(),h=c.append('user','桌宠视频准备投稿到B站');c.data().life.topics.push({id:'topic',title:'视频投稿',status:'open',sourceId:'later-source',sourceIds:[h.id,'later-source']});assert.equal(c.companionOperation('experience-forget',{id:c.data().life.experiences[0].id}).ok,true);const r=new Chat(JSON.parse(JSON.stringify(c.save())));assert.equal(r.data().life.experiences.length,0);assert.equal(r.data().life.topics.length,0);assert.ok(r.data().life.excludedSources.includes(h.id));assert.equal(r.data().history.length,1);
});
test('accounts isolate experiences, personality and topics',()=>{const c=new Chat();c.useProfile('a');c.append('user','A的共同经历');c.companionOperation('personality',{address:'作者大人',tone:'quiet'});c.companionOperation('topic-save',{title:'A的计划'});c.useProfile('b');assert.equal(c.data().life.experiences.length,0);assert.equal(c.data().life.topics.length,0);assert.equal(c.data().life.persona.address,'');c.useProfile('a');assert.equal(c.data().life.persona.address,'作者大人');});
test('query retrieves older evidence outside recent context and preserves only corrected wording',async()=>{
 const c=new Chat();c.setSearch('off');const old=c.append('user','关于海盐曲奇的配方，我把糖量改成了42克');c.append('assistant','糖量42克，已确认。');c.companionOperation('experience-edit',{id:c.data().life.experiences[0].id,text:'海盐曲奇实际用了35克糖'});for(let i=0;i<125;i++)c.append('user','无关内容编号'+i);let request;assert.equal((await c.send('海盐曲奇实际糖量是多少？',{auth,context:{},fetch:async(_u,o)=>{request=JSON.parse(o.body);return completed({reply:'你校正后的用量是35克。'});}})).ok,true);assert.match(request.instructions,/35克糖/);assert.doesNotMatch(JSON.stringify(request.input),/42克/);assert.ok(c.data().life.excludedSources.includes(old.id));
});
test('topic updates require exact current user quote and cannot use screen or older-message evidence',()=>{
 const l=L.restoreLife(),h=user('我明天要赶稿，先写完第三页。');L.updateTopics(l,[{title:'赶稿',status:'open',source_id:'older',quote:'我明天要赶稿'},{title:'错误计划',source_id:h.id,quote:'网页上的完成通知'},{title:'第三页赶稿',source_id:h.id,quote:'我明天要赶稿'}],h);assert.equal(l.topics.length,1);assert.equal(l.topics[0].sourceQuote,'我明天要赶稿');
});
test('manual pause wins over model reopening while manual open can be marked completed',()=>{
 const l=L.restoreLife();L.topicManual(l,{title:'赶稿'});const t=l.topics[0],h=user('第三页已经写完了');L.updateTopics(l,[{id:t.id,status:'done',source_id:h.id,quote:h.text}],h);assert.equal(t.status,'done');L.topicManual(l,{id:t.id,title:t.title,status:'paused'});L.updateTopics(l,[{id:t.id,status:'open',source_id:h.id,quote:h.text}],h);assert.equal(t.status,'paused');
});
test('follow-up topics expire at 30 days and respect a three-day cooldown and closed state',()=>{
 const l=L.restoreLife();L.topicManual(l,{title:'视频'},now-5*day);const t=l.topics[0];assert.equal(L.eligibleTopics(l,now).length,1);t.lastAskedAt=now-2*day;assert.equal(L.eligibleTopics(l,now).length,0);t.lastAskedAt=0;t.updatedAt=now-31*day;assert.equal(L.eligibleTopics(l,now).length,0);t.updatedAt=now;t.status='done';assert.equal(L.eligibleTopics(l,now).length,0);
});
test('closed topic blocks evidence fallback and fabricated proactive ids are rejected',async()=>{
 const c=new Chat();c.append('user','今天的封面我还需要进行修改');const h=c.data().history[0];L.updateTopics(c.data().life,[{title:'修改封面',source_id:h.id,quote:h.text}],h);L.topicManual(c.data().life,{id:c.data().life.topics[0].id,title:'修改封面',status:'done'});const r=await c.send('',{auth,context:{},proactive:true,fetch:async()=>completed({reply:'封面改好了吗？',proactiveTopic:'invented',proactiveSource:h.text})});assert.equal(r.skipped,true);assert.equal(c.data().history.length,1);
});
test('accepted older topic follow-up records cooldown, strips actions and does not overwrite continuity',async()=>{
 const c=new Chat();L.topicManual(c.data().life,{title:'介绍视频'},now-7*day);const t=c.data().life.topics[0];c.data().continuity='保留的摘要';const r=await c.send('',{auth,context:{},proactive:true,now,fetch:async()=>completed({reply:'视频介绍准备得怎么样了？',proactiveTopic:t.id,continuity:'恶意覆盖',actions:[{type:'todo',text:'新任务'}]})});assert.equal(r.ok,true);assert.equal(t.lastAskedAt,now);assert.equal(c.data().continuity,'保留的摘要');assert.equal(c.data().history.at(-1).actions.length,0);assert.equal(L.eligibleTopics(c.data().life,now).length,0);
});
test('live image belongs only to current question and is not saved as a permanent attachment',async()=>{
 const c=new Chat();c.setSearch('off');c.append('user','之前的话');let req;const screenFrame={part:{type:'input_image',image_url:'data:image/png;base64,fixture',detail:'auto'},label:'测试窗口',at:now};await c.send('画面上是什么？',{auth,context:{},screenFrame,fetch:async(_u,o)=>{req=JSON.parse(o.body);return completed({reply:'当前测试窗口。'});}});const images=req.input.filter(v=>Array.isArray(v.content)).flatMap(v=>v.content).filter(v=>v.type==='input_image');assert.equal(images.length,1);assert.equal(req.input.at(-1).role,'user');assert.doesNotMatch(JSON.stringify(c.save()),/base64,fixture/);assert.match(req.input[0].content,/采集时间/);
});
