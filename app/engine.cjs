'use strict';
const {catalog:EMOTES,find:findEmote}=require('./emotes.js');
const {idsFor,inferReaction}=require('./reactions.cjs');
const {findPreset}=require('./utterances.cjs');
const {parts:bodyParts,reaction:bodyReaction}=require('./body-interactions.js');
const STATES = {
 idle: [0,6,[280,110,110,140,140,320]], right:[1,8,Array(8).fill(120)],
 left:[2,8,Array(8).fill(120)], wave:[3,4,[140,140,140,280]],
 jump:[4,5,[140,140,140,140,280]], failed:[5,8,Array(8).fill(140)],
 waiting:[6,6,Array(6).fill(180)], work:[7,6,Array(6).fill(180)],
 review:[8,6,Array(6).fill(200)]
};
const defaults = {form:'classic',keyboardFollow:true,autoEmotes:true,contextEmotes:true,scale:1, roam:true, speech:true, alwaysOnTop:true, speed:35, focusMinutes:25,drinkReminder:true,restReminder:true,drinkMinutes:45,restMinutes:60};
function settings(input={}) {
 const s={...defaults};
 if(['classic','desk'].includes(input.form))s.form=input.form;
 for(const k of ['keyboardFollow','autoEmotes','contextEmotes','roam','speech','alwaysOnTop','drinkReminder','restReminder']) if(typeof input[k]==='boolean') s[k]=input[k];
 for(const [k,min,max] of [['scale',.65,1.6],['speed',15,75],['focusMinutes',1,180],['drinkMinutes',1,240],['restMinutes',1,240]])
  if(Number.isFinite(input[k])) s[k]=Math.min(max,Math.max(min,input[k]));
 return s;
}
function clampPosition(p, area, size) {
 return {x:Math.max(area.x,Math.min(p.x,area.x+area.width-size.width)),
 y:Math.max(area.y,Math.min(p.y,area.y+area.height-size.height))};
}
class Engine {
 constructor(saved={},now=Date.now(),random=Math.random){
  this.random=random;this.settings=settings(saved.settings);this.mode='companion';
  this.action={name:'idle',until:0};this.focus=null;this.completed=Number.isSafeInteger(saved.completed)?saved.completed:0;
  this.emotionHold=null;this.bodyMotion=null;this.lastTouch=null;this.interactionUntil=0;this.touchSpeechAt=-Infinity;
  this.performance=null;this.performanceActive=false;this.reactionQueueSource='context';this.reactionQueue=[];this.deskGesture=null;this.emote=null;this.nextEmote=now+45000;this.lastTyping=-Infinity;this.dragging=false;this.walk=null;this.nextActivity=now+12000;this.nextSpeech=now+50000;
  this.message='';this.messageUntil=0;this.lastNow=now;
  const bounded=(v,fallback)=>Number.isFinite(v)?Math.min(100,Math.max(0,v)):fallback;
  this.care={mood:bounded(saved.care?.mood,75),energy:bounded(saved.care?.energy,80),affinity:bounded(saved.care?.affinity,0)};
  this.journal=Array.isArray(saved.journal)?saved.journal.slice(-100):[];
  this.todos=Array.isArray(saved.todos)?saved.todos.filter(v=>typeof v?.id==='string'&&typeof v?.text==='string').slice(0,50):[];
  this.daily=saved.daily&&typeof saved.daily==='object'?saved.daily:{};
  this.careCooldown=0;this.reminders={drink:now+this.settings.drinkMinutes*60000,rest:now+this.settings.restMinutes*60000};
  if(saved.focus && Number.isFinite(saved.focus.deadline) && saved.focus.deadline>0) {
   this.focus={deadline:saved.focus.deadline,remaining:Math.max(0,saved.focus.deadline-now),paused:!!saved.focus.paused,minutes:saved.focus.minutes||this.settings.focusMinutes};
   if(this.focus.paused) this.focus.remaining=Math.max(0,Number(saved.focus.remaining)||0);
   this.mode='focus';
  }
 }
 say(text,now,duration=6500,source='interaction'){this.lastVoicePreset=null;this.lastSpeechSource=source;this.lastUtterance=text;this.speechId=(this.speechId||0)+1;if(this.settings.speech){this.message=text;this.messageUntil=now+duration;}}
 record(text,now){this.journal.push({at:now,text});this.journal=this.journal.slice(-100);}
 careFor(label,now,energy=0){
  if(now<this.careCooldown)return false;
  this.care.mood=Math.min(100,this.care.mood+7);this.care.energy=Math.min(100,this.care.energy+energy);this.care.affinity=Math.min(100,this.care.affinity+2);
  this.careCooldown=now+12000;this.record(label,now);return true;
 }
 todo(operation,payload,now=Date.now()){
  if(operation==='add'&&typeof payload==='string'){const text=payload.trim().slice(0,120);if(text&&this.todos.length<50){this.todos.push({id:now.toString(36)+'-'+this.random().toString(36).slice(2,8),text,done:false});return true;}}
  const item=this.todos.find(v=>v.id===payload);if(!item)return false;
  if(operation==='toggle'){item.done=!item.done;if(item.done){this.record('完成待办：'+item.text,now);this.play('wave',now);this.say('又写好了一笔。辛苦了。',now);}return true;}
  if(operation==='remove'){this.todos=this.todos.filter(v=>v!==item);return true;}return false;
 }
 play(name,now,loops=1){if(!STATES[name])return;this.walk=null;const duration=STATES[name][2].reduce((a,b)=>a+b,0);this.action={name,until:now+duration*loops};}
 startEmote(command,now,source='manual'){
  if(source==='manual')this.reactionQueue=[];
  const item=findEmote(command);if(!item||item.form!==this.settings.form)return false;
  this.emotionHold=null;this.bodyMotion=null;
  this.emote={command:item.command,form:item.form,started:now,until:now+item.duration,source};
  this.walk=null;this.action={name:'idle',until:0};this.deskGesture=null;
  this.nextActivity=Math.max(this.nextActivity,this.emote.until+5000);this.nextEmote=now+35000+this.random()*35000;return true;
 }
 react(reaction,now=Date.now(),source='context'){
  if(!this.settings.contextEmotes||this.dragging)return false;
  if(source==='chat'&&(now<this.interactionUntil||this.bodyMotion?.until>now))return false;
  if(this.emote?.source==='manual'&&this.emote.until>now)return false;
  const ids=idsFor(this.settings.form,reaction).filter(id=>findEmote('emote:'+this.settings.form+':'+id));
  if(!ids.length)return false;
  const commands=ids.map(id=>'emote:'+this.settings.form+':'+id);
  this.startEmote(commands.shift(),now,source);this.reactionQueue=commands;this.reactionQueueSource=source;return true;
 }
 clearFeeling(){this.emotionHold=null;}
 holdEmotion(expression,now=Date.now()){
  if(!expression||!this.settings.contextEmotes||this.dragging||now<this.interactionUntil||this.bodyMotion?.until>now||this.emote?.source==='manual')return false;
  const id=idsFor(this.settings.form,{expression})[0],item=findEmote('emote:'+this.settings.form+':'+id);if(!item)return false;
  this.emote=null;this.reactionQueue=[];this.walk=null;this.deskGesture=null;this.action={name:'idle',until:0};
  this.emotionHold={command:item.command,form:item.form,started:now,until:now+6500,source:'afterglow',held:true};
  this.nextActivity=Math.max(this.nextActivity,now+9500);this.nextEmote=Math.max(this.nextEmote,now+16000);return true;
 }
 touch(part,now=Date.now()){
  if(!bodyParts.includes(part)||this.dragging)return false;
  if(this.lastTouch&&now-this.lastTouch.at<300)return false;
  const count=this.lastTouch?.part===part&&now-this.lastTouch.at<=8000?this.lastTouch.count+1:1;
  this.lastTouch={part,count,at:now};const response=bodyReaction(part,count);
  this.emote=null;this.emotionHold=null;this.bodyMotion=null;this.walk=null;this.deskGesture=null;this.reactionQueue=[];this.action={name:'idle',until:0};
  this.careFor({head:'轻轻摸了摸颉的头。',face:'轻轻戳了戳颉的脸。',tail:'轻轻碰了碰颉的尾巴。',body:'轻轻叫了叫颉。'}[part],now);
  if(this.settings.contextEmotes){
   if(part==='tail')this.bodyMotion={id:'tail-'+this.settings.form,form:this.settings.form,started:now,until:now+2700,source:'touch'};
   else this.startEmote('emote:'+this.settings.form+':'+idsFor(this.settings.form,{expression:response.expression})[0],now,'touch');
   this.interactionUntil=now+2700;
  }
  if(!this.settings.contextEmotes&&part==='head')this.play('wave',now,2);
  this.nextActivity=now+9000;this.nextEmote=now+18000;
  // Touch must not replace the bubble or queue speech over an ongoing answer.
  if(!this.performanceActive&&now-this.touchSpeechAt>=6000){this.say(response.text,now);this.touchSpeechAt=now;}
  return true;
 }
 beginDrag(now=Date.now()){this.emotionHold=null;this.bodyMotion=null;this.interactionUntil=0;this.dragging=true;this.walk=null;this.emote=null;this.reactionQueueSource='context';this.reactionQueue=[];this.deskGesture=null;this.action={name:'idle',until:0};this.dragStarted=now;}
 endDrag(now=Date.now()){
  if(!this.dragging)return false;this.dragging=false;this.emotionHold=null;this.emote=null;this.reactionQueue=[];
  this.bodyMotion={id:'landing',form:this.settings.form,started:now,until:now+2450,source:'landing'};this.interactionUntil=now+2450;
  this.nextActivity=now+10000;this.nextEmote=now+35000;return true;
 }
 noteTyping(now=Date.now()){this.lastTyping=now;if(this.emote?.source==='automatic'&&findEmote(this.emote.command)?.kind==='action')this.emote=null;}
 command(name,now=Date.now()) {
  if(name==='touch'){this.touch('head',now);return;}
  this.emotionHold=null;this.bodyMotion=null;this.interactionUntil=0;
  if(name.startsWith('greeting:')){const line=findPreset(name.slice(9));if(line){this.say(line.text,now,9000,'greeting');this.react({expression:line.expression,gesture:['arrival','morning','evening','return','wave'].includes(line.id)?'greet':undefined},now);}return;}
  this.reactionQueue=[];
  if(findEmote(name)){this.startEmote(name,now);return;}
  if(['touch','tea','type-demo','talk','jump','wave','read','rest','companion','focus','stop-focus'].includes(name))this.emote=null;
  if(name==='type-demo'&&this.settings.form==='desk')this.deskGesture={name:'typing',started:now,until:now+4000};
  if(name==='tea'){if(this.settings.form==='desk')this.deskGesture={name:'tea',started:now,until:now+4200};const changed=this.careFor('为颉递了一盏茶。',now,12);this.play('waiting',now,2);this.say(changed?'温度刚好，多谢。你也喝一口吧。':'茶还温着，不必急着再添。',now);}
  if(name==='talk'){this.play('review',now,2);this.careFor('与颉闲谈片刻。',now);const words=['有些事，记下来，便不容易忘。','若是今日很累，便把这一页留给明日。','不必每一步都走得快。走稳些，也很好。','我喜欢这样的片刻：一卷书，一盏茶，还有你。'];this.say(words[Math.floor(this.random()*words.length)],now,9000);}
  if(name==='jump'){this.play('jump',now,1);this.say('偶尔活动一下，也很好。',now);}
  if(name==='wave'){this.play('wave',now,2);this.say('见到你，真好。',now);}
  if(name==='read'){this.careFor('与颉一起读书。',now,2);this.mode='read';this.walk=null;this.action={name:'work',until:0};this.say('这一卷还未读完。你也忙你的吧。',now);}
  if(name==='rest'){this.record('让颉歇一会儿。',now);this.mode='rest';this.walk=null;this.action={name:'idle',until:0};this.say('歇一会儿。我就在这里。',now);}
  if(name==='companion'){this.mode=this.focus?'focus':'companion';this.walk=null;this.nextActivity=now+5000;this.action={name:'idle',until:0};this.say('好，我陪着你。',now);}
  if(name==='focus'){this.focus={deadline:now+this.settings.focusMinutes*60000,remaining:this.settings.focusMinutes*60000,paused:false,minutes:this.settings.focusMinutes};this.mode='focus';this.walk=null;this.record('开始 '+this.settings.focusMinutes+' 分钟专注。',now);this.say('不急，一件一件做。我陪你把这一段时间过好。',now);}
  const reactions={touch:{expression:'shy'},tea:{expression:'smile'},talk:{gesture:'ponder'},wave:{gesture:'greet'},read:{gesture:'unroll',expression:'serious'},rest:{expression:'sleepy'},companion:{expression:'comfort'},focus:{expression:'serious',gesture:'ponder'},'stop-focus':{expression:'relief',gesture:'stretch'}};
  if(reactions[name]){if(name==='tea'&&this.settings.form==='desk'){this.reactionQueue=['emote:desk:smile'];}else this.react(reactions[name],now);}
  if(name==='pause-focus'&&this.focus){if(this.focus.paused){this.focus.deadline=now+this.focus.remaining;this.focus.paused=false;}else{this.focus.remaining=Math.max(0,this.focus.deadline-now);this.focus.paused=true;}}
  if(name==='stop-focus'){this.focus=null;this.mode='companion';this.nextActivity=now+10000;this.play('wave',now);this.say('辛苦了，先把肩膀放松些。',now);}
 }
 tick(now,position,area,size){
  const dt=Math.min(.15,Math.max(0,(now-this.lastNow)/1000));this.lastNow=now;
  let focusDone=false;const notifications=[];
  this.care.energy=Math.min(100,Math.max(0,this.care.energy+(this.mode==='rest'?.035:-.002)*dt));
  this.care.mood=Math.max(0,this.care.mood-.0008*dt);
  if(this.focus&&!this.focus.paused&&now>=this.focus.deadline){
   const date=new Date(now).toLocaleDateString('sv-SE');const day=this.daily[date]||{count:0,minutes:0};day.count++;day.minutes+=this.focus.minutes||this.settings.focusMinutes;this.daily[date]=day;
   const keys=Object.keys(this.daily).sort();while(keys.length>60)delete this.daily[keys.shift()];
   this.record('完成一段专注，写下 '+(this.focus.minutes||this.settings.focusMinutes)+' 分钟的成果。',now);this.careFor('颉陪你完成专注。',now,3);
   this.focus=null;this.mode='companion';this.completed++;focusDone=true;
   if(!this.musicPriority){this.play('wave',now,3);this.react({expression:'relief',gesture:'stretch'},now);}this.say('这一段已经完成。喝点水，望一眼窗外吧。',now,11000,'reminder');this.nextActivity=now+14000;
  }
  for(const [kind,enabled,minutes,text] of [['drink',this.settings.drinkReminder,this.settings.drinkMinutes,'茶还温着。记得喝点水。'],['rest',this.settings.restReminder,this.settings.restMinutes,'先歇一歇吧。看看远处，松一松肩膀。']]){
   if(now>=this.reminders[kind]){this.reminders[kind]=now+minutes*60000;if(enabled){notifications.push(text);this.say(text,now,10000,'reminder');if(!this.musicPriority)this.play('wave',now,2);}}
  }
  if(this.emotionHold&&(now>=this.emotionHold.until||this.emotionHold.form!==this.settings.form||this.dragging||!this.settings.contextEmotes))this.emotionHold=null;
  if(this.bodyMotion&&(now>=this.bodyMotion.until||this.bodyMotion.form!==this.settings.form||this.dragging)){this.bodyMotion=null;if(this.performanceActive&&this.performance?.reaction)this.react(this.performance.reaction,now,'chat');}
  if(this.emote&&(now>=this.emote.until||this.emote.form!==this.settings.form||this.dragging))this.emote=null;
  if(this.dragging||!this.settings.contextEmotes)this.reactionQueue=[];
  if(!this.emotionHold&&!this.bodyMotion&&!this.emote&&this.reactionQueue.length&&!this.deskGesture)this.startEmote(this.reactionQueue.shift(),now,this.reactionQueueSource);
  if(!this.externalIdle&&!this.performanceActive&&!this.emotionHold&&!this.bodyMotion&&this.settings.autoEmotes&&!this.emote&&!this.dragging&&!this.walk&&!this.deskGesture&&this.mode!=='rest'&&this.action.until<=now&&now>=this.nextEmote&&now-this.lastTyping>2000){
   const form=this.settings.form,working=['read','focus'].includes(this.mode);
   const ids=working?(form==='classic'?['ponder','serious']:['think','inspect']):this.care.energy<25?['sleepy']:(form==='classic'?['nod','ponder','smile','laugh','comfort','tail']:['smile','think','inspect','chin','nod','relief']);
   const id=ids[Math.min(ids.length-1,Math.floor(this.random()*ids.length))];this.startEmote('emote:'+form+':'+id,now,'automatic');
  }
  if(this.deskGesture&&now>=this.deskGesture.until)this.deskGesture=null;
  if(this.action.until&&now>=this.action.until)this.action={name:'idle',until:0};
  if(!this.externalIdle&&!this.performanceActive&&!this.emotionHold&&!this.bodyMotion&&!this.emote&&!this.reactionQueue.length&&!this.dragging&&this.mode==='companion'&&this.settings.form!=='desk'&&this.settings.roam&&this.care.energy>20&&!this.action.until&&now>=this.nextActivity){
   if(!this.walk){const direction=this.random()>.5?1:-1;this.walk={direction,until:now+4000+this.random()*4500};}
  }
  if(this.walk&&(this.settings.form==='desk'||!this.settings.roam||this.dragging||this.mode!=='companion'))this.walk=null;
  let next={...position};
  if(this.walk){
   if(now>=this.walk.until){this.walk=null;this.nextActivity=now+14000+this.random()*18000;this.play('review',now,2);}
   else {next.x+=this.walk.direction*this.settings.speed*dt;const clamped=clampPosition(next,area,size);if(Math.abs(clamped.x-next.x)>.5)this.walk.direction*=-1;next=clamped;}
  }
  if(now>=this.nextSpeech){
   if(!this.musicPriority&&!this.performanceActive&&!this.emotionHold&&!this.bodyMotion&&!this.dragging&&this.mode==='companion'&&this.messageUntil<=now){
    const phrases=['有些事，慢慢做反而更稳妥。','这一页，今日写到这里也无妨。','记得喝水。别只顾着屏幕。','窗外的光又变了。要不要歇一歇？','我在这里，陪你把手边的事做好。'];
    const phrase=phrases[Math.floor(this.random()*phrases.length)];this.say(phrase,now,6500,'ambient');this.react(inferReaction(phrase)||{expression:'smile'},now,'ambient');
   }this.nextSpeech=now+65000+this.random()*45000;
  }
  return {position:next,focusDone,notifications};
 }
 snapshot(now=Date.now()){
  const action=this.action.until>now?this.action.name:this.walk?(this.walk.direction>0?'right':'left'):this.mode==='read'||this.mode==='focus'?'work':'idle';
  return {settings:this.settings,mode:this.mode,action,resting:this.mode==='rest',dragging:this.dragging,performance:this.performance,performanceActive:this.performanceActive,
   deskGesture:this.deskGesture?.until>now?this.deskGesture:null,
   bodyMotion:this.bodyMotion?.until>now&&this.bodyMotion.form===this.settings.form?this.bodyMotion:null,
   emotionHold:this.emotionHold?.until>now&&this.emotionHold.form===this.settings.form?this.emotionHold:null,
   emote:this.emote?.until>now&&this.emote.form===this.settings.form?this.emote:this.emotionHold?.until>now&&this.emotionHold.form===this.settings.form?this.emotionHold:null,
   message:this.messageUntil>now?this.message:'',focus:this.focus?{paused:this.focus.paused,remaining:this.focus.paused?this.focus.remaining:Math.max(0,this.focus.deadline-now)}:null,completed:this.completed,
   care:{mood:Math.round(this.care.mood),energy:Math.round(this.care.energy),affinity:Math.round(this.care.affinity)},todos:this.todos,journal:this.journal.slice(-20).reverse(),daily:this.daily,today:new Date(now).toLocaleDateString('sv-SE')};
 }
 save(){return {settings:this.settings,focus:this.focus,completed:this.completed,care:this.care,todos:this.todos,journal:this.journal,daily:this.daily};}
}
module.exports={Engine,settings,clampPosition,STATES};
