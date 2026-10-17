'use strict';
const {randomUUID}=require('node:crypto');
const text=(v,n=180)=>typeof v==='string'?v.trim().slice(0,n):'';
const amount=v=>Number.isFinite(v)&&v>=0&&v<1e12?v:null;
function usage(value,protocol='responses'){
 const u=value?.usage||value?.usageMetadata||value;if(!u||typeof u!=='object')return null;
 if(Object.hasOwn(u,'input')&&Object.hasOwn(u,'output'))return {input:amount(u.input),output:amount(u.output),cached:amount(u.cached)||0,write:amount(u.write)||0};
 let input,output,cached=0,write=0;
 if(protocol==='gemini'){input=amount(u.promptTokenCount);output=amount(u.candidatesTokenCount);if(output!==null)output+=(amount(u.thoughtsTokenCount)||0);cached=amount(u.cachedContentTokenCount)||0;}
 else if(protocol==='anthropic'){input=amount(u.input_tokens);output=amount(u.output_tokens);cached=amount(u.cache_read_input_tokens)||0;write=amount(u.cache_creation_input_tokens)||0;if(input!==null)input+=cached+write;}
 else {input=amount(u.input_tokens??u.prompt_tokens);output=amount(u.output_tokens??u.completion_tokens);cached=amount(u.input_tokens_details?.cached_tokens??u.prompt_tokens_details?.cached_tokens)||0;write=amount(u.cache_creation_input_tokens)||0;}
 if(input===null&&output===null)return null;return {input,output,cached:Math.min(input??cached,cached),write:Math.min(input??write,write)};
}
function purpose(body={}){const i=body.instructions||'';return /JIE_TASK_PLANNER|JIE_WEB_OPERATOR/.test(i)?'task':i.includes('台词的情绪标注器')?'emotion':i.includes('小记')&&!i.includes('context.memoryEvidence')?'diary':i.includes('画面观察器')||i.includes('正在一起看屏幕或陪玩')?'screen':i.includes('主动接话')&&i.includes('proactiveSource')&&!i.includes('本轮用户消息id')?'proactive':'chat';}
function errorKind(status,error){return status===429?'quota':status===401||status===403?'auth':status>=500?'service':status>=400?'request':error?.name==='AbortError'?'canceled':error?.name==='TimeoutError'?'timeout':'network';}
const errorLabel={quota:'服务额度或速率限制',auth:'登录或权限问题',service:'服务暂时不可用',request:'请求未被服务接受',canceled:'已停止',timeout:'等待超时',network:'连接未完成'};
class ActivityLedger{
 constructor(saved={},onChange=()=>{}){this.onChange=onChange;this.entries=(Array.isArray(saved.entries)?saved.entries:[]).slice(-500).filter(e=>typeof e.id==='string').map(e=>({id:text(e.id,100),profile:text(e.profile,100),model:text(e.model),purpose:['chat','screen','emotion','diary','proactive','task'].includes(e.purpose)?e.purpose:'chat',at:Number(e.at)||0,ended:Number(e.ended)||0,status:['done','failed','canceled'].includes(e.status)?e.status:'canceled',error:errorLabel[e.error]?e.error:'',tokens:usage(e.tokens),latency:Number(e.latency)||0}));this.rates=(Array.isArray(saved.rates)?saved.rates:[]).filter(r=>typeof r.model==='string').slice(0,100).map(r=>({profile:text(r.profile,100),model:text(r.model),currency:['CNY','USD'].includes(r.currency)?r.currency:'CNY',input:amount(r.input),output:amount(r.output),cached:amount(r.cached),write:amount(r.write)}));}
 save(){return {entries:this.entries.map(e=>({...e,status:['waiting','receiving'].includes(e.status)?'canceled':e.status})),rates:this.rates};}
 price(profile,model,input){const row={profile:text(profile,100),model:text(model),currency:input.currency==='USD'?'USD':'CNY'};for(const k of ['input','output','cached','write']){row[k]=input[k]===''||input[k]==null?null:amount(Number(input[k]));if(input[k]!==''&&input[k]!=null&&row[k]===null)throw Error('单价需要是非负数字。');}this.rates=this.rates.filter(r=>r.profile!==row.profile||r.model!==row.model).concat(row).slice(-100);this.onChange();return {ok:true};}
 cost(e){const r=this.rates.find(r=>r.profile===e.profile&&r.model===e.model),u=e.tokens;if(!r||!u||u.input==null||u.output==null||r.input==null||r.output==null||u.cached&&r.cached==null||u.write&&r.write==null)return null;return {currency:r.currency,value:((u.input-u.cached-u.write)*r.input+u.output*r.output+u.cached*(r.cached||0)+u.write*(r.write||0))/1e6};}
 snapshot(){return {active:this.entries.filter(e=>['waiting','receiving'].includes(e.status)),recent:this.entries.slice(-60).reverse().map(e=>({...e,errorLabel:errorLabel[e.error]||'',cost:this.cost(e)})),rates:this.rates,total:this.entries.length};}
 async fetch(url,options,{route,profile,model}){
  let body;try{body=JSON.parse(options.body);}catch{body={};}
  const entry={id:randomUUID(),profile:text(profile,100),model:text(model),purpose:purpose(body),at:Date.now(),ended:0,status:'waiting',error:'',tokens:null,latency:0};this.entries.push(entry);this.entries=this.entries.slice(-500);this.onChange();
  let settled=false,completed=false,buffer='',lastEmit=0;
  const finish=(status,error='')=>{if(settled)return;settled=true;entry.ended=Date.now();entry.latency=entry.ended-entry.at;entry.status=status;entry.error=error;this.onChange();};
  const event=line=>{if(!line.startsWith('data:'))return;try{const v=JSON.parse(line.slice(5).trim());if(v.response?.usage)entry.tokens=usage(v.response.usage);if(v.type==='response.completed')completed=!v.response?.status||v.response.status==='completed';if(['response.failed','response.incomplete','error'].includes(v.type)){completed=false;entry.error=/rate_limit|quota|credit/i.test(v.error?.code||v.response?.error?.code||'')?'quota':'service';}}catch{}};
  try{
   const response=await route(url,options);
   if(!response.ok){finish('failed',errorKind(response.status));return response;}
   if(!response.body){finish('failed','service');return response;}
   const decoder=new TextDecoder(),reader=response.body.getReader();
   const thisLedger=this;const stream=new ReadableStream({
    async pull(controller){try{const {done,value}=await reader.read();if(done){buffer+=decoder.decode();if(buffer)event(buffer);finish(completed?'done':'failed',completed?'':entry.error||'service');reader.releaseLock();controller.close();return;}entry.status='receiving';buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){event(buffer.slice(0,end).replace(/\r$/,''));buffer=buffer.slice(end+1);}if(buffer.length>1000000)buffer='';controller.enqueue(value);if(Date.now()-lastEmit>250){lastEmit=Date.now();thisLedger.onChange();}}catch(e){finish(options.signal?.aborted?'canceled':'failed',errorKind(0,e));controller.error(e);}},
    async cancel(reason){await reader.cancel(reason).catch(()=>{});finish('canceled','canceled');}
   });return new Response(stream,{status:response.status,headers:response.headers});
  }catch(e){finish(options.signal?.aborted?'canceled':'failed',errorKind(0,e));throw e;}
 }
}
module.exports={ActivityLedger,usage,purpose,errorKind};
