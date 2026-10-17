'use strict';
const {randomUUID}=require('node:crypto');
const threads=require('./conversation-threads.cjs'),life=require('./companionship.cjs');
const text=(v,n=1000)=>typeof v==='string'?v.trim().slice(0,n):'';
const valid=v=>typeof v==='string'&&/^[-\w]{1,100}$/.test(v);
function restore(value){return (Array.isArray(value)?value:[]).filter(m=>text(m?.text)).slice(0,30).map(m=>({id:valid(m.id)?m.id:randomUUID(),text:text(m.text),at:Number(m.at)||0,updatedAt:Number(m.updatedAt)||Number(m.at)||0,sourceId:valid(m.sourceId)?m.sourceId:'',sourceQuote:text(m.sourceQuote,1000),manual:m.manual!==false,changes:(Array.isArray(m.changes)?m.changes:[]).filter(c=>text(c?.previous)).slice(-8).map(c=>({previous:text(c.previous),text:text(c.text),at:Number(c.at)||0,sourceId:valid(c.sourceId)?c.sourceId:'',sourceQuote:text(c.sourceQuote),previousSourceId:valid(c.previousSourceId)?c.previousSourceId:'',previousSourceQuote:text(c.previousSourceQuote)}))}));}
function add(data,value,sourceId=''){
 const content=text(value);if(!content)throw Error('请填写记忆。');if(data.memories.some(m=>m.text===content))return {ok:true,result:'这件事已经记下了。'};if(data.memories.length>=30)throw Error('最多30条长期记忆，请先整理。');
 const user=threads.allHistory(data).find(h=>h.id===sourceId&&h.role==='user');
 data.memories.push({id:randomUUID(),text:content,at:Date.now(),updatedAt:Date.now(),sourceId:user?.id||'',sourceQuote:user?text(user.text):'',manual:!user,changes:[]});return {ok:true,result:'已记住：'+content};
}
function evidence(data,query){
 const memories=data.memories.map(m=>({kind:'memory',id:m.id,text:m.text,at:m.updatedAt||m.at,sourceId:m.sourceId||'',sourceQuote:m.sourceQuote||'',manual:m.manual!==false}));
 const experiences=life.retrieve(data.life,query,8).map(e=>({kind:'experience',id:e.id,text:e.text,at:e.updatedAt,sourceId:e.sourceId,sourceQuote:e.sourceQuote,manual:e.manual,corrected:e.corrected}));
 return [...memories,...experiences].slice(0,38).map((e,i)=>({...e,citation:'记忆'+(i+1)}));
}
function cited(reply,records=[]){return records.filter((e,i)=>reply.includes('[记忆'+(i+1)+']')).map(e=>({kind:e.kind,id:e.id,citation:e.citation,text:e.text.slice(0,1000),at:e.at,sourceId:e.sourceId,sourceQuote:e.sourceQuote,manual:e.manual,corrected:e.corrected}));}
function source(data,kind,id){
 const m=kind==='experience'?data.life.experiences.find(e=>e.id===id):data.memories.find(e=>e.id===id);if(!m)throw Error('这条记忆已被移除。');
 const original=Object.values(data.threads).find(t=>t.history.some(h=>h.id===m.sourceId));const history=original?.history||[],h=history.find(h=>h.id===m.sourceId),at=h?history.indexOf(h):-1;
 return {kind,id:m.id,text:m.text,at:m.at,updatedAt:m.updatedAt,sourceId:m.sourceId||'',sourceQuote:m.sourceQuote||'',manual:!m.sourceId,changes:m.changes||[],exchange:at>=0?history.slice(at,at+3).map(h=>({id:h.id,role:h.role,text:h.text,at:h.at})):[],originAvailable:!!h};
}
function change(data,id,value,{sourceId='',sourceQuote='',now=Date.now()}={}){
 const m=data.memories.find(m=>m.id===id)||data.life.experiences.find(m=>m.id===id),content=text(value);if(!m||!content)throw Error('记忆不存在或内容为空。');if(m.text===content)return {ok:true,result:'内容没有变化。'};
 const oldSource=m.sourceId||'';m.changes=(m.changes||[]).concat({previous:m.text,text:content,at:now,sourceId,sourceQuote:text(sourceQuote),previousSourceId:oldSource,previousSourceQuote:m.sourceQuote||''}).slice(-8);
 if(data.life.experiences.includes(m)){m.edited=true;if(oldSource)data.life.topics=data.life.topics.filter(t=>!([t.sourceId,...(t.sourceIds||[])].includes(oldSource)));}m.text=content;m.sourceId=sourceId;m.sourceQuote=text(sourceQuote);m.updatedAt=now;m.manual=!sourceId;
 if(oldSource){for(const t of Object.values(data.threads))life.suppressExchange(data.life,t.history,oldSource);life.excludeSource?.(data.life,oldSource);if(!data.life.excludedSources.includes(oldSource))data.life.excludedSources.push(oldSource);}
 threads.invalidateSummaries(data);return {ok:true,result:'已更正：'+content};
}
function corrections(data,updates,user,now=Date.now()){
 if(user?.role!=='user'||!/(?:现在|改为|改成|不再|记错|更新|纠正|以前|不是.{1,30}是)/.test(user.text))return [];
 const changed=[];for(const c of (Array.isArray(updates)?updates:[]).slice(0,2)){
  const quote=text(c?.quote,1000);if(quote.length<4||!/(?:现在|改为|改成|不再|记错|更新|纠正|以前|不是.{1,30}是)/.test(quote)||c.source_id!==user.id||!user.text.includes(quote)||![...data.memories,...data.life.experiences].some(m=>m.id===c.id)||!text(c.text))continue;
  change(data,c.id,c.text,{sourceId:user.id,sourceQuote:quote,now});changed.push(c.id);
 }return changed;
}
function undo(data,id){const m=data.memories.find(m=>m.id===id)||data.life.experiences.find(m=>m.id===id),last=m?.changes?.at(-1);if(!last)throw Error('没有可撤销的更正。');m.text=last.previous;m.sourceId=last.previousSourceId;m.sourceQuote=last.previousSourceQuote;m.updatedAt=Date.now();m.manual=!m.sourceId;m.changes.pop();if(m.sourceId){data.life.excludedSources=data.life.excludedSources.filter(s=>s!==m.sourceId);}threads.invalidateSummaries(data);return {ok:true,result:'已恢复上一版记忆。'};}
module.exports={restore,add,evidence,cited,source,change,corrections,undo};
