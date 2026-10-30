'use strict';
const {createHash}=require('node:crypto'),Forward=require('./qq-forward.cjs'),Social=require('./qq-social-input.cjs');
const MAX_PENDING=100,MAX_CACHE=40,MAX_BYTES=8*1024*1024;
function state(q){return q.forwardReader??={active:0,waiting:[],jobs:new Map(),bytes:0};}
function sourceId(m){return String(m.forwardSource||m.id||'');}
function row(q,m,c){const id=sourceId(m);return c.history.find(v=>v.role==='user'&&v.messageId===id&&!v.recalled)&&!(c.retracted||[]).includes(id);}
function valid(q,j){return !j.controller.signal.aborted&&j.epoch===q.epoch&&j.self===q.self&&j.account===q.h.account?.()&&q.valid(j.m)&&q.preferences(j.m).readForwards!==false&&!!row(q,j.m,j.c);}
function key(q,m){return [q.key(m),sourceId(m),createHash('sha256').update(JSON.stringify(m.forwards)).digest('hex')].join(':');}
function trim(s){for(const [k,j]of s.jobs){if(s.jobs.size<=MAX_CACHE&&s.bytes<=MAX_BYTES)break;if(!j.done)continue;s.jobs.delete(k);s.bytes-=j.bytes||0;}}
function status(c,m,value){const h=c.history.find(v=>v.role==='user'&&v.messageId===sourceId(m));if(h&&!h.recalled)h.social=Social.saved({...h.social,forwardStatus:value});}
function settle(j,value){if(j.done)return;j.done=true;j.result=value;j.resolve(value);}
async function run(q,s,j){const result={forwards:[],errors:[],videoRefs:[],containsVideo:false};let chars=0;
 try{const source=j.c.history.find(v=>v.messageId===sourceId(j.m)),forwarder=source?.sender||j.m.forwardedBy?.sender||j.m.sender,forwarderName=source?.name||j.m.forwardedBy?.name||j.m.name;
  for(const ref of j.m.forwards.slice(0,8)){
   if(!valid(q,j))break;
   try{const data=await Promise.race([Forward.load(ref,{transport:q.transport,signal:j.controller.signal}),new Promise((_,reject)=>j.controller.signal.addEventListener('abort',()=>reject(Error('转发读取已取消')),{once:true}))]);if(!valid(q,j))break;
    let containsVideo=false;const scan=(values,depth=0)=>{if(depth>3)return;for(const node of values.slice(0,200)){const parts=Forward.content(node),videos=require('./qq-video.cjs').parts(parts);if(videos.length){containsVideo=true;if(!result.videoRefs.length)result.videoRefs=videos;}for(const p of parts)if(p?.type==='node')scan([p],depth+1);}};scan(data);result.containsVideo||=containsVideo;const rows=Social.nodes(data,{rows:200,chars:Math.max(0,60000-chars),depth:3});chars+=rows.reduce((n,r)=>n+r.text.length,0);if(!rows.length)throw Error('没有可读取的转发内容');result.forwards.push({forwarder,forwarderName,sourceId:sourceId(j.m),rows,containsVideo,truncated:data.truncated===true||rows.truncated===true});
   }catch{if(j.controller.signal.aborted)break;result.errors.push('一份转发聊天记录暂未读到。');}
  }
  if(valid(q,j)){const h=j.c.history.find(v=>v.messageId===sourceId(j.m)),n=result.forwards.reduce((v,f)=>v+f.rows.length,0),partial=result.errors.length>0||result.forwards.some(f=>f.truncated);h.social=Social.saved({...h.social,forwards:result.forwards,errors:result.errors,forwardStatus:{state:result.forwards.length?(partial?'partial':'read'):'failed',rows:n,records:result.forwards.length,at:q.now()}});if(/^\[分享合并转发\]$/.test(h.text))h.text=result.forwards.length?'[转发聊天记录已读取：'+n+'条'+(partial?'，部分内容受读取上限或失效影响':'')+'；原作者与内容见转发资料]':'[转发聊天记录暂未读取成功]';q.log(result.forwards.length?'forward-read':'forward-error',(j.m.type==='group'?'群聊 ':'私聊 ')+j.m.target+' · '+(result.forwards.length?'已读取转发 '+result.forwards.length+'份、'+n+'条'+(partial?'（部分读取）':''):'转发暂未读到，未发送自动回复'));q.emit();}
  if(!valid(q,j)){result.forwards=[];result.errors=['转发读取已取消'];}settle(j,result);
 }finally{clearTimeout(j.timer);s.active--;j.bytes=Buffer.byteLength(JSON.stringify(result));s.bytes+=j.bytes;trim(s);pump(q,s);}
}
function pump(q,s){while(s.active<2&&s.waiting.length){const j=s.waiting.shift();if(!valid(q,j)){settle(j,{forwards:[],errors:['转发读取已取消']});continue;}s.active++;j.timer=setTimeout(()=>j.controller.abort(),60000);j.timer.unref?.();void run(q,s,j).catch(()=>{settle(j,{forwards:[],errors:['转发读取未完成']});});}}
function request(q,m,c){if(q.preferences(m).readForwards===false||!row(q,m,c))return Promise.resolve(null);const source=c.history.find(v=>v.messageId===sourceId(m));if(source.social?.forwards?.length&&source.social.forwardStatus?.state!=='failed'){const cached=[...(q.forwardReader?.jobs.values()||[])].find(j=>j.done&&q.key(j.m)===q.key(m)&&sourceId(j.m)===sourceId(m));return cached?cached.promise:Promise.resolve({forwards:source.social.forwards,errors:source.social.errors||[],containsVideo:source.social.forwards.some(f=>f.containsVideo)});}if(!m.forwards?.length)return Promise.resolve(null);const s=state(q),k=key(q,m),existing=s.jobs.get(k);if(existing){if(existing.done&&!existing.result?.forwards?.length&&!m.proactive&&q.now()-existing.createdAt>=5000){s.jobs.delete(k);s.bytes-=existing.bytes||0;}else return existing.promise;}
 if(s.waiting.length>=MAX_PENDING){status(c,m,{state:'deferred',rows:0,records:0,at:q.now()});q.log('forward-deferred','转发读取队列较满，此记录可在明确叫到颉时重试。');return Promise.resolve(null);}
 const j={m:{...m},c,epoch:q.epoch,self:q.self,account:q.h.account?.(),createdAt:q.now(),controller:new AbortController(),done:false,bytes:0};j.promise=new Promise(resolve=>{j.resolve=resolve;});s.jobs.set(k,j);s.waiting.push(j);status(c,m,{state:'loading',rows:0,records:0,at:q.now()});pump(q,s);return j.promise;
}
function clear(q){const s=q.forwardReader;if(!s)return;for(const j of s.jobs.values()){j.controller.abort();settle(j,{forwards:[],errors:['转发读取已取消']});}s.waiting=[];q.forwardReader=null;}
function extend(Runtime){const p=Runtime.prototype;
 p.readForwards=function(m,c){return request(this,m,c);};
 for(const name of ['stop','disconnected']){const prior=p[name];p[name]=function(...args){clear(this);return prior.apply(this,args);};}
 const recalled=p.recalled;p.recalled=function(m){for(const j of this.forwardReader?.jobs.values()||[])if(j.m.type===m.type&&j.m.target===m.target&&sourceId(j.m)===m.id&&j.m.sender===m.sender){j.controller.abort();settle(j,{forwards:[],errors:['转发已撤回']});}return recalled.call(this,m);};
}
module.exports={request,extend};
