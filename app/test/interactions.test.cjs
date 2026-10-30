'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Engine}=require('../engine.cjs'),{Voice}=require('../voice.cjs'),{parseReply,Chat}=require('../chat.cjs');
const {validateReaction,idsFor,inferReaction}=require('../reactions.cjs'),lift=require('../lift-animation.js');
const {presets}=require('../utterances.cjs');
const area={x:0,y:0,width:1920,height:1080},size={width:300,height:400},pos={x:400,y:400};
test('chat reaction whitelist cannot invoke desktop commands or paths',()=>{
 assert.equal(validateReaction({expression:'quit',gesture:'../../file'}),null);
 assert.deepEqual(parseReply('{"reply":"晚安","actions":[],"reaction":{"expression":"sleepy","gesture":"quit"}}').reaction,{expression:'sleepy'});
 assert.deepEqual(idsFor('desk',{expression:'comfort',gesture:'ponder'}),['relief','think']);
 assert.equal(inferReaction('这里是一个普通陈述。'),null);
});
test('one model reply delivers contextual animation metadata without an extra request',async()=>{
 const c=new Chat(),e=new Engine({settings:{autoEmotes:false}},0);let requests=0;
 const auth={active:'a',model:'test',snapshot:()=>({connected:true}),access:async()=> 'test'};
 const result=await c.send('晚安',{auth,context:{},fetch:async()=>{requests++;return new Response('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',output:[{content:[{text:JSON.stringify({reply:'晚安。',reaction:{expression:'sleepy'},actions:[],continuity:'用户准备睡觉。'})}]}]}})+'\n\n');},onReply:(text,reaction)=>{assert.equal(text,'晚安。');e.react(reaction,100);}});
 assert.equal(result.ok,true);assert.equal(requests,1);assert.equal(e.emote.command,'emote:classic:sleepy');assert.equal(c.data().continuity,'用户准备睡觉。');assert.equal(c.data().history.length,2);
});
test('head pat blushes in both forms even when random animations are disabled',()=>{
 for(const form of ['classic','desk']){const e=new Engine({settings:{form,autoEmotes:false}},0);e.command('touch',100);assert.equal(e.emote.command,'emote:'+form+':shy');assert.equal(e.emote.source,'touch');e.tick(4000,pos,area,size);assert.equal(e.emote,null);}
});
test('context gestures follow expressions and yield to a manual action or a drag',()=>{
 const e=new Engine({settings:{autoEmotes:false}},0);e.react({expression:'smile',gesture:'nod'},100);assert.equal(e.emote.command,'emote:classic:smile');assert.equal(e.reactionQueue.length,1);
 e.tick(3600,pos,area,size);assert.equal(e.emote.command,'emote:classic:nod');e.command('emote:classic:tail',3700);assert.equal(e.react({expression:'shy'},3800),false);assert.equal(e.reactionQueue.length,0);
 e.beginDrag(3900);assert.equal(e.emote,null);assert.equal(e.walk,null);assert.equal(e.react({expression:'smile'},4000),false);
 e.tick(40000,pos,area,size);assert.equal(e.dragging,true);e.endDrag(41000);assert.equal(e.dragging,false);
});
test('context setting suppresses reactions while original commands remain usable',()=>{
 const e=new Engine({settings:{contextEmotes:false,autoEmotes:false}},0);e.command('touch',100);assert.equal(e.emote,null);assert.equal(e.snapshot(101).action,'wave');assert.equal(e.save().settings.contextEmotes,false);
});
test('desk tea gesture completes before its contextual smile',()=>{
 const e=new Engine({settings:{form:'desk',autoEmotes:false}},0);e.command('tea',100);assert.equal(e.deskGesture.name,'tea');assert.equal(e.emote,null);e.tick(4350,pos,area,size);e.tick(4400,pos,area,size);assert.equal(e.emote.command,'emote:desk:smile');
});
test('all preset recordings are intact and play without a synthesis request',()=>{
 let requests=0,events=[];const v=new Voice({volume:.4,speed:1.2},{request:()=>{requests++;throw Error('must not request');},onAudio:e=>events.push(e)});
 for(const line of presets){const clip=v.preset(line.id);assert.ok(clip);assert.equal(clip.text,line.text);assert.ok(clip.info.duration>.5);assert.deepEqual(v.playPreset(line.id,{manual:true}),{ok:true,preset:true});assert.equal(v.state,'playing');assert.equal(events.at(-1).rate,1.2);v.playback(v.playId,'ended');}
 assert.equal(requests,0);v.stop();
});
test('pre-recorded greetings obey mute, opt-out, busy reply and stale playback',()=>{
 const v=new Voice({enabled:false});assert.ok(v.playPreset('morning',{manual:true}).error);v.configure({enabled:true,presetGreetings:false});assert.equal(v.playPreset('morning').skipped,true);
 v.configure({presetGreetings:true});v.playPreset('morning',{manual:true});const old=v.playId;assert.equal(v.playPreset('night').skipped,true);v.playPreset('night',{manual:true});v.playback(old,'ended');assert.equal(v.state,'playing');v.stop();assert.ok(v.playPreset('unknown').error);
});
test('lift frames have one fixed collar anchor and never stretch in either form',()=>{
 for(const [w,h] of [[230.4,249.6],[310,310],[368.64,399.36],[496,496]]){const g=lift.geometry(w,h);assert.ok(Math.abs(g.width/g.height-768/832)<.0001);assert.ok(g.anchorX>0&&g.anchorY>0&&g.anchorX<w&&g.anchorY<h);}
 lift.begin(1000);assert.equal(lift.frameAt(1000),0);assert.equal(lift.frameAt(1800),1);assert.equal(lift.frameAt(2300),0);
});
