'use strict';
const Persona=require('./qq-persona-state.cjs'),Character=require('./qq-group-character.cjs');
function extend(Runtime){const p=Runtime.prototype,generate=p.generateTurn,operation=p.operation;
 p.generateTurn=async function(options){const m=options.identity,c=this.active?.c||this.sessions[this.key(m)],pref=options.preferences||this.preferences(m),card=Character.resolve(this.h.card?.()||{},m,pref);const state=c?Persona.context(c,m,card,this.now()):[];
  return generate.call(this,{...options,identity:{...m,personaState:state,expressionCapabilities:{voice:pref.voiceMode!=='text'&&typeof this.h.synthesize==='function'&&this.h.voiceReady?.()!==false,stickers:pref.stickers!==false,reaction:pref.emojiReplies!==false&&m.type==='group'}}});
 };
 p.operation=async function(op,v={}){if(!['persona-state','persona-state-forget'].includes(op))return operation.call(this,op,v);if(typeof v.key!=='string'||!v.key.startsWith(this.prefix())||!this.sessions[v.key])throw Error('会话不属于当前QQ。');const c=this.sessions[v.key],m={type:c.type,target:c.target,sender:String(v.sender||this.settings.owner)},card=Character.resolve(this.h.card?.()||{},m,this.preferences(m));if(op==='persona-state-forget'){if(this.busy)throw Error('请等当前回复完成后再整理。');const item=c.memory?.persona?.items.find(i=>i.sourceIds[0]===v.id&&i.roleKey===Persona.key(card));if(item){Persona.forget(c,item.sourceIds);this.emit();require('./qq-event-memory-runtime.cjs').saveForget(this,v.key);}}return {ok:true,items:Persona.context(c,m,card,this.now())};};
}
module.exports={extend};
