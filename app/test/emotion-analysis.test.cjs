'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Chat}=require('../chat.cjs'),{splitSpeech,segmentsFor,validateBeats,ReplyPerformance}=require('../dialogue.cjs');
const {Engine}=require('../engine.cjs'),{Voice}=require('../voice.cjs');
const text='自然喜欢。你在意我的感受，这比只挑一个漂亮外形更叫人高兴。往后就在桌面上陪你了——只是严肃起来时，可别还当我是好欺负的。';
const beats=[{index:0,reaction:{expression:'smile'}},{index:1,reaction:{expression:'shy',gesture:'nod'}},{index:2,reaction:{expression:'serious'}}];
const auth={active:'a',model:'test',snapshot:()=>({connected:true}),access:async()=> 'mock-token'};
const sse=value=>new Response('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',output:[{content:[{text:JSON.stringify(value)}]}]}})+'\n\n');
test('missing emotion metadata gets a separate semantic pass without changing or duplicating the reply',async()=>{
 const chat=new Chat();let calls=0,received;
 assert.equal((await chat.send('喜欢吗？',{auth,context:{},fetch:async(u,o)=>{
  const request=JSON.parse(o.body);calls++;if(calls===1)return sse({reply:text,actions:[]});
  assert.equal(request.model,'test');assert.equal(request.store,false);
  assert.deepEqual(JSON.parse(request.input[0].content).segments,splitSpeech(text).map((s,index)=>({index,text:s.text})));
  return sse({beats});
 },onReply:(reply,reaction,cues,b)=>received={reply,b}})).ok,true);
 assert.equal(calls,2);assert.equal(received.reply,text);assert.deepEqual(received.b,beats);
 assert.deepEqual(segmentsFor(text,[],null,6000,received.b).map(s=>s.reaction.expression),['smile','shy','serious']);
 assert.equal(chat.data().history.length,2);assert.match(chat.data().history.at(-1).emotionStatus,/3/);
 assert.deepEqual(new Chat(chat.save()).data().history.at(-1).beats,beats);
});
test('one sparse cue still requires coverage, while a fully tagged neutral answer does not rotate faces',async()=>{
 let calls=0;const chat=new Chat(),neutral=beats.map(b=>({index:b.index,reaction:null}));
 await chat.send('说明一下',{auth,context:{},fetch:async()=>++calls===1?sse({reply:text,cues:[{quote:'自然喜欢。',reaction:{expression:'smile'}}]}):sse({beats:neutral})});
 assert.equal(calls,2);assert.ok(segmentsFor(text,[],{expression:'smile'},6000,neutral).every(s=>s.reaction===null));
 const second=new Chat();calls=0;await second.send('再讲一遍',{auth,context:{},fetch:async()=>{calls++;return sse({reply:text,beats:neutral});}});assert.equal(calls,1);
});
test('unsafe, duplicate, missing and out-of-range classifier tags do not manufacture successful analysis',async()=>{
 assert.deepEqual(validateBeats(text,[{index:-1,reaction:{expression:'shy'}},{index:0,reaction:{expression:'quit'}},{index:1,reaction:{expression:'shy'}},{index:1,reaction:null},{index:99,reaction:null}]),[{index:1,reaction:{expression:'shy'}}]);
 const chat=new Chat();let calls=0,played=0;
 const r=await chat.send('聊聊',{auth,context:{},fetch:async()=>++calls===1?sse({reply:text}):sse({beats:[beats[0]]}),onReply:()=>played++});
 assert.equal(r.ok,true);assert.equal(played,1);assert.equal(chat.data().history.at(-1).text,text);assert.deepEqual(chat.data().history.at(-1).beats,[]);assert.match(chat.data().history.at(-1).emotionStatus,/没完成/);
});
test('stopping during classification retains the displayed answer and suppresses a late performance',async()=>{
 const chat=new Chat();let release,calls=0,played=0;const pending=chat.send('聊聊',{auth,context:{},fetch:async()=>++calls===1?sse({reply:text}):new Promise(r=>release=r),onReply:()=>played++});
 while(!release)await new Promise(setImmediate);assert.equal(chat.snapshot().analyzing,true);assert.equal(chat.data().history.at(-1).text,text);chat.cancel();release(sse({beats}));await pending;
 assert.equal(played,0);assert.equal(chat.snapshot().busy,false);assert.equal(chat.snapshot().analyzing,false);assert.deepEqual(chat.data().history.at(-1).beats,[]);assert.match(chat.data().history.at(-1).emotionStatus,/已停止/);
});
test('changing accounts during semantic analysis cannot start an old answer in the new profile',async()=>{
 const chat=new Chat();let release,calls=0,played=0;const pending=chat.send('聊聊',{auth,context:{},fetch:async()=>++calls===1?sse({reply:text}):new Promise(r=>release=r),onReply:()=>played++});
 while(!release)await new Promise(setImmediate);chat.useProfile('another');release(sse({beats}));await pending;
 assert.equal(played,0);assert.equal(chat.snapshot().history.length,0);chat.useProfile('local');assert.match(chat.data().history.at(-1).emotionStatus,/已停止/);
});
test('reanalyzing an existing reply updates replay metadata without creating a new conversation turn',async()=>{
 const chat=new Chat();chat.append('assistant',text);let calls=0,played;
 await chat.reanalyze({auth,fetch:async()=>{calls++;return sse({beats});},onReply:(r,overall,cues,b)=>played=b});
 assert.equal(calls,1);assert.equal(chat.data().history.length,1);assert.deepEqual(played,beats);
});
test('classifier authentication retry preserves one reply, and an offline classifier preserves fallback',async()=>{
 const chat=new Chat();let calls=0,refreshes=0;const account={...auth,access:async fresh=>{if(fresh)refreshes++;return 'mock-token';}};
 await chat.send('聊聊',{auth:account,context:{},fetch:async()=>{calls++;return calls===1?sse({reply:text}):calls===2?new Response('',{status:401}):sse({beats});}});
 assert.equal(calls,3);assert.equal(refreshes,1);assert.equal(chat.data().history.length,2);assert.deepEqual(chat.data().history.at(-1).beats,beats);
 const offline=new Chat();calls=0;await offline.send('聊聊',{auth,context:{},fetch:async()=>{if(++calls===1)return sse({reply:text});throw TypeError('offline');}});assert.match(offline.data().history.at(-1).emotionStatus,/没完成/);assert.equal(offline.error,'');
});
test('indexed tags replay in both forms, respect voice truncation, and dragging keeps the whole reply active',t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
 for(const form of ['classic','desk']){const engine=new Engine({settings:{form,autoEmotes:false}},1000),p=new ReplyPerformance(engine,new Voice({enabled:false}));
  p.start(text,[],null,{beats});assert.equal(engine.emote.command,'emote:'+form+':smile');engine.beginDrag();assert.equal(engine.snapshot().performanceActive,true);engine.endDrag();t.mock.timers.tick(2300);assert.equal(engine.emote,null);assert.equal(engine.snapshot().bodyMotion.id,'landing');t.mock.timers.tick(200);engine.tick(Date.now(),{x:0,y:0},{x:0,y:0,width:1920,height:1080},{width:300,height:400});assert.equal(engine.emote.command,'emote:'+form+':shy');p.cancel();assert.equal(engine.snapshot().performanceActive,false);
 }
 assert.equal(segmentsFor(text,[],null,8,beats).length,2);assert.deepEqual(segmentsFor(text,[],null,8,beats).map(s=>s.reaction.expression),['smile','shy']);
});
