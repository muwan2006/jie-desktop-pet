'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {DailyDiary,dayKey,validDay,collectDay,parseEntry}=require('../daily-diary.cjs');
const now=new Date(2026,9,2,22,5).getTime(),day=dayKey(now),yesterday=dayKey(now-24*3600000);
const history=[{role:'user',text:'今天想画一张图。',at:now-1000},{role:'assistant',text:'慢慢画，我陪着你。',at:now-500},{role:'user',text:'昨天的私事',at:now-24*3600000}];
const source=collectDay(day,{history,journal:[{at:now-2000,text:'与颉一起读书。'}],daily:{[day]:{count:1,minutes:25}}},now),auth={active:'a',model:'qa-model',snapshot:()=>({connected:true}),access:async()=> 'mock'};
const sse=value=>new Response('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',output:[{content:[{text:JSON.stringify(value)}]}]}})+'\n\n');
const entry={title:'一页新的念头',text:'今日你提到想画一张图。我陪你读了一会儿书，也记下了那一段专注。'};
test('local dates filter the actual day, exclude future records and bound only model context, not saved history',()=>{
 assert.equal(validDay('2026-02-30'),false);assert.equal(validDay(day),true);assert.throws(()=>collectDay('2099-01-01',{},now));
 assert.equal(source.messages.length,2);assert.equal(source.events.length,1);assert.deepEqual(source.focus,{count:1,minutes:25});assert.ok(!JSON.stringify(source).includes('昨天的私事'));
 assert.equal(collectDay(day,{history:[{role:'user',text:'未来',at:now+1000}]},now).hasContent,false);
 const long=Array.from({length:300},(_,i)=>({role:'user',text:String(i)+'句'.repeat(500),at:now-i}));const limited=collectDay(day,{history:long},now);assert.equal(limited.partial,true);assert.ok(limited.messages.reduce((n,m)=>n+m.text.length,0)<=32000);assert.equal(long.length,300);
});
test('generation uses the selected account, role card and bounded sources, persists separately from chat',async()=>{
 const d=new DailyDiary();let request,calls=0;const r=await d.generate(day,{auth,source,card:{name:'颉',text:'温柔但有分寸'},now,fetch:async(u,o)=>{calls++;request=JSON.parse(o.body);return sse(entry);}});
 assert.equal(r.ok,true);assert.equal(calls,1);assert.equal(request.model,'qa-model');assert.equal(request.store,false);assert.match(request.instructions,/温柔但有分寸/);assert.deepEqual(JSON.parse(request.input[0].content),source);assert.equal(history.length,3);
 const saved=new DailyDiary(JSON.parse(JSON.stringify(d.save())));assert.equal(saved.snapshot().entries[0].text,entry.text);assert.equal(saved.snapshot().entries[0].date,day);
});
test('blank and malformed generated entries fail without overwriting the original; no facts means no request',async()=>{
 const d=new DailyDiary();assert.throws(()=>parseEntry('{"actions":[{"type":"open_link"}]}'));
 let calls=0;const options={auth,source,card:{},now,fetch:async()=>{calls++;return sse(entry);}};await d.generate(day,options);
 const fail=await d.generate(day,{...options,force:true,fetch:async()=>sse({text:''})});assert.ok(fail.error);assert.equal(d.snapshot().entries[0].text,entry.text);
 const empty=await d.generate(yesterday,{...options,source:collectDay(yesterday,{},now)});assert.ok(empty.error);assert.equal(calls,1);
});
test('manual edits and previous revisions survive restart and automatic writing never overwrites them',async()=>{
 const d=new DailyDiary(),options={auth,source,card:{},now,fetch:async()=>sse(entry)};await d.generate(day,options);assert.equal(d.update(day,{title:'我改过的标题',text:'我想留住的文字。'},now+1).ok,true);
 const restored=new DailyDiary(d.save());let calls=0;await restored.autoTick({auth,fetch:async()=>{calls++;return sse(entry);},sourceFor:date=>date===day?source:collectDay(yesterday,{},now),card:{},now});assert.equal(calls,0);assert.equal(restored.snapshot().entries[0].text,'我想留住的文字。');
 assert.equal(restored.restore(day).ok,true);assert.equal(restored.snapshot().entries[0].text,entry.text);restored.remove(day);await restored.autoTick({auth,fetch:async()=>{calls++;return sse(entry);},sourceFor:d=>d===day?source:collectDay(yesterday,{},now),card:{},now});assert.equal(calls,0);
});
test('automatic schedule writes once when quiet, handles yesterday and respects disabled settings',async()=>{
 const d=new DailyDiary();let calls=0;const options={auth,card:{},now,sourceFor:d=>d===day?source:collectDay(yesterday,{},now),fetch:async()=>{calls++;return sse(entry);}};
 await d.autoTick({...options,quiet:false});assert.equal(calls,0);await d.autoTick(options);await d.autoTick(options);assert.equal(calls,1);assert.equal(d.snapshot().entries[0].automatic,true);
 const missed=new DailyDiary();await missed.autoTick({...options,now:new Date(2026,9,3,9).getTime(),sourceFor:date=>collectDay(date,{history},now+24*3600000)});assert.equal(missed.snapshot().entries[0].date,day);
 const off=new DailyDiary();off.configure({automatic:false});await off.autoTick(options);assert.equal(off.snapshot().entries.length,0);assert.ok(off.configure({time:'25:00'}).error);
});
test('automatic failures back off and stop after three tries, but manual retry remains available',async()=>{
 const d=new DailyDiary();let calls=0;const options={auth,card:{},sourceFor:date=>date===day?source:collectDay(yesterday,{},now),fetch:async()=>{calls++;throw TypeError('offline');}};
 for(const minutes of [0,1,16,32,48])await d.autoTick({...options,now:now+minutes*60000});assert.equal(calls,3);assert.equal(d.snapshot().entries.length,0);
 const r=await d.generate(day,{auth,source,card:{},now,fetch:async()=>sse(entry)});assert.equal(r.ok,true);
});
test('stop and profile changes discard late generation while preserving other accounts and their entries',async()=>{
 const d=new DailyDiary();let release;const pending=d.generate(day,{auth,source,card:{},now,fetch:async()=>new Promise(r=>release=r)});while(!release)await new Promise(setImmediate);d.useProfile('b');release(sse(entry));await pending;assert.equal(d.snapshot().entries.length,0);d.useProfile('local');assert.equal(d.snapshot().entries.length,0);
 await d.generate(day,{auth,source,card:{},now,fetch:async()=>sse(entry)});d.useProfile('b');assert.equal(d.snapshot().entries.length,0);d.useProfile('local');assert.equal(d.snapshot().entries.length,1);
 let finish;const retry=d.generate(day,{auth,source,card:{},now,force:true,fetch:async()=>new Promise(r=>finish=r)});while(!finish)await new Promise(setImmediate);d.cancel();finish(sse({text:'不该覆盖'}));await retry;assert.equal(d.snapshot().entries[0].text,entry.text);
});
test('diary authentication renews once, and concurrent generation and conflicting edits are refused',async()=>{
 const d=new DailyDiary();let calls=0,renew=0;await d.generate(day,{auth:{...auth,access:async fresh=>{if(fresh)renew++;return 'mock';}},source,card:{},now,fetch:async()=>++calls===1?new Response('',{status:401}):sse(entry)});assert.equal(calls,2);assert.equal(renew,1);
 let release;const pending=d.generate(day,{auth,source,card:{},now,force:true,fetch:async()=>new Promise(r=>release=r)});while(!release)await new Promise(setImmediate);assert.ok(d.update(day,{text:'冲突修改'}).error);assert.ok((await d.generate(day,{auth,source,card:{},now,fetch:async()=>sse(entry)})).error);d.cancel();release(sse(entry));await pending;
});
