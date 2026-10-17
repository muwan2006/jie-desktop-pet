'use strict';
const {randomUUID}=require('node:crypto');
const clip=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const validId=v=>typeof v==='string'&&/^[-\w]{1,100}$/.test(v);
function terms(text){return [...new Set((clip(text,6000).toLowerCase().match(/[a-z0-9_]{2,}|[\u3400-\u9fff]{2,}/g)||[]).flatMap(t=>/[\u3400-\u9fff]/.test(t)?Array.from({length:t.length-1},(_,i)=>t.slice(i,i+2)):[t]))];}
function score(query,text){const t=String(text).toLowerCase();return terms(query).reduce((n,s)=>n+(t.includes(s)?1:0),0);}
function personality(v={}){return {address:clip(v.address,80),tone:['natural','quiet','lively'].includes(v.tone)?v.tone:'natural',habits:clip(v.habits,1000),likes:clip(v.likes,1000),values:clip(v.values,1000)};}
function restoreLife(value={},history=[]){
 if(!value||typeof value!=='object')value={};if(!Array.isArray(history))history=[];
 const s={version:1,settings:{automatic:value.settings?.automatic!==false,topics:value.settings?.topics!==false},persona:personality(value.persona),excludedSources:[...new Set((Array.isArray(value.excludedSources)?value.excludedSources:[]).filter(validId))],excludedDiaryDates:(Array.isArray(value.excludedDiaryDates)?value.excludedDiaryDates:[]).filter(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)),experiences:[],topics:[]};
 for(const e of (Array.isArray(value.experiences)?value.experiences:[]).slice(-2000))if(validId(e?.id)&&clip(e.text,3000))s.experiences.push({id:e.id,text:clip(e.text,3000),at:Number(e.at)||0,updatedAt:Number(e.updatedAt)||Number(e.at)||0,sourceId:validId(e.sourceId)?e.sourceId:'',sourceQuote:clip(e.sourceQuote,3000),manual:e.manual===true,edited:e.edited===true,changes:(Array.isArray(e.changes)?e.changes:[]).slice(-8).filter(c=>typeof c.previous==='string').map(c=>({previous:clip(c.previous,1000),text:clip(c.text,1000),at:Number(c.at)||0,sourceId:validId(c.sourceId)?c.sourceId:'',sourceQuote:clip(c.sourceQuote,1000),previousSourceId:validId(c.previousSourceId)?c.previousSourceId:'',previousSourceQuote:clip(c.previousSourceQuote,1000)}))});
 for(const t of (Array.isArray(value.topics)?value.topics:[]).slice(-500))if(validId(t?.id)&&clip(t.title,100))s.topics.push({id:t.id,title:clip(t.title,100),status:['open','done','paused','canceled'].includes(t.status)?t.status:'open',at:Number(t.at)||0,updatedAt:Number(t.updatedAt)||Number(t.at)||0,sourceId:validId(t.sourceId)?t.sourceId:'',sourceIds:[...new Set([...(Array.isArray(t.sourceIds)?t.sourceIds:[]),t.sourceId].filter(validId))],sourceQuote:clip(t.sourceQuote,600),lastAskedAt:Number(t.lastAskedAt)||0,manual:t.manual===true});
 if(!value.version&&s.settings.automatic)for(const h of history.filter(h=>h.role==='user').slice(-2000))rememberUser(s,h);
 return s;
}
function rememberUser(s,h){
 if(!s.settings.automatic||h?.role!=='user'||!validId(h.id)||!clip(h.text,3000)||s.excludedSources.includes(h.id)||s.experiences.some(e=>e.sourceId===h.id))return;
 s.experiences.push({id:randomUUID(),text:clip(h.text,3000),at:Number(h.at)||Date.now(),updatedAt:Number(h.at)||Date.now(),sourceId:h.id,sourceQuote:clip(h.text,3000),manual:false,edited:false});
 if(s.experiences.length>2000)s.experiences.splice(0,s.experiences.length-2000);
}
function rememberManual(s,text,now=Date.now()){text=clip(text,3000);if(!text)return {error:'请填写想记下的经历。'};if(s.experiences.length>=2000)return {error:'经历已达 2000 条，请先整理。'};const e={id:randomUUID(),text,at:now,updatedAt:now,sourceId:'',sourceQuote:'',manual:true,edited:false};s.experiences.push(e);return {ok:true};}
function editExperience(s,id,text,now=Date.now()){const e=s.experiences.find(e=>e.id===id);text=clip(text,3000);if(!e||!text)return {error:'经历不存在或正文为空。'};e.text=text;e.edited=true;e.updatedAt=now;exclude(s,e.sourceId);if(e.sourceId)s.topics=s.topics.filter(t=>!([t.sourceId,...(t.sourceIds||[])].includes(e.sourceId)));return {ok:true};}
function exclude(s,id){if(validId(id)&&!s.excludedSources.includes(id))s.excludedSources.push(id);}
function forgetExperience(s,id){const e=s.experiences.find(e=>e.id===id);if(!e)return {error:'这条经历不存在。'};exclude(s,e.sourceId);s.experiences=s.experiences.filter(v=>v.id!==id);s.topics=s.topics.filter(t=>!e.sourceId||!([t.sourceId,...(t.sourceIds||[])].includes(e.sourceId)));return {ok:true};}
function topicManual(s,input,now=Date.now()){
 const title=clip(input?.title,100),status=['open','done','paused','canceled'].includes(input?.status)?input.status:'open';if(!title)return {error:'请填写话题名称。'};
 if(input.id){const t=s.topics.find(t=>t.id===input.id);if(!t)return {error:'话题不存在。'};Object.assign(t,{title,status,manual:true,updatedAt:now});return {ok:true};}
 if(s.topics.length>=500)return {error:'话题已达 500 条，请先整理。'};s.topics.push({id:randomUUID(),title,status,manual:true,at:now,updatedAt:now,sourceId:'',sourceIds:[],sourceQuote:'',lastAskedAt:0});return {ok:true};
}
function updateTopics(s,updates,user,now=Date.now()){
 if(!s.settings.topics||user?.role!=='user'||s.excludedSources.includes(user.id))return;
 for(const u of (Array.isArray(updates)?updates:[]).slice(0,4)){
  const quote=clip(u?.quote,600);if(quote.length<4||u.source_id!==user.id||!user.text.includes(quote))continue;
  const status=['open','done','paused','canceled'].includes(u.status)?u.status:'open';
  if(u.id){const t=s.topics.find(t=>t.id===u.id);if(!t||t.manual&&t.status!=='open')continue;Object.assign(t,{status,updatedAt:now,sourceId:user.id,sourceIds:[...new Set([...(t.sourceIds||[]),user.id])],sourceQuote:quote});}
  else {const title=clip(u.title,100);if(!title||status!=='open'||s.topics.length>=500||s.topics.some(t=>t.title===title))continue;s.topics.push({id:randomUUID(),title,status:'open',manual:false,at:now,updatedAt:now,sourceId:user.id,sourceIds:[user.id],sourceQuote:quote,lastAskedAt:0});}
 }
}
function eligibleTopics(s,now=Date.now()){return s.topics.filter(t=>t.status==='open'&&now-t.updatedAt<=30*86400000&&t.updatedAt<=now&&now-t.lastAskedAt>=3*86400000).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,8);}
function retrieve(s,query,limit=8){return s.experiences.filter(e=>!s.excludedSources.includes(e.sourceId)||e.edited).map(e=>({e,score:score(query,e.text)})).filter(v=>v.score>0).sort((a,b)=>b.score-a.score||b.e.updatedAt-a.e.updatedAt).slice(0,limit).map(v=>({id:v.e.id,text:v.e.text,at:v.e.at,updatedAt:v.e.updatedAt,sourceId:v.e.sourceId,sourceQuote:v.e.edited?'':v.e.sourceQuote,corrected:v.e.edited,manual:v.e.manual,edited:v.e.edited}));}
function diaryRecall(entries,query,life={}){return Object.values(entries||{}).filter(e=>!(life.excludedDiaryDates||[]).includes(e.date)).map(e=>({e,score:score(query,e.title+' '+e.text)})).filter(v=>v.score>0).sort((a,b)=>b.score-a.score||b.e.date.localeCompare(a.e.date)).slice(0,3).map(v=>({date:v.e.date,title:v.e.title,text:clip(v.e.text,1800),kind:'diary'}));}
function contextLife(s,query,now=Date.now()){return {persona:s.persona,experiences:retrieve(s,query),topics:s.topics.filter(t=>t.status==='open'||score(query,t.title)>0).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,30),followupTopics:eligibleTopics(s,now)};}
function suppressExchange(s,history,sourceId){const index=history.findIndex(h=>h.id===sourceId);if(index<0)return;const time=new Date(history[index].at);if(Number.isFinite(time.getTime())){const day=time.getFullYear()+'-'+String(time.getMonth()+1).padStart(2,'0')+'-'+String(time.getDate()).padStart(2,'0');if(!s.excludedDiaryDates.includes(day))s.excludedDiaryDates.push(day);}for(let i=index;i<history.length;i++){if(i>index&&history[i].role==='user')break;exclude(s,history[i].id);}}
function blockedTopicEvidence(s,h,quote){return s.topics.some(t=>t.status!=='open'&&((t.sourceIds||[]).includes(h.id)||score(quote,t.title)>=2));}
module.exports={restoreLife,rememberUser,rememberManual,editExperience,forgetExperience,topicManual,updateTopics,eligibleTopics,contextLife,diaryRecall,personality,terms,score,retrieve,suppressExchange,blockedTopicEvidence};
