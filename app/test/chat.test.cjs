'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Chat,parseReply,consumeStream,validateAction}=require('../chat.cjs');
const auth={active:'a',model:'test-model',snapshot:()=>({connected:true}),access:async()=> 'test-only-token'};
function stream(events){return new Response(events.map(e=>'data: '+JSON.stringify(e)+'\r\n\r\n').join(''));}
function completed(text){return stream([{type:'response.output_text.delta',delta:text},{type:'response.completed',response:{status:'completed'}}]);}
test('only supported, well-formed proposed actions survive parsing',()=>{
 const v=parseReply(JSON.stringify({reply:'确认后记下。',actions:[{type:'shell',text:'rm -rf'},{type:'todo',text:'一件事'},{type:'reminder',text:'休息',at:'明天'}]}));assert.equal(v.actions.length,1);assert.equal(v.actions[0].type,'todo');assert.equal(validateAction({type:'reminder',text:'休息',at:'2030-01-01T10:00:00'}),null);
});
test('non-JSON or malformed output creates no executable actions',()=>{assert.deepEqual(parseReply('普通回复').actions,[]);assert.deepEqual(parseReply('{"actions":[{"type":"todo","text":"x"}]}').actions,[]);});
test('SSE parser handles split UTF-8 and CRLF, requires completion',async()=>{
 const bytes=new TextEncoder().encode('data: '+JSON.stringify({type:'response.output_text.delta',delta:'颉：我在。'})+'\r\n\r\ndata: '+JSON.stringify({type:'response.completed',response:{status:'completed'}})+'\r\n\r\n');let pos=0;
 const r=new Response(new ReadableStream({pull(c){if(pos===bytes.length)c.close();else{c.enqueue(bytes.slice(pos,pos+1));pos++;}}}));assert.equal(await consumeStream(r),'颉：我在。');
 await assert.rejects(consumeStream(stream([{type:'response.output_text.delta',delta:'partial'}])),/没有完成/);
 await assert.rejects(consumeStream(stream([{type:'response.incomplete'}])),/没有完成/);
});
test('plan request uses required fields and sends memory plus recent history',async()=>{
 const c=new Chat();c.addMemory('喜欢安静');for(let i=0;i<25;i++)c.append('user','早些的'+i);let request;
 const result=await c.send('记一件事',{auth,context:{links:[]},fetch:async(u,o)=>{request=JSON.parse(o.body);return completed('{"reply":"我在。","actions":[]}');}});
 assert.equal(result.ok,true);assert.equal(request.store,false);assert.equal(request.stream,true);assert.equal(request.input.length,26);assert.match(request.instructions,/喜欢安静/);for(const k of ['conversation','previous_response_id','max_output_tokens','temperature'])assert.ok(!Object.hasOwn(request,k));
});
test('cards require confirmation and cannot execute twice, even concurrently',async()=>{
 const c=new Chat();c.append('assistant','待确认',[{type:'note',title:'一页',text:'内容'}]);const a=c.snapshot().history[0].actions[0];let count=0,resolve;
 const first=c.confirm(a.id,async()=>{count++;await new Promise(r=>resolve=r);return {result:'完成'};});const second=await c.confirm(a.id,()=>{count++;});assert.ok(second.error);resolve();await first;assert.equal(count,1);assert.equal((await c.confirm(a.id,()=>{})).error,'这张卡片已处理或不存在。');
});
test('failed action is retryable and canceled card is not executable',async()=>{
 const c=new Chat();c.append('assistant','待确认',[{type:'todo',text:'事'}]);const id=c.snapshot().history[0].actions[0].id;assert.ok((await c.confirm(id,async()=>({error:'上限'}))).error);assert.equal(c.findAction(id).status,'pending');c.dismiss(id);assert.ok((await c.confirm(id,()=>{})).error);
});
test('only confirming memory cards saves memory; memory survives restart and clearing chat',async()=>{
 const c=new Chat();c.append('assistant','待确认',[{type:'memory',text:'喜欢温婉'}]);assert.equal(c.snapshot().memories.length,0);await c.confirm(c.snapshot().history[0].actions[0].id,()=>{});const restored=new Chat(JSON.parse(JSON.stringify(c.save())));assert.equal(restored.snapshot().memories[0].text,'喜欢温婉');restored.clear();assert.equal(restored.snapshot().history.length,0);assert.equal(restored.snapshot().memories.length,1);
});
test('accounts keep separate history and memory',()=>{const c=new Chat();c.useProfile('account-a');c.addMemory('A');c.append('user','A话');c.useProfile('account-b');assert.equal(c.snapshot().history.length,0);assert.equal(c.snapshot().memories.length,0);c.useProfile('account-a');assert.equal(c.snapshot().memories[0].text,'A');});
test('canceling or switching profiles discards late replies',async()=>{
 const c=new Chat();let resolve;const pending=c.send('在吗',{auth,context:{},fetch:async()=>await new Promise(r=>resolve=r)});await new Promise(r=>setImmediate(r));c.useProfile('another');resolve(completed('{"reply":"迟来的回复","actions":[]}'));await pending;assert.equal(c.snapshot().history.length,0);assert.equal(c.busy,false);
});
test('service failures and limits never manufacture successful replies',async()=>{
 const c=new Chat();const r=await c.send('在吗',{auth,context:{},fetch:async()=>new Response('{}',{status:429})});assert.match(r.error,/使用限制/);assert.equal(c.snapshot().history.filter(h=>h.role==='assistant').length,0);assert.equal(c.busy,false);
});
test('interrupted in-flight action is canceled after restart, not replayed',()=>{
 const c=new Chat();c.append('assistant','待确认',[{type:'todo',text:'一事'}]);c.snapshot().history[0].actions[0].status='running';const restored=new Chat(JSON.parse(JSON.stringify(c.save())));assert.equal(restored.snapshot().history[0].actions[0].status,'canceled');
});
test('memory cap remains while full history is preserved without automatic extra requests',()=>{const c=new Chat();for(let i=0;i<30;i++)assert.equal(c.addMemory('事'+i).ok,true);assert.ok(c.addMemory('第31').error);for(let i=0;i<110;i++)c.append('user','话'+i);assert.equal(c.snapshot().history.length,110);});
