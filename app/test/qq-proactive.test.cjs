'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {QQRuntime}=require('../qq-runtime.cjs'),S=require('../qq-state.cjs'),{prompt}=require('../qq-conversation.cjs');
const OWNER='1234567890',BOT='1122334455',GROUP='998877665';
function fixture(t,extra={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'jie-proactive-'));let now=new Date(2026,9,10,1).getTime(),account='test',allow=true,can=true;const generated=[],sent=[];
 const h={directory,now:()=>now,account:()=>account,storage:{isEncryptionAvailable:()=>false},transport:{connected:true,stop(){},clean:String,async request(action,params){sent.push({action,params});return {message_id:sent.length};}},saved:{settings:{mergeWait:0,mergeWait:0,enabled:true,owner:OWNER,groups:[GROUP],voiceMode:'text',groupMode:'natural',multiTopics:false,proactive:true,groupGap:30,quietStart:23,quietEnd:8}},allowProactive:()=>allow,canReply:()=>can,generate:async v=>{generated.push(v);return {text:'关于线索'+v.identity.id+'，这一步倒有意思，我也想听听你们的打算。',summary:'在群里一起讨论。'};},...extra};
 const q=new QQRuntime(h);q.self=BOT;q.ready=true;t.after(()=>{q.stop();fs.rmSync(directory,{recursive:true,force:true});});
 const receive=(id,text='这个谜题的线索又对不上了。',segments=[])=>q.receive({post_type:'message',self_id:BOT,user_id:OWNER,message_type:'group',group_id:GROUP,message_id:id,time:Math.floor(now/1000),sender:{nickname:'群员'},message:[{type:'text',data:{text}},...segments]},now);
 const settle=async()=>{for(let i=0;i<100&&(q.busy||q.queue.length);i++)await new Promise(r=>setImmediate(r));assert.equal(q.busy,false);};
 return {q,h,generated,sent,receive,settle,advance:ms=>now+=ms,clock:()=>now,setAccount:v=>account=v,setAllow:v=>allow=v,setCan:v=>can=v};
}
test('ordinary non-mentioned group message generates a persona reply during former quiet hours',async t=>{
 const f=fixture(t);f.receive(1);assert.equal(f.generated.length,0);f.advance(2000);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,1);assert.equal(f.generated[0].proactive,true);assert.deepEqual(f.generated[0].context,{});assert.equal(f.generated[0].identity.mention,false);assert.equal(f.sent[0].action,'send_group_msg');assert.equal(f.sent[0].params.group_id,Number(GROUP));assert.ok(!Object.hasOwn(f.q.saveData().settings,'quietStart'));
});
test('continuous group messages coalesce without resetting the initial response deadline',async t=>{
 const f=fixture(t);f.receive(1,'第一个线索');f.advance(900);f.receive(2,'第二个线索');f.advance(900);f.receive(3,'最新线索');f.advance(200);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,1);assert.equal(f.generated[0].identity.id,'3');assert.equal(f.generated[0].conversation.history.filter(v=>v.role==='user').length,3);assert.equal(f.q.groupPending.size,0);
});
test('message during cooldown is retained and considered when interval ends without another message',async t=>{
 const f=fixture(t);f.receive(1);f.advance(2000);f.q.tick(f.clock());await f.settle();f.advance(1000);f.receive(2,'换一个话题：这招怎么解？');f.advance(2000);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,1);assert.equal(f.q.groupPending.size,1);assert.match(f.q.snapshot().conversations[0].participation,/等待接话/);f.advance(26999);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,1);f.advance(1);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,2);assert.equal(f.generated[1].identity.id,'2');assert.equal(f.q.groupPending.size,0);
});
test('a long configured cooldown does not revive stale topics after ten minutes',async t=>{
 const f=fixture(t);f.q.settings.groupGap=600;f.receive(1);f.advance(2000);f.q.tick(f.clock());await f.settle();f.advance(1000);f.receive(2,'这是刚才讨论的话题。');f.advance(301000);f.q.tick(f.clock());await f.settle();assert.equal(f.q.groupPending.size,0);assert.equal(f.generated.length,1);f.advance(298000);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,1);f.receive(3,'现在开始新的讨论。');f.advance(2000);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,2);assert.equal(f.generated[1].identity.id,'3');
});
test('a group waiting on its own cooldown does not suppress an eligible private follow-up',async t=>{
 const f=fixture(t);const privateSession=f.q.session({type:'private',target:OWNER});privateSession.history=[{role:'user',text:'今晚赶稿。',sender:OWNER}];privateSession.lastUser=f.clock()-3*3600000;const group=f.q.session({type:'group',target:GROUP});group.lastReply=f.clock();f.receive(1);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,1);assert.equal(f.generated[0].identity.type,'private');assert.equal(f.q.groupPending.size,1);
});
test('chat or call temporarily blocking replies defers rather than discards latest group message',async t=>{
 const f=fixture(t);f.setCan(false);f.setAllow(false);f.receive(1);f.advance(3000);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,0);assert.match(f.q.snapshot().conversations[0].participation,/稍后接话/);f.setCan(true);f.setAllow(true);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,1);
});
test('being called supersedes a pending natural reply and does not send it again',async t=>{
 const f=fixture(t);f.receive(1);f.advance(1000);f.receive(2,'颉，你怎么看？');await f.settle();assert.equal(f.generated.length,1);assert.equal(f.generated[0].proactive,false);assert.equal(f.q.groupPending.size,0);f.advance(60000);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,1);
});
test('messages arriving while generation runs wait for cooldown and use latest speaker turn',async t=>{
 let release;const f=fixture(t);const generate=f.h.generate;f.h.generate=v=>new Promise(r=>{f.generated.push(v);release=r;});f.receive(1);f.advance(2000);f.q.tick(f.clock());for(let i=0;!release&&i<20;i++)await new Promise(r=>setImmediate(r));assert.equal(typeof release,'function');f.receive(2,'刚才的线索有误');f.advance(1000);f.receive(3,'现在换成这条线索了');release({text:'我先听你们说。'});await f.settle();f.h.generate=generate;f.advance(30000);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,2);assert.equal(f.generated[1].identity.id,'3');
});
test('model decline is visible, does not send, and the next fresh topic can be considered',async t=>{
 const f=fixture(t);f.q.session({type:'group',target:GROUP}).summary='长期背景仍保留。';f.h.generate=async v=>{f.generated.push(v);return {skip:true,reason:'这段讨论已经结束。',summary:'话题暂时结束。'};};f.receive(1);f.advance(2000);f.q.tick(f.clock());await f.settle();assert.equal(f.sent.length,0);assert.match(f.q.snapshot().conversations[0].participation,/本轮无需接话/);assert.ok(f.q.logs.some(v=>v.type==='skipped'&&v.text.includes('讨论已经结束')));const stored=f.q.session({type:'group',target:GROUP});assert.equal(stored.summary,'长期背景仍保留。');assert.equal(stored.topicSummaries['1'],'话题暂时结束。');f.advance(31000);f.receive(2,'新话题：这个小游戏怎么玩？');f.advance(2000);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,2);
});
test('group participation is not silently capped at twelve successful or skipped attempts an hour',async t=>{
 const f=fixture(t);for(let i=1;i<=15;i++){f.receive(i);f.advance(2000);f.q.tick(f.clock());await f.settle();f.advance(30000);}assert.equal(f.generated.length,15);assert.equal(f.sent.length,15);
});
test('mention-only mode and proactive opt-out cancel waiting group activity but retain direct replies',async t=>{
 const f=fixture(t);f.receive(1);f.q.settings.groupMode='mention';f.advance(3000);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,0);assert.equal(f.q.groupPending.size,0);f.q.settings.groupMode='natural';f.receive(2);f.q.settings.proactive=false;f.advance(3000);f.q.tick(f.clock());await f.settle();assert.equal(f.q.groupPending.size,0);f.receive(3,'颉，解释一下');await f.settle();assert.equal(f.generated.length,1);
});
test('account switches, expired messages and disconnect discard pending group references',async t=>{
 const f=fixture(t);f.receive(1);f.setAccount('other');f.advance(3000);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,0);assert.equal(f.q.groupPending.size,0);f.receive(2);f.advance(300001);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,0);f.receive(3);f.q.disconnected();assert.equal(f.q.groupPending.size,0);assert.equal(f.q.debounce.size,0);
});
test('pure group image also reaches vision as natural participation without mention',async t=>{
 const f=fixture(t,{images:async()=>({inputs:[{type:'input_image',image_url:'data:image/png;base64,fixture'}],errors:[]})});f.receive(1,'',[{type:'image',data:{file:'group-image'}}]);f.advance(2000);f.q.tick(f.clock());await f.settle();assert.equal(f.generated.length,1);assert.equal(f.generated[0].imageRows.length,1);assert.equal(f.generated[0].identity.ownerPrivate,false);assert.ok(!JSON.stringify(f.q.saveData()).includes('data:image'));
});
test('natural participation prompt permits joining without invitation and retains locked role card',()=>{
 const card={text:'颉的完整既定人设'};const p=prompt(card,{type:'group'},{},'',true);assert.ok(p.includes(JSON.stringify(card)));assert.ok(p.includes('不需要被@、叫名字或再次邀请'));assert.ok(!p.includes('别人没有邀请参与时返回skip:true'));assert.ok(p.includes('轻巧的调侃'));assert.ok(p.includes('ownerPrivate=true'));
});
