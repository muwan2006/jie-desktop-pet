'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Chat}=require('../chat.cjs');
const auth={active:'a',model:'test',snapshot:()=>({connected:true}),access:async()=> 'token'};
const answer=(reply,continuity)=>new Response('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',output:[{content:[{text:JSON.stringify({reply,continuity,actions:[]})}]}]}})+'\n\n');
test('rolling context and entire transcript survive restart without manual memory cards',async()=>{
 const c=new Chat();c.useProfile('a');const id=c.data().conversationId;
 await c.send('我叫小林，周五交画稿',{auth,context:{},fetch:async()=>answer('记得啦','用户叫小林；周五交画稿。')});
 for(let i=0;i<250;i++){c.append('user','另一件事 '+i);c.append('assistant','好的 '+i);}
 const restarted=new Chat(JSON.parse(JSON.stringify(c.save())));restarted.useProfile('a');let request;
 await restarted.send('我之前说什么时候交稿？',{auth,context:{},fetch:async(u,o)=>{request=JSON.parse(o.body);return answer('周五','用户叫小林；周五交画稿。');}});
 assert.equal(restarted.data().conversationId,id);assert.equal(restarted.data().history.length,504);assert.equal(restarted.data().memories.length,0);assert.match(request.instructions,/周五交画稿/);assert.ok(request.input.length<=121);
 assert.equal(restarted.snapshot().history.length,120);restarted.moreHistory();assert.equal(restarted.snapshot().history.length,240);
});
test('account contexts remain independent and clearing resets summary and thread, not confirmed memory',()=>{
 const c=new Chat();c.useProfile('a');c.data().continuity='A facts';c.addMemory('长期事项');const id=c.data().conversationId;c.useProfile('b');assert.equal(c.data().continuity,'');c.useProfile('a');c.clear();assert.equal(c.data().continuity,'');assert.notEqual(c.data().conversationId,id);assert.equal(c.data().memories[0].text,'长期事项');
});
test('canceled or failed response cannot overwrite continuous context',async()=>{
 const c=new Chat();c.data().continuity='old';let release;const r=c.send('测试',{auth,context:{},fetch:async()=>new Promise(resolve=>release=resolve)});await new Promise(setImmediate);c.cancel();release(answer('late','new'));await r;assert.equal(c.data().continuity,'old');
 await c.send('测试',{auth,context:{},fetch:async()=>new Response('{}',{status:503})});assert.equal(c.data().continuity,'old');
});
test('attachments are transmitted as actual multimodal content, retained on next turn and after restart',async()=>{
 const c=new Chat(),image={id:'image-1',kind:'image',name:'截图.png',size:100},pdf={id:'file-1',kind:'pdf',name:'资料.pdf',size:100};let request,accepted=0;
 const content=a=>a.kind==='image'?{type:'input_image',image_url:'data:image/png;base64,AA=='}:{type:'input_file',filename:a.name,file_data:'data:application/pdf;base64,AA=='};
 await c.send('',{auth,context:{},attachments:[image,pdf],attachmentContent:content,onAccepted:()=>accepted++,fetch:async(u,o)=>{request=JSON.parse(o.body);return answer('看到附件了','截图和资料已讨论');}});
 assert.equal(accepted,1);assert.deepEqual(request.input[0].content.map(p=>p.type),['input_text','input_image','input_file']);
 const r=new Chat(JSON.parse(JSON.stringify(c.save())));await r.send('那你再看看截图',{auth,context:{},attachmentContent:content,fetch:async(u,o)=>{request=JSON.parse(o.body);return answer('好的','已讨论截图');}});assert.equal(request.input[0].content[1].type,'input_image');assert.equal(r.data().history[0].attachments[1].name,'资料.pdf');
});
test('a rejected send keeps draft attachments and does not append a message',async()=>{
 const c=new Chat();let accepted=false;await assert.rejects(c.send('',{auth:{...auth,model:''},attachments:[{id:'x'}],onAccepted:()=>accepted=true}),/模型/);assert.equal(accepted,false);assert.equal(c.data().history.length,0);
});
test('a 401 refreshes the login once and retries the same request without duplicating history',async()=>{
 const c=new Chat();let calls=0,forced=0;const result=await c.send('你好',{auth:{...auth,access:async(force)=>{if(force)forced++;return force?'new':'old';}},context:{},fetch:async(u,o)=>{calls++;return calls===1?new Response('{}',{status:401}):answer('你好','你好');}});assert.equal(result.ok,true);assert.equal(forced,1);assert.equal(calls,2);assert.equal(c.data().history.length,2);
});
test('context byte window is bounded while archived text can be found again',async()=>{
 const c=new Chat();c.append('user','我订的旅行目的地是苏州，行程已定。');for(let i=0;i<180;i++)c.append(i%2?'assistant':'user','其他内容'.repeat(1000));let request;
 await c.send('苏州旅行还有印象吗？',{auth,context:{},fetch:async(u,o)=>{request=JSON.parse(o.body);return answer('苏州','旅行目的地苏州');}});
 assert.match(request.input[0].content,/目的地是苏州/);assert.ok(JSON.stringify(request.input).length<70000);assert.equal(c.data().history.length,183);
});
