'use strict';
const S=require('./qq-state.cjs');
const WINDOW=60000,QUOTE_WINDOW=30000,SETTLE=750;
const natural=m=>m?.type==='group'&&m.proactive===true;
function recent(m,now){const at=Number(m.at)||Number(m.queuedAt)||0;return !!at&&now-at<=WINDOW&&at<=now+30000;}
function tokens(text){return new Set((String(text||'').toLowerCase().match(/[a-z0-9]{2,}|[\u4e00-\u9fff]{2,}/g)||[]).flatMap(v=>/^[a-z0-9]+$/.test(v)?[v]:Array.from({length:v.length-1},(_,i)=>v.slice(i,i+2))));}
function compatible(m,latest){
 if(!latest||latest.id===m.id)return true;
 if(S.called({},latest))return false;
 if(latest.at-m.at>10000)return false;
 if(latest.topic&&latest.topic===m.topic)return true;
 if(/^(?:哈+|呵呵|哈哈哈+|笑死|确实|是的|嗯+|对+|好+|赞|[。，！!?？~～\s])+$/u.test(latest.text||''))return true;
 const words=tokens(m.text);return [...tokens(latest.text)].some(t=>words.has(t));
}
function latest(q,m){const live=q.realtimeLatest?.get(q.key(m));if(live)return live;const h=q.sessions[q.key(m)]?.history||[];const row=h.filter(v=>v.role==='user'&&!v.catchup&&!v.recalled).at(-1);return row?{...row,id:row.messageId}:null;}
function current(q,m){return !natural(m)||recent(m,q.now())&&compatible(m,latest(q,m));}
function quoteAllowed(m,row){if(!natural(m))return true;const now=Number(m.realtimeAt)||Number(m.at)||0;return !!row&&row.role==='user'&&!row.catchup&&!row.recalled&&row.at>=now-QUOTE_WINDOW&&row.at<=now+30000&&(!Array.isArray(m.realtimeIds)||m.realtimeIds.includes(row.messageId));}
function view(q,m,c,pref){
 if(!natural(m))return pref.multiTopics?require('./qq-topics.cjs').view(c,m):structuredClone(c);
 const now=q.now(),rows=(c.history||[]).filter(v=>!v.recalled&&!v.contextExcluded&&!v.catchup&&v.at>=now-WINDOW&&v.at<=now+30000).slice(-20);
 // Do not erase the stored conversation. This is a bounded view for a single
 // spontaneous turn; stable, source-backed preferences remain background.
 const history=[];let chars=0;for(let i=rows.length-1;i>=0;i--){if(chars+rows[i].text.length>10000)break;history.unshift(structuredClone(rows[i]));chars+=rows[i].text.length;}
 m.realtimeAt=now;m.realtimeIds=history.filter(v=>v.role==='user'&&v.at>=now-QUOTE_WINDOW).map(v=>v.messageId);
 return {...c,history,summary:'',memory:c.memory?{...c.memory,experiences:[],notes:c.memory.notes.slice(),excluded:c.memory.excluded.slice()}:undefined,
  topicContext:{current:m.topic||'',participants:[...new Set(history.map(v=>v.sender))],otherTopics:[]},
  realtime:{now,windowStart:now-WINDOW,focusId:m.id,latestId:latest(q,m)?.id||m.id,quoteEligible:m.realtimeIds,backgroundIsNotPending:true}};
}
function prune(q,now=q.now()){
 for(const [key,p]of q.groupPending)if(!recent(p.m,now)||!compatible(p.m,latest(q,p.m))){q.groupPending.delete(key);clearTimeout(q.debounce.get(key));q.debounce.delete(key);q.groupStatus.set(q.key(p.m),'旧消息已过期，等待当前话题');}
 q.queue=q.queue.filter(m=>!natural(m)||recent(m,now)&&compatible(m,latest(q,m)));
}
function observe(q,m){
 if(m.type!=='group')return;
 const previous=q.realtimeLatest?.get(q.key(m));if(previous&&m.at<previous.at)return;
 q.realtimeLatest??=new Map();q.realtimeLatest.set(q.key(m),{id:m.id,at:m.at,text:m.text,topic:m.topic,sender:m.sender,mention:m.mention});
 while(q.realtimeLatest.size>200)q.realtimeLatest.delete(q.realtimeLatest.keys().next().value);
 q.queue=q.queue.filter(old=>!natural(old)||q.key(old)!==q.key(m));
 const a=q.active;if(a&&natural(a.m)&&q.key(a.m)===q.key(m)&&!a.controller.signal.aborted&&!compatible(a.m,latest(q,m))){a.controller.abort();q.groupStatus.set(q.key(m),'话题已更新，等待最新讨论');q.log('fresh-topic','群里有新话题，取消尚未发送的旧接话。');}
}
function extend(Runtime){const p=Runtime.prototype,defer=p.deferGroup,flush=p.flushGroups,enqueue=p.enqueue,revise=p.reviseActive,clear=p.clearTopicPending,send=p.send,generate=p.generateTurn;
 p.observeCurrent=function(m){observe(this,m);};p.naturalCurrent=function(m){return current(this,m);};p.naturalConversation=function(m,c,pref){return view(this,m,c,pref);};
 p.pendingKey=function(m){return this.key(m);};
 p.deferGroup=function(m,now=this.now(),readyAt=now+SETTLE){if(m.type==='group'&&(!recent(m,now)||(latest(this,m)?.at||0)>m.at))return;return defer.call(this,m,now,readyAt);};
 p.flushGroups=function(now=this.now()){prune(this,now);return flush.call(this,now);};
 p.enqueue=function(m){if(natural(m)){if(!current(this,m))return false;this.queue=this.queue.filter(v=>!natural(v)||this.key(v)!==this.key(m));}return enqueue.call(this,m);};
 p.clearTopicPending=function(m,all=false){return clear.call(this,m,all||m.type==='group');};
 p.reviseActive=function(m){if(natural(this.active?.m))return false;return revise.call(this,m);};
 p.send=async function(m,...args){if(!current(this,m)){this.active?.controller.abort();throw Error('旧群聊接话已过期，未发送。');}return send.call(this,m,...args);};
 p.generateTurn=async function(options){const a=this.active,m=a?.m||options.identity;if(!natural(m))return generate.call(this,options);const budget=Math.max(1,WINDOW-(this.now()-(m.at||this.now()))),timer=setTimeout(()=>{if(this.active?.controller===a?.controller){a?.controller.abort();this.groupStatus.set(this.key(m),'旧接话已超时，等待当前话题');this.emit();}},budget);timer.unref?.();try{const result=await generate.call(this,options);if(!current(this,m))this.groupStatus.set(this.key(m),'话题已变化或过期，等待当前讨论');return result;}finally{clearTimeout(timer);}};
 for(const name of ['stop','disconnected']){const prior=p[name];p[name]=function(...args){this.realtimeLatest?.clear();return prior.apply(this,args);};}
}
module.exports={WINDOW,QUOTE_WINDOW,SETTLE,natural,recent,compatible,current,quoteAllowed,view,prune,observe,extend};
