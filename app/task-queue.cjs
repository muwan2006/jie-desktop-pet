'use strict';
const {randomUUID}=require('node:crypto');
class TaskQueue{
 constructor(saved={},h){this.h=h;this.items=(Array.isArray(saved.items)?saved.items:[]).slice(0,30).map(v=>({...v,status:'paused'}));this.running=false;this.paused=true;this.generation=0;this.error='';}
 save(){return {items:this.items.map(v=>({...v,status:'paused'}))};}
 snapshot(){const o=this.h.owner();return {items:this.items.filter(v=>v.owner?.profile===o.profile&&v.owner?.thread===o.thread),paused:this.paused,running:this.running,error:this.error};}
 add(text,options={}){text=typeof text==='string'?text.trim().slice(0,3000):'';if(!text)throw Error('任务不能为空。');if(this.items.length>=30)throw Error('队列最多30项。');const item={id:randomUUID(),text,owner:{...this.h.owner()},options:{source:options.source||'panel',confidence:options.confidence??1},status:this.paused?'paused':'waiting'};this.items.push(item);this.emit();return {ok:true,result:'已加入任务队列。',id:item.id};}
 remove(id){const v=this.items.find(v=>v.id===id);if(!v||!this.same(v)||v.status==='running')throw Error('这项任务当前不能移出。');this.items=this.items.filter(i=>i!==v);this.emit();return {ok:true};}
 same(v){const o=this.h.owner();return v.owner?.profile===o.profile&&v.owner?.thread===o.thread;}
 pause(){this.paused=true;this.generation++;this.h.pause?.();this.emit();return {ok:true,result:'当前步骤结束后暂停，后续任务保留。'};}
 async resume(){if(this.running)return {error:'当前步骤尚未结束，请稍后继续。'};this.paused=false;this.error='';this.generation++;this.emit();const current=this.h.current();if(current?.status==='paused'){const result=await this.h.resume(current.id);if(result?.error||current.status!=='done'){this.paused=true;this.emit();return result;}}this.settled();void this.pump();return {ok:true};}
 async pump(){if(this.running||this.paused||this.h.busy())return;const current=this.h.current();if(current&&['planning','ready','running','clarify','paused','pausing','failed'].includes(current.status))return;const item=this.items.find(v=>this.same(v));if(!item)return;const generation=this.generation;this.running=true;item.status='running';this.emit();try{const result=await this.h.run(item.text,{...item.options,queueId:item.id});if(!this.same(item)){item.status='paused';this.paused=true;return;}const p=this.h.current();if(result?.error||result?.clarify||result?.review||p?.status!=='done'){item.status='paused';this.paused=true;this.error=result?.error||'当前任务需要你补充或确认，队列已暂停。';}else this.items=this.items.filter(v=>v!==item);}catch(e){item.status='paused';this.paused=true;this.error=e.message;}finally{this.running=false;this.emit();if(!this.paused&&generation===this.generation)queueMicrotask(()=>void this.pump());}}
 settled(){if(this.paused){const item=this.items.find(v=>v.status==='paused'&&this.same(v));if(item&&(this.h.current()?.queueId===item.id||this.h.current()?.request===item.text)&&this.h.current()?.status==='done'){this.items=this.items.filter(v=>v!==item);this.emit();}}else queueMicrotask(()=>void this.pump());}
 stop(){this.pause();}
 emit(){this.h.onChange?.();}
}
module.exports={TaskQueue};
