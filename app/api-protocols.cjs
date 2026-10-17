'use strict';
const PROTOCOLS=['completions','responses','anthropic','gemini'];
function baseURL(value){let u;try{u=new URL(String(value).trim());}catch{throw Error('请填写有效的 API 基础地址。');}const local=['localhost','127.0.0.1','[::1]'].includes(u.hostname);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&local))throw Error('在线服务请使用 HTTPS；HTTP 仅用于本机服务。');if(u.username||u.password||u.search||u.hash)throw Error('API 地址不能包含账号密码、查询参数或密钥。');return u.href.replace(/\/+$/,'');}
const endpoint=(base,route)=>baseURL(base)+'/'+route;
function redact(value,key){return typeof value==='string'&&key?value.split(key).join('[已隐藏]'):value;}
async function boundedJSON(response,{maxBytes=4000000,key=''}={}){const reader=response.body?.getReader();if(!reader)throw Error('服务没有返回内容。');const chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw Error('服务返回数据过大。');chunks.push(value);}try{return JSON.parse(redact(Buffer.concat(chunks).toString('utf8'),key));}catch{throw Error('服务返回了无法读取的 JSON 数据。');}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}}
function headers(profile){const h={'Content-Type':'application/json'};if(profile.protocol==='anthropic'){if(profile.key)h['x-api-key']=profile.key;h['anthropic-version']='2023-06-01';if(profile.workspace)h['anthropic-workspace-id']=profile.workspace;}else if(profile.protocol==='gemini'){if(profile.key)h['x-goog-api-key']=profile.key;}else if(profile.key)h.Authorization='Bearer '+profile.key;return h;}
function part(value,profile){
 if(value.type==='input_text')return profile.protocol==='gemini'?{text:value.text}:{type:'text',text:value.text};
 if(value.type==='input_image'){
  if(!profile.images)throw Error('这个连接没有启用图片能力，请换用支持图片的模型并在接口设置中启用。');
  if(profile.protocol==='completions')return {type:'image_url',image_url:{url:value.image_url,detail:value.detail||'auto'}};
  const m=String(value.image_url).match(/^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)$/);if(!m)throw Error('此原生接口只接受本程序上传的图片数据。');
  return profile.protocol==='anthropic'?{type:'image',source:{type:'base64',media_type:m[1],data:m[2]}}:{inlineData:{mimeType:m[1],data:m[2]}};
 }
 if(value.type==='input_file'){
  if(!profile.files)throw Error('这个连接没有启用 PDF 能力，请换用支持文件的模型，或上传文本内容。');
  if(profile.protocol==='completions')return {type:'file',file:{filename:value.filename,file_data:value.file_data}};
  const m=String(value.file_data).match(/^data:(application\/pdf);base64,([A-Za-z0-9+/=]+)$/);if(!m)throw Error('此接口只接受上传的 PDF 数据。');
  return profile.protocol==='anthropic'?{type:'document',title:value.filename,source:{type:'base64',media_type:m[1],data:m[2]}}:{inlineData:{mimeType:m[1],data:m[2]}};
 }
 throw Error('这个接口尚不支持此类输入。');
}
function buildRequest(profile,body){
 const search=body.tools?.some(t=>t.type==='web_search');if(search&&!profile.search)throw Error('此连接没有启用联网搜索，请改为不搜索或使用支持搜索的接口。');
 if(profile.protocol==='responses'){
  for(const i of body.input||[])for(const p of Array.isArray(i.content)?i.content:[])if(p.type==='input_image'&&!profile.images||p.type==='input_file'&&!profile.files)throw Error('此连接尚未启用本次附件所需的图片或 PDF 能力。');
  return {url:endpoint(profile.baseURL,'responses'),body:{...body,model:profile.model}};
 }
 const messages=[],system=[body.instructions||''];for(const i of body.input||[]){if(['system','developer'].includes(i.role)){if(typeof i.content!=='string')throw Error('系统参考资料格式无效。');system.push(i.content);continue;}const content=typeof i.content==='string'?i.content:i.content.map(v=>part(v,profile));messages.push({role:i.role,content});}
 if(profile.protocol==='completions')return {url:endpoint(profile.baseURL,'chat/completions'),body:{model:profile.model,messages:[{role:'system',content:system.join('\n')},...messages],stream:false}};
 if(profile.protocol==='anthropic')return {url:endpoint(profile.baseURL,'messages'),body:{model:profile.model,system:system.join('\n'),messages,max_tokens:profile.maxOutput,stream:false,...(search?{tools:[{type:'web_search_20250305',name:'web_search',max_uses:2}]}:{})}};
 return {url:endpoint(profile.baseURL,'models/'+encodeURIComponent(profile.model.replace(/^models\//,''))+':generateContent'),body:{systemInstruction:{parts:[{text:system.join('\n')}]},contents:messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:typeof m.content==='string'?[{text:m.content}]:m.content})),generationConfig:{maxOutputTokens:profile.maxOutput},...(search?{tools:[{googleSearch:{}}]}:{})}};
}
function completion(value,profile){
 let text='',citations=[],searched=false;
 if(value.error)throw Error('接口返回错误：'+String(value.error.message||value.error.type||'请求未完成').slice(0,350));
 if(profile.protocol==='responses'){if(value.status!=='completed')throw Error('服务回答没有完整结束：'+String(value.status||'缺少完成状态')+'。');return new Response('data: '+JSON.stringify({type:'response.completed',response:value})+'\n\n',{headers:{'Content-Type':'text/event-stream'}});}
 if(profile.protocol==='completions'){const c=value.choices?.[0];if(!c||c.finish_reason!=='stop')throw Error('服务回答没有完整结束：'+String(c?.finish_reason||'缺少完成状态')+'。');text=typeof c.message?.content==='string'?c.message.content:(c.message?.content||[]).filter(p=>p.type==='text').map(p=>p.text).join('');}
 if(profile.protocol==='anthropic'){if(!['end_turn','stop_sequence'].includes(value.stop_reason))throw Error('Claude 回答没有完整结束：'+String(value.stop_reason||'缺少完成状态')+'。');text=(value.content||[]).filter(p=>p.type==='text').map(p=>p.text).join('');for(const p of value.content||[]){if(p.type==='web_search_tool_result'&&Array.isArray(p.content)){searched=true;citations.push(...p.content.filter(c=>c.type==='web_search_result').map(c=>({url:c.url,title:c.title})));}for(const c of p.citations||[])if(c.url)citations.push({url:c.url,title:c.title||c.url});}}
 if(profile.protocol==='gemini'){const c=value.candidates?.[0];if(!c||c.finishReason!=='STOP')throw Error('Gemini 回答没有完整结束：'+String(c?.finishReason||value.promptFeedback?.blockReason||'缺少完成状态')+'。');text=(c.content?.parts||[]).filter(p=>typeof p.text==='string'&&!p.thought).map(p=>p.text).join('');citations=(c.groundingMetadata?.groundingChunks||[]).filter(p=>p.web?.uri).map(p=>({url:p.web.uri,title:p.web.title||p.web.uri}));searched=citations.length>0;}
 if(!text.trim()||text.length>30000)throw Error('没有收到有效的完整回答。');
 const output=[...(searched?[{type:'web_search_call',status:'completed',action:{sources:citations}}]:[]),{type:'message',content:[{type:'output_text',text,annotations:citations.map(c=>({type:'url_citation',...c}))}]}];
 return new Response('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',output,usage:require('./activity-ledger.cjs').usage(value,profile.protocol)?(()=>{const u=require('./activity-ledger.cjs').usage(value,profile.protocol);return {input_tokens:u.input,output_tokens:u.output,input_tokens_details:{cached_tokens:u.cached},cache_creation_input_tokens:u.write};})():undefined}})+'\n\n',{headers:{'Content-Type':'text/event-stream'}});
}
async function route(profile,body,{fetch,signal}){const request=buildRequest(profile,body);const response=await fetch(request.url,{method:'POST',headers:headers(profile),body:JSON.stringify(request.body),signal,redirect:'error'});if(!response.ok){let value;try{value=await boundedJSON(response,{maxBytes:32768,key:profile.key});}catch{value={error:{message:'服务返回 HTTP '+response.status}};}return new Response(JSON.stringify(value),{status:response.status,headers:{'Content-Type':'application/json','x-request-id':response.headers?.get('x-request-id')||response.headers?.get('request-id')||''}});}if(profile.protocol==='responses'){if(response.headers?.get('content-type')?.includes('application/json'))return completion(await boundedJSON(response,{key:profile.key}),profile);return response;}return completion(await boundedJSON(response,{key:profile.key}),profile);}
module.exports={PROTOCOLS,baseURL,endpoint,redact,boundedJSON,headers,buildRequest,completion,route};
