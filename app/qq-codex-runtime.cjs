'use strict';
const fs=require('node:fs'),path=require('node:path'),{CodexTasks}=require('./codex-tasks.cjs'),Cmd=require('./qq-codex-command.cjs'),S=require('./qq-state.cjs'),Export=require('./qq-export.cjs');
function ensure(q){if(!q.h.codex)return null;if(q.codexTasks)return q.codexTasks;return q.codexTasks=new CodexTasks({directory:q.h.directory,clientFactory:q.h.codex.clientFactory,changed:()=>q.emit(),route:()=>({owner:q.settings.owner,bot:q.self,online:q.ready&&q.transport.connected&&q.settings.enabled}),send:async n=>{if(!q.ready||q.self!==n.bot||q.settings.owner!==n.owner)throw Error('QQ账号已变化，项目任务结果未发送。');const m={type:'private',target:n.owner,sender:n.owner,id:'codex-'+n.id,images:[],text:''};await q.send(m,[{type:'text',data:{text:n.text}}]);const c=q.session(m);c.history.push({role:'assistant',text:n.text,at:q.now(),sender:q.self,name:q.nickname,messageId:m.sentMessageId||'',origin:'codex-task'});c.history=c.history.slice(-200);q.emit();}});}
function claimed(q,m){if(!q.h.codex||!Cmd.authorized(m,q.settings.owner))return false;const cmd=Cmd.command(m.text);if(!cmd)return false;const jobs=ensure(q),own=jobs.state.tasks.filter(t=>t.owner===q.settings.owner&&t.bot===q.self),legacy=q.sessions[q.key(m)]?.jobs||[];
 if(cmd.id&&!own.some(t=>t.id===cmd.id)&&legacy.some(t=>t.id===cmd.id))return false;
 if(!cmd.id&&['status','stop'].includes(cmd.type)&&legacy.length&&(!own.length||Math.max(...legacy.map(t=>t.updated||0))>own.at(-1).updatedAt))return false;
 return true;
}
function extend(Runtime){const p=Runtime.prototype,snapshot=p.snapshot,receive=p.receive,tick=p.tick,operation=p.operation,configure=p.configure;
 p.handleCodex=async function(m,signal,current){if(!claimed(this,m))return false;const cmd=Cmd.command(m.text);const jobs=ensure(this),r={owner:this.settings.owner,bot:this.self};if(current&&!current())return true;
  try{const result=await jobs.handle(cmd,r,m.id);if(result?.file){if(current&&!current())return true;await Export.send(result.file,m,{directory:this.h.directory,transport:this.transport,signal:signal||new AbortController().signal,current:()=>this.ready&&this.self===r.bot&&this.settings.owner===r.owner&&(!current||current())});}else if(result?.text)jobs.notice(r,result.text,cmd.id||'');}
  catch(e){jobs.notice(r,'项目任务：'+String(e.message||'操作未完成').slice(0,1800));}void jobs.flush();return true;
 };
 p.receive=function(event,now=this.now()){if(this.h.codex){const m=S.message(event,this.self);if(m&&this.valid(m)&&m.id&&m.at&&now-m.at<=120000&&m.at<=now+30000&&claimed(this,m)){const key=this.self+'-'+m.type+'-'+m.target+'-'+m.id;if(this.seen.has(key))return;this.seen.set(key,now);while(this.seen.size>2000)this.seen.delete(this.seen.keys().next().value);const bot=this.self,owner=this.settings.owner;void this.handleCodex(m,null,()=>this.ready&&this.self===bot&&this.settings.owner===owner);return;}}return receive.call(this,event,now);};
 p.tick=function(...args){if(this.codexTasks){void this.codexTasks.pump();void this.codexTasks.flush();}return tick.apply(this,args);};
 p.snapshot=function(){const out=snapshot.call(this);if(this.h.codex)out.codex=ensure(this).snapshot();return out;};
 p.configure=function(v={}){if(v.owner&&String(v.owner)!==this.settings.owner)this.codexTasks?.stopAll();return configure.call(this,v);};
 p.operation=async function(op,v={}){if(!op.startsWith('codex-'))return operation.call(this,op,v);const jobs=ensure(this);if(!jobs)throw Error('当前版本没有启用项目任务接口。');
  if(op==='codex-state')return jobs.snapshot();if(op==='codex-settings')return jobs.configure(v);if(op==='codex-check')return jobs.check();if(op==='codex-project-save')return jobs.addProject(v);if(op==='codex-project-remove')return jobs.removeProject(v.id);
  if(op==='codex-project-pick'){const r=await this.h.codex.pickDirectory();return r.canceled?{canceled:true}:{directory:r.filePaths?.[0]||''};}
  if(op==='codex-executable-pick'){const r=await this.h.codex.pickExecutable();return r.canceled?{canceled:true}:{executable:r.filePaths?.[0]||''};}
  const selected=jobs.state.tasks.find(t=>t.id===v.id),route=selected?{owner:selected.owner,bot:selected.bot}:{owner:this.settings.owner,bot:this.self};if(op==='codex-submit'){const task=jobs.submit(v.project,v.text,route,'');return {ok:true,id:task.id};}if(op==='codex-stop')return jobs.stop(v.id,route);if(op==='codex-respond')return jobs.respond(v.id,v.token,v.accept===true,v.answers,route);if(op==='codex-follow'){const task=jobs.getTask(v.id,route),next=jobs.submit(task.projectId,v.text,route,'',task.id);return {ok:true,id:next.id};}
  if(op==='codex-session-reset'){const project=jobs.state.projects.find(p=>p.id===v.id);if(!project)throw Error('没有找到项目。');if(jobs.state.tasks.some(t=>t.projectId===project.id&&require('./codex-tasks.cjs').LIVE.has(t.status)))throw Error('请先结束这个项目的任务。');project.bindings={};jobs.changed(true);return {ok:true};}
  throw Error('项目任务操作无效。');
 };
 p.closeCodex=function(){this.codexTasks?.close();};
}
module.exports={extend};
