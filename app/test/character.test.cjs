'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Chat}=require('../chat.cjs');
const {DEFAULT_CARD,parseCard,serializeCard}=require('../character.cjs');
test('old settings migrate to the full user card without changing personal data',()=>{
 const saved={profiles:{a:{history:[{role:'user',text:'旧聊天'}],memories:[{text:'个人偏好'}]}}};
 const c=new Chat(saved);c.useProfile('a');assert.deepEqual(c.snapshot().character,DEFAULT_CARD);assert.equal(c.snapshot().memories[0].text,'个人偏好');assert.equal(c.snapshot().history[0].text,'旧聊天');
 assert.match(c.character.text,/你可以生气、担忧、失望/);assert.match(c.character.text,/好几回了/);
});
test('card is independent of memories, persists across restart and account switching',()=>{
 const c=new Chat();const card={...DEFAULT_CARD,version:'1.1',text:'自定义人设'};c.useProfile('a');c.addMemory('A');assert.ok(c.setCharacter(card).ok);c.useProfile('b');assert.equal(c.snapshot().memories.length,0);assert.equal(c.character.text,'自定义人设');
 const restored=new Chat(JSON.parse(JSON.stringify(c.save())));assert.deepEqual(restored.character,card);restored.useProfile('a');restored.clear();assert.equal(restored.character.text,'自定义人设');assert.equal(restored.snapshot().memories[0].text,'A');
});
test('invalid or oversized cards are rejected without changing the saved card',()=>{
 const c=new Chat();for(const text of ['',null,'x'.repeat(30001)])assert.ok(c.setCharacter({...DEFAULT_CARD,text}).error);assert.deepEqual(c.character,DEFAULT_CARD);assert.ok(c.setCharacter({...DEFAULT_CARD,format_version:2}).error);
 c.busy=true;assert.ok(c.setCharacter({...DEFAULT_CARD,text:'未生效'}).error);assert.deepEqual(c.character,DEFAULT_CARD);
 assert.deepEqual(new Chat({character:{text:7}}).character,DEFAULT_CARD);
});
test('text and JSON round trips preserve the full card; parsing never activates it',()=>{
 const c=new Chat();const text='第一段\n第二段\n用户：“一句话。”';const draft=parseCard('\uFEFF'+text,'.txt');assert.equal(draft.text,text);assert.deepEqual(c.character,DEFAULT_CARD);
 assert.deepEqual(parseCard(serializeCard(draft,'.json'),'.json'),draft);assert.equal(parseCard(serializeCard(draft,'.txt'),'.md').text,text);
 assert.throws(()=>parseCard('{bad','.json'));assert.throws(()=>parseCard('{}','.json'));assert.throws(()=>parseCard(text,'.png'));assert.throws(()=>parseCard('x'.repeat(30001),'.txt'));
});
test('next model request uses updated full character plus separate memory and protocol',async()=>{
 const c=new Chat();c.addMemory('用户喜欢秋天');c.setCharacter({...DEFAULT_CARD,version:'1.1',text:'独特角色设定：可以反驳用户。'});let request;
 const auth={active:'a',model:'mock',snapshot:()=>({connected:true}),access:async()=> 'mock-token'};
 await c.send('聊聊',{auth,context:{links:[]},fetch:async(u,o)=>{request=JSON.parse(o.body);return new Response('data: '+JSON.stringify({type:'response.output_text.delta',delta:'{"reply":"我在。","actions":[]}'})+'\n\ndata: '+JSON.stringify({type:'response.completed',response:{status:'completed'}})+'\n\n');}});
 assert.match(request.instructions,/独特角色设定/);assert.match(request.instructions,/用户喜欢秋天/);assert.match(request.instructions,/等待用户点击卡片确认/);assert.doesNotMatch(request.instructions,/温婉、从容、体贴、清醒/);assert.equal(c.snapshot().history.at(-1).text,'我在。');
});
