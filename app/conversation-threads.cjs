'use strict';
const {randomUUID}=require('node:crypto');
const valid=v=>typeof v==='string'&&/^[-\w]{1,100}$/.test(v);
const title=v=>typeof v==='string'?v.trim().slice(0,100):'';
function initialize(data,saved={},restoreHistory=v=>v||[]){
 if(data.threads)return data;
 const records=Object.create(null),active=valid(saved.activeThread)?saved.activeThread:'main';
 for(const [id,t] of Object.entries(saved.threads||{}).slice(0,30))if(valid(id))records[id]={id,title:title(t?.title)||'一段对话',createdAt:Number(t?.createdAt)||Date.now(),updatedAt:Number(t?.updatedAt)||Date.now(),forkFrom:valid(t?.forkFrom)?t.forkFrom:'',forkMessage:valid(t?.forkMessage)?t.forkMessage:'',conversationId:valid(t?.conversationId)?t.conversationId:randomUUID(),continuity:typeof t?.continuity==='string'?t.continuity.slice(0,12000):'',history:restoreHistory(t?.history),failure:t?.failure&&valid(t.failure.messageId)?{messageId:t.failure.messageId,at:Number(t.failure.at)||0}:null};
 if(!records[active])records[active]={id:active,title:active==='main'?'原来的对话':'一段对话',createdAt:data.history[0]?.at||Date.now(),updatedAt:data.history.at(-1)?.at||Date.now(),forkFrom:'',forkMessage:'',conversationId:data.conversationId,continuity:data.continuity,history:data.history,failure:null};
 else {records[active].history=data.history;records[active].continuity=data.continuity;records[active].conversationId=data.conversationId;}
 data.threads=records;data.activeThread=active;
 for(const field of ['history','continuity','conversationId'])Object.defineProperty(data,field,{configurable:true,enumerable:true,get(){return records[this.activeThread][field];},set(v){records[this.activeThread][field]=v;}});
 return data;
}
function list(data){return Object.values(data.threads).map(t=>({id:t.id,title:t.title,createdAt:t.createdAt,updatedAt:t.updatedAt,messages:t.history.length,forkFrom:t.forkFrom,forkMessage:t.forkMessage,active:t.id===data.activeThread})).sort((a,b)=>b.updatedAt-a.updatedAt);}
function create(data,input={}){
 if(Object.keys(data.threads).length>=30)throw Error('每个连接最多30段对话，请先归档或删除不需要的分支。');
 const parent=data.threads[data.activeThread];let history=[],continuity='';
 if(input.messageId){const at=parent.history.findIndex(h=>h.id===input.messageId);if(at<0)throw Error('分支的起点不存在。');history=structuredClone(parent.history.slice(0,at+1));for(const h of history)for(const a of h.actions||[])if(a.status!=='done')a.status='canceled';}
 const id=randomUUID();data.threads[id]={id,title:title(input.title)||(input.messageId?parent.title+' · 分支':'新的话题'),createdAt:Date.now(),updatedAt:Date.now(),forkFrom:input.messageId?parent.id:'',forkMessage:input.messageId||'',history,continuity,conversationId:randomUUID(),failure:null};data.activeThread=id;return id;
}
function select(data,id){if(!Object.hasOwn(data.threads,id))throw Error('这段对话不存在。');data.activeThread=id;}
function rename(data,id,value){if(!data.threads[id]||!title(value))throw Error('请填写有效的对话名称。');data.threads[id].title=title(value);}
function remove(data,id){if(!data.threads[id])throw Error('这段对话不存在。');if(Object.keys(data.threads).length<=1)throw Error('至少保留一段对话；可以清空它的记录。');delete data.threads[id];if(data.activeThread===id)data.activeThread=Object.keys(data.threads)[0];}
function serialize(data){const threads=Object.fromEntries(Object.values(data.threads).map(t=>[t.id,{...t,...(t.id===data.activeThread?{history:[],continuity:''}:{})}]));return {...data,threads};}
function allHistory(data){const unique=new Map();for(const t of Object.values(data.threads))for(const h of t.history)if(!unique.has(h.id))unique.set(h.id,h);return [...unique.values()].sort((a,b)=>a.at-b.at);}
function invalidateSummaries(data){for(const t of Object.values(data.threads))t.continuity='';}
module.exports={initialize,list,create,select,rename,remove,serialize,allHistory,invalidateSummaries};
