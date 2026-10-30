'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Style=require('../qq-adaptive-style.cjs'),Shared=require('../conversation-style.cjs');
const Q=require('../qq-conversation.cjs'),{Chat}=require('../chat.cjs'),Notices=require('../qq-media-notices.cjs');
const auth={active:'test',model:'test',snapshot:()=>({connected:true,capabilities:{search:false}}),access:async()=> 'fake'};
function response(value){return new Response('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',output:[{content:[{text:JSON.stringify(value)}]}]}})+'\n\n');}
test('social rhetorical questions do not force an explanation or reject punctuation',()=>{
 for(const text of ['为什么你这么笨啊？','哈哈你也太离谱了？','我服了，又输了！','寄了','嗯'])assert.equal(Style.plan({}, {text,type:'group'}).scene,'casual',text);
});
test('real questions keep direct answers and requested depth remains available',()=>{
 for(const text of ['哈哈，帮我分析一下为什么会崩溃','详细解释一下怎么做','一步一步教我安装','完整介绍这个功能'])assert.equal(Style.plan({}, {text}).scene,'explain',text);
 for(const text of ['为什么会崩溃？','这本书是谁写的？','笑死，帮我核实这件事'])assert.equal(Style.plan({}, {text}).scene,'answer',text);
 for(const key of ['fileRequested','backgroundTask'])assert.equal(Style.plan({}, {[key]:true,text:'哈哈'}).sentences,0);
});
test('adaptive opt-out and per-conversation sentence settings survive',()=>{
 assert.equal(Style.guidance({adaptiveReplies:false},{text:'又输了'}),'');
 assert.equal(Style.plan({groupSentenceLimit:1},{type:'group',text:'你好'}).sentences,1);
 assert.equal(Style.plan({privateSentenceLimit:7},{type:'private',text:'是谁'}).sentences,7);
});
test('QQ generation keeps full custom card, attributed history, feedback and raw reply',async()=>{
 const card={name:'本群角色',text:'本群特有设定。'.repeat(3500)},conversation={summary:'此前约好聊棋局',history:[{role:'user',text:'我刚赢了一局',sender:'222222222',name:'群友乙',messageId:'1',at:Date.now()},{role:'assistant',text:'这局总算赢了。',at:Date.now()},{role:'user',text:'不对，我在说另一个人，刚才那局是输了',sender:'111111111',name:'群友甲',messageId:'2',at:Date.now()}]};let sent;
 const result=await Q.generate({auth,card,identity:{id:'2',type:'group',target:'333333333',sender:'111111111',name:'群友甲',mention:true,text:conversation.history[2].text},conversation,context:{},preferences:{learnedStyle:'不喊昵称，认真问题讲清楚',groupDetail:'balanced'},signal:new AbortController().signal,fetch:async(u,o)=>{sent=JSON.parse(o.body);return response({reply:'哦，是我听岔了，输的那局才是你说的。',skip:false,summary:'甲澄清说的是另一人输掉的棋局。'});}});
 assert.ok(sent.instructions.includes(JSON.stringify(card)));
 assert.ok(sent.instructions.includes(Shared.guidance()));
 assert.match(sent.instructions,/不喊昵称，认真问题讲清楚/);
 const actual=JSON.stringify(sent.input);assert.ok(actual.includes('群友乙'));assert.ok(actual.includes('群友甲'));assert.ok(actual.includes('刚才那局是输了'));
 assert.equal(result.text,'哦，是我听岔了，输的那局才是你说的。');
 assert.equal(result.summary,'甲澄清说的是另一人输掉的棋局。');
});
test('desktop request uses shared style without changing detailed answers, card or continuity',async()=>{
 const c=new Chat(),card={...c.character,text:'桌面完整设定。'.repeat(3500)};assert.equal(c.setCharacter(card).ok,true);assert.equal(c.character.text,card.text);c.data().continuity='前一轮聊到了背包';const requests=[];
 const reply='第一步先检查设置。\n第二步打开日志，保留具体错误。';
 const result=await c.send('详细解释一下怎么排查',{auth,context:{preferences:{replyGuidance:'需要详细步骤'}},fetch:async(u,o)=>{requests.push(JSON.parse(o.body));return response({reply,actions:[],continuity:'聊到了具体排查步骤'});}});
 const sent=requests.find(r=>r.instructions?.includes('当前角色卡：'));assert.ok(sent);assert.equal(result.ok,true);assert.ok(sent.instructions.includes(JSON.stringify(c.character)));assert.ok(sent.instructions.includes(Shared.guidance()));assert.match(sent.instructions,/前一轮聊到了背包/);assert.match(sent.instructions,/需要详细步骤/);assert.equal(c.data().history.at(-1).text,reply);
});
test('silence and risk routing do not leak a conversational reply',async()=>{
 const result=await Q.generate({auth,card:{text:'测试'},identity:{type:'group',id:'1',text:'当前话题',sender:'111111111'},conversation:{history:[{role:'user',text:'当前话题',messageId:'1'}]},context:{},signal:new AbortController().signal,fetch:async()=>response({skip:true,reason:'本轮不参与',reply:'这句话不应发出',ownerAlert:{kind:'life',sourceId:'1',quote:'当前话题',urgency:'possible'}})});
 assert.equal(result.skip,true);assert.equal(result.text,'');assert.equal(result.ownerAlert.urgency,'possible');
});
test('default media notices are short and never invent search success or retry promises',()=>{
 assert.equal(Notices.started('image'),'我找找。');assert.equal(Notices.started('video'),'我看看这个视频。');assert.match(Notices.started('discussion'),/读到/);
 for(const text of [Notices.missingImage(),Notices.failed('image','下载失败'),Notices.failed('video','network error')]){assert.ok(text.length<55);assert.doesNotMatch(text,/找到了|马上|稍后发|自动重试|任务 [a-f0-9]{8}/);}
 assert.match(Notices.failed('video','需要登录Cookie'),/登录或验证/);assert.match(Notices.failed('image','下载超时'),/超时/);assert.match(Notices.failed('image','请先配置视觉服务'),/设置/);
});
