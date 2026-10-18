'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{Chat}=require('../chat.cjs'),protocol=require('../api-protocols.cjs'),QQ=require('../qq-conversation.cjs');
const image={type:'input_image',image_url:'data:image/png;base64,ZmFrZQ=='},source={url:'https://example.com/character',title:'公开角色介绍'},features=['头上有两枚不同形状的角','衣服有清楚的橙色纹路'];
const auth={active:'fixture',model:'deepseek-flash',access:async()=> 'fixture-key',snapshot:()=>({connected:true,capabilities:{images:true,search:false}})};
const research={chinese:{used:true,sources:[source]},reverse:[{used:true,sources:[source]}]};
const confirmed={reply:'资料与原图细节吻合，这是测试角色。',visualCheck:{status:'confirmed',claims:[{claim:'测试角色',url:source.url,features}]}};
function backend(value,calls=[]){return async(u,o)=>protocol.route({baseURL:'https://api.deepseek.com',model:'deepseek-flash',protocol:'completions',images:true,search:false,key:'fixture-key'},JSON.parse(o.body),{signal:o.signal,fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]}));}});}
function options(value,extra={}){return {auth,context:{},attachments:[{id:'picture',kind:'image',size:4}],attachmentContent:()=>image,fetch:backend(value),mediaResearch:async()=>null,...extra};}
function chat(){const c=new Chat();c.analyzeMessage=async()=>{};return c;}
test('Flash receives the image through the real adapter without requiring native search',async()=>{
 const c=chat(),calls=[],r=await c.send('读出图片中的文字',options({reply:'图中文字是春日。',visualCheck:{status:'observed'}},{fetch:backend({reply:'图中文字是春日。',visualCheck:{status:'observed'}},calls)}));
 assert.equal(r.ok,true,JSON.stringify(r));assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.deepseek.com/chat/completions');
 assert.ok(calls[0].body.messages.some(m=>Array.isArray(m.content)&&m.content.some(p=>p.type==='image_url'&&p.image_url.url===image.image_url)));
 assert.equal(calls[0].body.tools,undefined);assert.match(c.data().history.at(-1).text,/春日/);assert.equal(c.data().history.at(-1).search.used,false);
});
test('independent search evidence can verify a Flash image answer without native tools',async()=>{
 const c=chat(),r=await c.send('这是谁',options(confirmed,{mediaResearch:async()=>research}));assert.equal(r.ok,true);
 const last=c.data().history.at(-1);assert.match(last.text,/测试角色/);assert.equal(last.search.used,true);assert.equal(last.search.external,true);assert.equal(last.search.showLinks,false);
});
test('missing external evidence never promotes a fabricated image identity',async()=>{
 const c=chat(),r=await c.send('这是谁',options(confirmed));assert.equal(r.ok,true);assert.doesNotMatch(c.data().history.at(-1).text,/测试角色/);assert.equal(c.data().history.at(-1).search.visualVerified,false);
});
test('an explicit must-search request remains retryable when no real search completed',async()=>{
 const c=chat();c.setSearch('required');const r=await c.send('这是谁',options(confirmed));assert.match(r.error,/没有实际执行联网搜索/);assert.equal(c.data().history.filter(v=>v.role==='assistant').length,0);
});
test('image capability is still independently validated before accepting the attachment',async()=>{
 const c=chat(),r=await c.send('看看图',options(confirmed,{auth:{...auth,snapshot:()=>({connected:true,capabilities:{images:false,search:false}})},fetch:()=>assert.fail('must not send')}));assert.match(r.error,/图片输入/);assert.equal(c.data().history.length,0);
});
test('QQ explicit mention can use independent reverse results with a vision-only model',async()=>{
 const r=await QQ.generate({auth,fetch:backend(confirmed),card:{name:'颉',text:'角色卡'},identity:{type:'group',id:'10',mention:true,text:'这是谁'},conversation:{summary:'',history:[{role:'user',messageId:'10',text:'这是谁',sender:'1234567890'}]},context:{},imageRows:[{messageId:'10',inputs:[image]}],signal:new AbortController().signal,mediaResearch:async()=>research});
 assert.match(r.text,/测试角色/);assert.equal(r.search.visualVerified,true);assert.equal(r.search.external,true);assert.equal(r.search.showLinks,false);
});
