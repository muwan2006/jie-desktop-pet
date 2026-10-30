'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Voice}=require('../voice.cjs'),{Engine}=require('../engine.cjs'),{Chat,parseReply}=require('../chat.cjs');
const {validateCues,segmentsFor,ReplyPerformance}=require('../dialogue.cjs');
const flush=()=>new Promise(setImmediate);
function wav(){const b=Buffer.alloc(44+3200);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(3200,40);return b;}
const result=()=>({status:200,buffer:wav()});
const text='别担心，我陪着你。对了，我想到办法了！晚安。';
const cues=[{quote:'别担心，我陪着你。',reaction:{expression:'comfort'}},{quote:'对了，我想到办法了！',reaction:{expression:'idea'}},{quote:'晚安。',reaction:{expression:'sleepy'}}];
test('sentence cues require exact ordered quotations and safe existing reactions',()=>{
 assert.deepEqual(validateCues(text,[{quote:'不存在',reaction:{expression:'shy'}},...cues,{quote:'晚安。',reaction:{expression:'quit'}}]),cues);
 assert.equal(validateCues(text,[cues[2],cues[0]]).length,1);
 const segments=segmentsFor(text,cues);assert.deepEqual(segments.map(s=>s.reaction.expression),['comfort','idea','sleepy']);assert.equal(segments.map(s=>s.text).join(''),text);
 assert.ok(segmentsFor('长'.repeat(500)).every(s=>s.text.length<=160));assert.ok(segmentsFor(text,cues,null,10).map(s=>s.text).join('').length<=10);
});
test('Markdown or code cannot create a spoken cue absent from cleaned speech',()=>{
 const reply='**别担心**。\n```js\n笑出声\n```\n晚安。',s=segmentsFor(reply,[{quote:'**别担心**',reaction:{expression:'comfort'}},{quote:'笑出声',reaction:{expression:'laugh'}}]);
 assert.equal(s[0].reaction.expression,'comfort');assert.ok(!s.some(v=>v.reaction?.expression==='laugh'));assert.ok(!s.some(v=>v.text.includes('```')));
});
test('GPT cue metadata persists for replay without adding an inference request',async()=>{
 const c=new Chat(),auth={active:'a',model:'test',snapshot:()=>({connected:true}),access:async()=> 'test'};let calls=0,received;
 await c.send('聊一聊',{auth,context:{},fetch:async()=>{calls++;return new Response('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',output:[{content:[{text:JSON.stringify({reply:text,cues,actions:[]})}]}]}})+'\n\n');},onReply:(r,overall,segments)=>received=segments});
 assert.equal(calls,1);assert.deepEqual(received,cues);const restored=new Chat(c.save());assert.deepEqual(restored.data().history.at(-1).cues,cues);assert.equal(restored.data().history.at(-1).text,text);
});
test('voice cues fire only on actual playback start and next sentence is prefetched',async()=>{
 const plays=[],beats=[],requests=[];const v=new Voice({presetGreetings:false,speed:1.2},{request:async(p,r,o)=>{requests.push(o.body);return result();},onAudio:e=>{if(e.type==='play')plays.push(e);}});
 const pending=v.speakSegments(segmentsFor(text,cues),{onSegment:(s,i)=>beats.push([i,s.reaction.expression])});await flush();assert.equal(plays.length,1);assert.equal(beats.length,0);assert.equal(requests.length,2);assert.equal(requests[0].speed_factor,1.2);assert.equal(plays[0].rate,1);
 for(let i=0;i<3;i++){v.playback(plays[i].id,'started');v.playback(plays[i].id,'started');assert.equal(beats.length,i+1);v.playback(plays[i].id,'ended');await flush();}
 assert.equal((await pending).ok,true);assert.deepEqual(beats,[[0,'comfort'],[1,'idea'],[2,'sleepy']]);assert.equal(v.state,'idle');
});
test('stop aborts prefetch and stale audio events cannot affect a replacement',async()=>{
 let release;const plays=[];let count=0;const v=new Voice({presetGreetings:false},{request:async()=>++count===1?result():new Promise(r=>release=r),onAudio:e=>{if(e.type==='play')plays.push(e);}});
 const old=v.speakSegments(segmentsFor(text,cues));await flush();const id=plays[0].id;v.stop();assert.equal((await old).canceled,true);release(result());await flush();assert.equal(plays.length,1);
 const p=v.speakSegments([{text:'新句。',reaction:{expression:'smile'}}]);await flush();release(result());await flush();const current=plays.at(-1).id;v.playback(id,'ended');assert.equal(v.playId,current);v.playback(current,'started');v.playback(current,'ended');await p;
});
test('cached sentence clips play at chosen speed without network requests',async()=>{
 const plays=[];const v=new Voice({speed:.8},{request:()=>{throw Error('network forbidden');},onAudio:e=>{if(e.type==='play')plays.push(e);}});const p=v.speakSegments([{text:'见到你，真好。'}]);await flush();assert.equal(plays[0].preset,true);assert.equal(plays[0].rate,.8);v.playback(plays[0].id,'started');v.playback(plays[0].id,'ended');assert.equal((await p).ok,true);
});
test('a complete recorded multi-sentence greeting stays cached without hiding internal emotion changes',()=>{
 const reply='嗯，我在。慢慢来就好。';assert.equal(segmentsFor(reply).length,1);
 const split=segmentsFor(reply,[{quote:'嗯，我在。',reaction:{expression:'shy'}},{quote:'慢慢来就好。',reaction:{expression:'comfort'}}]);assert.equal(split.length,2);assert.deepEqual(split.map(s=>s.reaction.expression),['shy','comfort']);
});
test('muting or a synthesis error cleans the queue and gives one completion',async()=>{
 const reasons=[];const v=new Voice({presetGreetings:false},{request:async()=>({status:500,buffer:Buffer.from('{}')})});assert.ok((await v.speakSegments([{text:'一句。'}],{onFinish:r=>reasons.push(r)})).error);assert.deepEqual(reasons,['error']);assert.equal(v.sequence,null);
 v.configure({enabled:false});assert.ok((await v.speakSegments([{text:'一句。'}])).error);assert.equal(v.state,'idle');
});
test('silent chat advances by reading cadence and cancel removes future beats',t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});const engine=new Engine({settings:{autoEmotes:false}},1000),voice=new Voice({enabled:false}),beats=[];const p=new ReplyPerformance(engine,voice,{onBeat:(s,i)=>beats.push(i)});
 p.start(text,cues);assert.equal(engine.emote.command,'emote:classic:comfort');assert.equal(engine.performance.mode,'reading');t.mock.timers.tick(2500);assert.equal(engine.emote.command,'emote:classic:surprise');assert.deepEqual(beats,[0,1]);p.cancel();t.mock.timers.tick(100000);assert.deepEqual(beats,[0,1]);assert.equal(engine.performanceActive,false);
});
test('actual audio drives contextual poses and respects manual action and dragging',async()=>{
 const engine=new Engine(),plays=[],voice=new Voice({presetGreetings:false},{request:async()=>result(),onAudio:e=>{if(e.type==='play')plays.push(e);}}),p=new ReplyPerformance(engine,voice);
 p.start(text,cues);await flush();assert.equal(engine.emote,null);voice.playback(plays[0].id,'started');assert.equal(engine.emote.command,'emote:classic:comfort');engine.command('emote:classic:tail');voice.playback(plays[0].id,'ended');await flush();voice.playback(plays[1].id,'started');assert.equal(engine.emote.command,'emote:classic:tail');engine.beginDrag();voice.playback(plays[1].id,'ended');await flush();voice.playback(plays[2].id,'started');assert.equal(engine.emote,null);assert.equal(engine.performance.index,3);p.cancel();assert.equal(engine.performanceActive,false);
});
test('unavailable speech falls back to text while manual replay ignores autoChat opt-out',async()=>{
 const engine=new Engine(),voice=new Voice({autoChat:false,presetGreetings:false},{request:async()=>{throw Object.assign(Error('offline'),{code:'ECONNREFUSED'});}}),p=new ReplyPerformance(engine,voice);
 p.start(text,cues,null,{manualVoice:true});await flush();assert.equal(engine.performance.mode,'reading');assert.equal(engine.emote.command,'emote:classic:comfort');assert.match(voice.error,/未启动/);p.cancel();
});
