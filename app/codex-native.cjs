'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{clean}=require('./codex-bridge.cjs');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const canonical=p=>path.resolve(p).toLowerCase(),title=t=>clean(t.name||t.preview||'未命名聊天',80).replace(/[\r\n]+/g,' ');
function memberships(home=process.env.CODEX_HOME||path.join(os.homedir(),'.codex')){
 try{const file=path.join(home,'.codex-global-state.json');if(fs.statSync(file).size>12000000)return {};const v=JSON.parse(fs.readFileSync(file,'utf8')),result={};for(const [thread,a]of Object.entries(v['thread-project-assignments']||{})){if(!UUID.test(thread)||a?.projectKind!=='local')continue;for(const [host,map]of Object.entries(v['app-server-project-id-by-legacy-project-id-by-host']||{}))if(host.startsWith('local:')&&UUID.test(map?.[a.projectId]||''))result[thread]=map[a.projectId];}return result;}catch{return {};}
}
function existingDirectory(value){try{if(typeof value!=='string'||!path.isAbsolute(value))return '';const dir=fs.realpathSync(value);return fs.statSync(dir).isDirectory()&&dir!==path.parse(dir).root?dir:'';}catch{return '';}}
async function executionDirectory(manager,thread,projectId){
 const recorded=existingDirectory(thread.cwd);if(recorded)return recorded;
 if(!UUID.test(projectId||''))throw Error('原聊天记录的目录已不存在，且没有可核对的所属项目。请先在Codex中确认该聊天的项目目录。');
 const response=await manager.bridge().request('project/read',{projectId}),project=response.project;if(project?.id!==projectId)throw Error('无法核对聊天所属项目，请刷新项目列表后重试。');
 const roots=[...new Map((project.roots||[]).map(r=>existingDirectory(r.path)).filter(Boolean).map(dir=>[canonical(dir),dir])).values()];
 if(roots.length!==1)throw Error(roots.length?'原聊天旧目录已不存在，当前项目有多个可用目录。请先在Codex中确认该聊天使用的目录。':'原聊天旧目录和所属项目目录均不可用，请先在Codex中更新项目目录。');
 return roots[0];
}
async function discover(manager,options={}){
 const c=manager.bridge();await c.connect();let projects=[],cursor=null;for(let i=0;i<8;i++){const page=await c.request('project/list',{limit:50,...(cursor?{cursor}:{})});projects.push(...(page.data||[]));cursor=page.nextCursor;if(!cursor)break;}
 const page=await c.request('thread/list',{limit:60,sortKey:'updated_at',modelProviders:[],useStateDbOnly:true,...(options.cursor?{cursor:options.cursor}:{}),...(options.query?{searchTerm:String(options.query).slice(0,100)}:{})});
 const legacy=memberships(manager.h.codexHome),threads=(page.data||[]).filter(t=>UUID.test(t.id)&&!t.parentThreadId&&!t.ephemeral&&t.canAcceptDirectInput!==false).map(t=>({id:t.id,name:title(t),directory:t.cwd,projectId:t.projectId||legacy[t.id]||'',updatedAt:t.updatedAt,model:t.model||'',source:typeof t.source==='string'?t.source:'',status:t.status?.type||''}));
 const counts=new Map();for(const p of projects)counts.set(p.name,(counts.get(p.name)||0)+1);
 const prior=options.cursor?manager.catalog?.threads||[]:[];manager.catalog={projects:projects.filter(p=>UUID.test(p.id)).map(p=>({id:p.id,originalName:clean(p.name,80),name:clean(p.name,80)+(counts.get(p.name)>1&&p.roots?.[0]?.path?' · '+clean(p.roots[0].path,180):''),roots:(p.roots||[]).map(r=>r.path).filter(p=>typeof p==='string'&&path.isAbsolute(p))})),threads:[...new Map([...prior,...threads].map(t=>[t.id,t])).values()].slice(-600),nextCursor:page.nextCursor||'',query:String(options.query||''),at:Date.now()};manager.changed();return {ok:true,catalog:manager.catalog};
}
async function bind(manager,v){
 if(!UUID.test(v.threadId||''))throw Error('请从Codex聊天列表选择一个已有聊天。');const c=manager.bridge();await c.connect();const t=(await c.request('thread/read',{threadId:v.threadId,includeTurns:false})).thread;if(!t||t.parentThreadId||t.ephemeral||t.canAcceptDirectInput===false)throw Error('这个聊天不能接收普通任务，请选择你自己的本地聊天。');
 const meta=memberships(manager.h.codexHome),projectId=t.projectId||meta[t.id]||'';if(v.nativeProjectId&&v.nativeProjectId!==projectId)throw Error('聊天所属项目已变化，请刷新后重新选择。');
 const directory=await executionDirectory(manager,t,projectId),old=manager.state.projects.find(p=>p.id===v.id),native=manager.catalog?.projects.find(p=>p.id===projectId);const r=manager.addProject({id:old?.id,name:v.name||old?.name||native?.originalName||native?.name||title(t),directory,aliases:v.aliases??old?.aliases??[],description:old?.description||'',model:''});const p=manager.state.projects.find(p=>p.id===r.project);p.nativeThreadId=t.id;p.nativeTitle=title(t);p.nativeProjectId=projectId;p.nativeProjectName=native?.originalName||native?.name||'';manager.changed(true);return {ok:true,project:p.id};
}
async function queueList(c,threadId){let data=[],cursor;for(let i=0;i<8;i++){const r=await c.request('thread/queue/list',{threadId,limit:60,...(cursor?{cursor}:{})});data.push(...r.data||[]);cursor=r.nextCursor;if(!cursor)break;}return data;}
async function findTurn(c,t){let cursor;for(let i=0;i<6;i++){const page=await c.request('thread/turns/list',{threadId:t.threadId,limit:12,itemsView:'summary',...(cursor?{cursor}:{})});const turn=(page.data||[]).find(row=>row.id===t.turnId&&t.turnId||row.items?.some(item=>item.type==='userMessage'&&(item.clientId===t.nativeClientId||item.id===t.nativeClientId)));if(turn)return turn;cursor=page.nextCursor;if(!cursor)break;}return null;}
async function begin(manager,t){
 const c=manager.bridge();await c.connect();const original=(await c.request('thread/read',{threadId:t.threadId,includeTurns:false})).thread;if(!original)throw Error('原Codex聊天已不可用，请重新绑定。');const projectId=original.projectId||memberships(manager.h.codexHome)[original.id]||'',directory=await executionDirectory(manager,original,projectId);if(canonical(directory)!==canonical(t.directory))throw Error('原Codex聊天的工作目录已变化，请重新绑定后再下发。');
 if(!manager.isActive(t))return;if(t.cancelRequested){t.result='在投递到原聊天前已取消，未发送。';manager.finish(t,'canceled');return;}
 if(!existingDirectory(original.cwd))throw Error('原Codex聊天的默认目录已失效，请先修复旧目录连接或在Codex中更新工作目录后再发送。消息未投递，也不会附加目录说明。');
 t.nativeQueuedAt=Date.now();t.status='host_wait';t.stage='正在将消息交给原Codex聊天';manager.changed(true);
 try{const r=await c.request('thread/queue/add',{threadId:t.threadId,clientUserMessageId:t.nativeClientId,input:[{type:'text',text:t.request}]});t.nativeQueuedId=r.queuedSubmission?.id||'';t.nativeAccepted=true;manager.changed(true);}catch(e){if(!/超时|断开|关闭/.test(e.message))throw e;t.stage='投递结果待确认，未重复发送';manager.changed(true);return;}
 if(!manager.isActive(t))return;if(t.nativeCancelRequested){try{await stop(manager,t);}catch(e){t.stage=clean(e.message,180);manager.changed();}return;}
 try{if(!manager.h.wakeThread)throw Error('当前版本没有Codex桌面唤醒入口。');await manager.h.wakeThread(t.threadId);t.stage='已进入原Codex聊天队列，等待桌面端处理';}catch(e){t.nativeWakeError=clean(e.message,300);t.stage='消息已在原聊天队列，请打开该Codex聊天继续处理';}
 manager.notice(t,'任务 '+t.id+' 已交给原Codex聊天「'+t.nativeTitle+'」，结果会回到同一段聊天历史，并通知你的QQ。',t.id,'start');manager.changed(true);
}
function applyTurn(t,turn){
 t.turnId=turn.id;t.nativeAccepted=true;t.status='running';t.stage='原Codex聊天正在执行；需要确认时请在Codex中处理';
 const items=turn.items||[],final=items.filter(i=>i.type==='agentMessage'&&i.phase!=='commentary');if(final.length)t.result=clean(final.map(i=>i.text).join('\n'),48000);
 const commentary=items.filter(i=>i.type==='agentMessage'&&i.phase==='commentary').at(-1);if(commentary)t.stage=clean(commentary.text,180);
 const commands=items.filter(i=>i.type==='commandExecution');if(commands.length)t.checks=commands.slice(-30).map(i=>({command:clean(i.command,500),exitCode:i.exitCode??null,status:i.status||''}));
 const files=items.filter(i=>i.type==='fileChange').flatMap(i=>(i.changes||[]).map(v=>v.path)).filter(v=>typeof v==='string');if(files.length)t.files=[...new Set([...t.files,...files.map(p=>clean(p,500))])].slice(-80);
}
async function poll(manager,t){
 if(t.nativePolling||Date.now()<(t.nativeNextPoll||0))return;t.nativePolling=true;t.nativeNextPoll=Date.now()+2500;
 try{const c=manager.bridge();await c.connect();const turn=await findTurn(c,t);if(!manager.isActive(t))return;
  if(turn){applyTurn(t,turn);t.updatedAt=Date.now();if(['completed','failed'].includes(turn.status)||turn.status==='interrupted'&&turn.completedAt!=null){
    // A read-only server can report an in-flight foreign turn as interrupted until its terminal timestamp is persisted.
    try{const page=await c.request('thread/items/list',{threadId:t.threadId,turnId:turn.id,sortDirection:'desc',limit:60});applyTurn(t,{...turn,items:(page.data||[]).map(row=>row.item).filter(Boolean).reverse()});}catch{}
    manager.finish(t,turn.status==='completed'?'completed':turn.status==='interrupted'?'canceled':'failed',turn.error?.message||'');return;
   }
  }else{const rows=await queueList(c,t.threadId),row=rows.find(q=>q.clientUserMessageId===t.nativeClientId);if(row){t.nativeQueuedId=row.id;t.nativeAccepted=true;t.stage=t.nativeWakeError?'消息已在原聊天队列，请打开该Codex聊天继续处理':'已进入原Codex聊天队列，等待桌面端处理';}else if(!t.nativeAccepted&&Date.now()-t.nativeQueuedAt>60000){manager.finish(t,'failed','未确认原聊天是否收到消息，未自动重复下发。请检查原Codex聊天后再决定是否重试。');return;}else t.stage='等待原Codex聊天更新执行结果';t.status='host_wait';}
  manager.changed();
 }catch(e){t.stage='暂时无法查询原Codex聊天，稍后继续确认：'+clean(e.message,150);manager.changed();}finally{delete t.nativePolling;}
}
async function stop(manager,t){
 t.nativeCancelRequested=true;manager.changed(true);
 const c=manager.bridge();await c.connect();const queued=(await queueList(c,t.threadId)).find(q=>q.clientUserMessageId===t.nativeClientId);if(queued){const r=await c.request('thread/queue/delete',{threadId:t.threadId,queuedSubmissionId:queued.id});if(r.deleted){t.result='已从原Codex聊天队列移除，未开始执行。';manager.finish(t,'canceled');return {ok:true};}}
 const turn=await findTurn(c,t);if(turn&&['completed','failed'].includes(turn.status)){await poll(manager,Object.assign(t,{nativeNextPoll:0}));return {ok:true};}
 if(turn?.id)try{await c.request('turn/interrupt',{threadId:t.threadId,turnId:turn.id},5000);t.stage='已请求原Codex停止，正在确认结果';manager.changed(true);return {ok:true};}catch{}
 throw Error('消息已由Codex桌面接手，无法从此连接确认中断。请在原Codex聊天点击停止；桌宠会继续查询实际结果。');
}
async function latestResult(manager,project){
 const c=manager.bridge();await c.connect();const original=(await c.request('thread/read',{threadId:project.nativeThreadId,includeTurns:false})).thread;if(!original||original.id!==project.nativeThreadId)throw Error('原Codex聊天不可用，请重新绑定。');
 const projectId=original.projectId||memberships(manager.h.codexHome)[original.id]||'',directory=await executionDirectory(manager,original,projectId);if(canonical(directory)!==canonical(project.directory))throw Error('原聊天项目目录已变化，请重新绑定后读取成果。');
 const turns=(await c.request('thread/turns/list',{threadId:original.id,limit:8,itemsView:'summary',sortDirection:'desc'})).data||[];if(!turns.length)throw Error('原聊天还没有可读取的任务成果。');let fallback;
 for(const turn of turns.slice(0,8)){const rows=(await c.request('thread/items/list',{threadId:original.id,turnId:turn.id,sortDirection:'desc',limit:60})).data||[],items=rows.map(r=>r.item).filter(Boolean).reverse(),v={turnId:turn.id,status:turn.status,completedAt:turn.completedAt,startedAt:turn.startedAt,result:clean(items.filter(i=>i.type==='agentMessage'&&i.phase!=='commentary').map(i=>i.text).join('\n'),48000),files:items.filter(i=>i.type==='fileChange').flatMap(i=>(i.changes||[]).map(v=>v.path)).filter(v=>typeof v==='string')};
  fallback??=v;if(!['completed','failed'].includes(v.status)&&!(v.status==='interrupted'&&v.completedAt!=null))return v;const stamp=Number(v.startedAt)||Date.now();if(require('./codex-artifacts.cjs').collect({...v,directory:project.directory,createdAt:stamp<100000000000?stamp*1000:stamp},manager.h.codexHome).length)return v;
 }return fallback;
}
module.exports={UUID,discover,bind,begin,poll,stop,findTurn,memberships,latestResult};
