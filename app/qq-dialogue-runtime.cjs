'use strict';
const Events=require('./qq-event-memory.cjs');
const Learning=require('./qq-expression-learning.cjs');
const Turn=require('./qq-dialogue-turn.cjs'),{DailyReview,day,scope}=require('./qq-daily-review.cjs');
function ensure(q){return q.dialogueReview??=new DailyReview(q);}
function extend(Runtime){const p=Runtime.prototype,tick=p.tick,generate=p.generateTurn,operation=p.operation;
 p.tick=function(now=this.now()){tick.call(this,now);ensure(this).tick(now);};
 p.generateTurn=async function(options){const m=options.identity,c=this.active?.c||this.sessions[this.key(m)],now=this.now();this.guessSessions??=new Map();const key=this.key(m)+'-'+m.sender;let since=this.guessSessions.get(key)||0;
  if(!options.proactive&&Turn.endGuess(m.text)){this.guessSessions.delete(key);since=0;}else if(!options.proactive&&Turn.guessing(m.text)){since=now;this.guessSessions.set(key,now);}for(const [k,at]of this.guessSessions)if(now-at>600000)this.guessSessions.delete(k);
  const guessingImages=!options.proactive&&since>0&&now-since<600000&&options.imageRows?.some(r=>r.inputs?.some(p=>p.type==='input_image'));
  const deniedSources=c?Events.blocked(c):new Set();const identity={...m,guessingImages,liveDiscussion:(c?.history||[]).filter(r=>!r.recalled&&!r.contextExcluded&&!deniedSources.has(r.messageId)&&!deniedSources.has(r.replySource)).slice(-16).map(r=>({id:r.messageId,role:r.role,sender:r.sender,name:r.name,text:r.text.slice(0,650),at:r.at}))};
  const caseRecords=m.type==='group'&&c?Events.cases(c,ensure(this).selected(this.key(m),now,m.text),scope(this,this.key(m))):[];
  const preferences={...options.preferences,dailyReviewGuidance:m.type==='group'&&c?.type==='group'?ensure(this).guidance(this.key(m),now,m.text)+(caseRecords.length?'\n对应的真实交流案例（仅供理解，不能当本轮新消息或照抄台词）：'+JSON.stringify(caseRecords):''):''};
  preferences.dailyReviewGuidance+=require('./qq-self-memory.cjs').ensure(this).guidance(m.text||'');
  if(this.active?.m&&m.type==='group')this.active.m.reviewHabitIds=ensure(this).selected(this.key(m),now,m.text).map(h=>h.id);
  const next={...options,identity,preferences};let result=await generate.call(this,next);if(result.skip||result.ownerAlert||result.document||result.taskOutput||m.fileRequested||m.backgroundTask)return result;
  if(Turn.duplicate(result.text||result.reply,c,now)){result=await generate.call(this,{...next,identity:{...identity,replyRepair:true}});if(!result.skip&&!result.ownerAlert&&!result.document&&!result.taskOutput&&Turn.duplicate(result.text||result.reply,c,this.now()))return {...result,skip:!!options.proactive,reason:'重新生成后仍无新内容',text:options.proactive?'':'刚才那句话我已经说过了，这次的新意思还没接准。',reply:undefined,sticker:'',saveStickers:[],memoryUpdates:[],peerUpdates:[],reaction:null};}
  return result;
 };
 const deliver=p.deliver;p.deliver=async function(m,...args){const result=await deliver.call(this,m,...args);if(m.type==='group'&&m.reviewHabitIds?.length&&args[2]?.())ensure(this).noteSent(this.key(m),m,this.now());return result;};
 p.operation=async function(op,v={}){if(!op.startsWith('dialogue-review')){let id;if(op==='clear-conversation'&&typeof v.key==='string'&&v.key.startsWith(this.prefix())&&this.sessions[v.key]?.type==='group')id=scope(this,v.key);const r=await operation.call(this,op,v);if(id&&this.dialogueReview){this.dialogueReview.controller?.abort();for(const k of Object.keys(this.dialogueReview.state.groups))if(k.startsWith(v.key+'-'))delete this.dialogueReview.state.groups[k];this.dialogueReview.save();}return r;}if(op==='dialogue-review-schedule'){const review=ensure(this);if(!require('./qq-daily-review.cjs').validTime(v.time))throw Error('请选择有效的复盘时间');review.state.reviewTime=v.time;review.next=0;review.save();this.emit();return {ok:true,reviewTime:v.time};}const c=this.sessions[v.key];if(typeof v.key!=='string'||!v.key.startsWith(this.prefix())||c?.type!=='group'||!this.settings.groups.includes(c.target))throw Error('只能管理当前账号已允许的群聊复盘。');const review=ensure(this),g=review.group(v.key);
  if(op==='dialogue-review-toggle'){if(typeof v.enabled!=='boolean')throw Error('开关无效。');g.enabled=v.enabled;if(!v.enabled)review.controller?.abort();review.save();}
  else if(op==='dialogue-review-undo'){if(!Object.hasOwn(review.view(v.key).catalog,v.code))throw Error('调整项无效。');g.disabled=[...new Set([...g.disabled,v.code])];review.save();}
  else if(op==='dialogue-review-restore'){g.disabled=[];g.blockedHabits=[];for(const h of g.habits||[])if(h.status==='revoked'){h.status='trial';h.expires=this.now()+7*86400000;h.updated=this.now();}review.save();}
  else if(op==='dialogue-review-habit-revoke'){const h=g.habits?.find(h=>h.id===v.id);if(!h)throw Error('经验不存在。');h.status='revoked';h.reason='主人已撤销';g.blockedHabits=[...new Set([...(g.blockedHabits||[]),h.signature])].slice(-100);review.save();}
  else if(op==='dialogue-review-habit-rollback'){const h=g.habits?.find(h=>h.id===v.id);const old=h?.revisions?.at(-1),body=Learning.content(old);if(!h||!body)throw Error('没有可恢复的上一版经验。');h.revisions.pop();Object.assign(h,body,{signature:Learning.signature(body),revision:h.revision+1,evidence:old.evidence||[],evaluations:[],status:h.status==='revoked'?'revoked':'trial',updated:this.now(),expires:this.now()+7*86400000});review.save();}
  else if(op==='dialogue-review-run'){if(this.busy||this.h.canReply?.()===false)throw Error('请等当前对话处理完成后再复盘。');await review.run(v.key,day(this.now()),true);}
  else if(op!=='dialogue-review')throw Error('复盘操作无效。');this.emit();return {ok:true,...review.view(v.key)};
 };
 for(const name of ['stop','disconnected']){const original=p[name];p[name]=function(...args){this.dialogueReview?.controller?.abort();return original.apply(this,args);};}
}
module.exports={extend};
