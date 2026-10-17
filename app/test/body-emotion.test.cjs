'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Engine}=require('../engine.cjs'),{Voice}=require('../voice.cjs'),{ReplyPerformance}=require('../dialogue.cjs'),{hitPart}=require('../body-interactions.js'),{timing,find}=require('../emotes.js');
const pos={x:100,y:100},area={x:0,y:0,width:1920,height:1080},size={width:300,height:400};
test('body hit regions separate face hair tail and desk objects in both forms',()=>{
 for(const [form,points] of [['classic',[[.5,.28,'head'],[.55,.48,'face'],[.29,.87,'tail'],[.6,.7,'body']]],['desk',[[.5,.3,'head'],[.55,.51,'face'],[.2,.68,'tail'],[.5,.66,'body'],[.5,.85,null]]]])for(const [x,y,part] of points)assert.equal(hitPart(form,x,y),part);
 assert.equal(hitPart('classic',NaN,.5),null);assert.equal(hitPart('classic',1.1,.5),null);
});
test('repeat touch varies same-part reaction without farming care or voice; touching another part resets',()=>{
 for(const form of ['classic','desk']){const e=new Engine({settings:{form,autoEmotes:false}},0);assert.equal(e.touch('head',1000),true);assert.equal(e.emote.command,`emote:${form}:shy`);const affinity=e.care.affinity,speech=e.speechId;
  assert.equal(e.touch('head',1100),false);e.touch('head',1800);assert.equal(e.emote.command,`emote:${form}:smile`);e.touch('head',2600);assert.equal(e.emote.command,`emote:${form}:puzzled`);assert.equal(e.care.affinity,affinity);assert.equal(e.speechId,speech);
  e.touch('face',3500);assert.equal(e.emote.command,`emote:${form}:puzzled`);e.touch('face',4500);assert.equal(e.emote.command,`emote:${form}:shy`);e.touch('tail',5500);assert.equal(e.bodyMotion.id,'tail-'+form);assert.equal(e.emote,null);
  e.touch('head',15000);assert.equal(e.emote.command,`emote:${form}:shy`);assert.equal(e.touch('quit',16000),false);
 }
});
test('touch never replaces an ongoing reply text and priority ends before later sentence',()=>{
 const e=new Engine({},0);e.performanceActive=true;e.say('整段回复正在说。',1000,15000,'chat');const id=e.speechId;e.touch('face',1500);assert.equal(e.speechId,id);assert.equal(e.message,'整段回复正在说。');assert.equal(e.react({expression:'laugh'},2000,'chat'),false);assert.equal(e.emote.command,'emote:classic:puzzled');assert.equal(e.react({expression:'laugh'},5000,'chat'),true);
});
test('only a real drag produces landing, landing resumes current reply and second drag cancels it',()=>{
 for(const form of ['classic','desk']){const e=new Engine({settings:{form,autoEmotes:false}},0);assert.equal(e.endDrag(1000),false);assert.equal(e.bodyMotion,null);e.beginDrag(1500);e.endDrag(2200);assert.equal(e.bodyMotion.id,'landing');e.performanceActive=true;e.performance={reaction:{expression:'smile'}};e.tick(4500,pos,area,size);assert.equal(e.bodyMotion.id,'landing');e.tick(4700,pos,area,size);assert.equal(e.bodyMotion,null);assert.equal(e.emote.command,`emote:${form}:smile`);e.beginDrag(5000);assert.equal(e.emote,null);assert.equal(e.bodyMotion,null);}
});
test('successful reply holds last meaningful emotion even when final sentence is neutral, then releases',t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});
 for(const form of ['classic','desk']){const e=new Engine({settings:{form,autoEmotes:true,roam:true}},Date.now()),p=new ReplyPerformance(e,new Voice({enabled:false}));
  p.start('哈哈，真好。明天继续。',[],null,{beats:[{index:0,reaction:{expression:'laugh'}},{index:1,reaction:null}]});t.mock.timers.tick(2300);t.mock.timers.tick(2300);assert.equal(p.active,false);assert.equal(e.performanceActive,false);assert.equal(e.emotionHold.command,`emote:${form}:laugh`);
  e.nextActivity=0;e.nextEmote=0;e.tick(Date.now()+100,pos,area,size);assert.equal(e.walk,null);assert.equal(e.emote,null);assert.equal(e.snapshot().emote.source,'afterglow');const hold=e.emotionHold,item=find(hold.command);assert.equal(timing(hold,hold.started+1000)[1],item.duration);assert.ok(timing(hold,hold.until-150)[0]>item.duration-200);
  e.settings.autoEmotes=false;e.settings.roam=false;e.tick(hold.until+1,pos,area,size);assert.equal(e.emotionHold,null);assert.equal(e.snapshot(hold.until+1).emote,null);p.cancel();
 }
});
test('cancellation replacement manual actions drag form changes and disabled context discard emotion hold',t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:1000});const e=new Engine({settings:{autoEmotes:false}},1000),p=new ReplyPerformance(e,new Voice({enabled:false}));
 p.start('哈哈。');p.cancel();t.mock.timers.tick(10000);assert.equal(e.emotionHold,null);
 e.holdEmotion('shy');p.start('新的回答。');assert.equal(e.emotionHold,null);p.cancel();e.holdEmotion('shy');e.command('wave');assert.equal(e.emotionHold,null);
 e.holdEmotion('laugh');e.beginDrag();assert.equal(e.emotionHold,null);assert.equal(e.holdEmotion('smile'),false);e.endDrag();e.tick(Date.now()+10000,pos,area,size);
 e.holdEmotion('smile',Date.now()+12000);e.settings.form='desk';e.tick(Date.now()+12001,pos,area,size);assert.equal(e.emotionHold,null);e.settings.contextEmotes=false;assert.equal(e.holdEmotion('shy'),false);
});
test('real voice completion holds emotion, stopped voice and stale callbacks cannot restore it',async()=>{
 const e=new Engine({settings:{autoEmotes:false}}),callbacks=[],voice={settings:{enabled:true,autoChat:true,maxChars:6000},stop(){},speakSegments(s,c){callbacks.push(c);}};const p=new ReplyPerformance(e,voice);
 p.start('好开心。',[],{expression:'smile'});callbacks[0].onSegment({text:'好开心。',reaction:{expression:'smile'}},0);callbacks[0].onFinish('ended');assert.equal(e.emotionHold.command,'emote:classic:smile');
 p.start('新的。',[],{expression:'shy'});p.cancel();callbacks[1].onFinish('ended');assert.equal(e.emotionHold,null);assert.equal(e.performanceActive,false);
 p.start('停止的。',[],{expression:'shy'});callbacks[2].onSegment({text:'停止的。',reaction:{expression:'shy'}},0);callbacks[2].onFinish('canceled');assert.equal(e.emotionHold,null);assert.equal(e.performanceActive,false);
});
