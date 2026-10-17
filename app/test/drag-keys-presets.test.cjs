'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {anchor,positionFor,resizePet}=require('../drag-geometry.cjs'),{Shortcuts}=require('../shortcuts.cjs'),keys=require('../shortcut-keys.js'),{Engine}=require('../engine.cjs'),{Voice}=require('../voice.cjs'),{presets,findPreset}=require('../utterances.cjs');
test('drag anchor uses actual viewport after form switches and high DPI; negative cursor positions are unconstrained',()=>{
 for(const form of ['classic','desk'])for(const scale of [.65,1,1.6]){
  const settings={form,scale},b={width:form==='desk'?350:290,height:form==='desk'?410:350},p={form,scale,viewport:{width:b.width,height:b.height},anchor:{x:124.3,y:128.4}};
  assert.deepEqual(anchor(settings,b,p),p.anchor);assert.deepEqual(anchor(settings,{width:b.width*2,height:b.height*2},p),{x:248.6,y:256.8});
  const a=anchor(settings,b,p);for(const cursor of [{x:0,y:0},{x:-1200,y:-600},{x:800,y:20}]){const pos=positionFor(cursor,a);assert.equal(pos.x+a.x,cursor.x);assert.equal(pos.y+a.y,cursor.y);}
  const invalid={...p,anchor:{x:NaN,y:-1}};assert.deepEqual(anchor(settings,b,invalid),anchor(settings,b));assert.deepEqual(anchor(settings,b,{...p,form:'invalid'}),anchor(settings,b));
 }
});
test('temporarily unlocking the native window is required for a reliable shrink, then sizing locks again',()=>{
 const w={size:[350,410],resizable:false,getSize(){return this.size;},isResizable(){return this.resizable;},setResizable(v){this.resizable=v;},setSize(x,y){if(!this.resizable&&x<this.size[0])return;this.size=[x,y];}};
 w.setSize(290,350);assert.deepEqual(w.size,[350,410]);resizePet(w,290,350);assert.deepEqual(w.size,[290,350]);assert.equal(w.resizable,false);resizePet(w,350,410);resizePet(w,290,350);assert.deepEqual(w.size,[290,350]);
 const bad={...w,size:[350,410],setSize(){throw Error('native failure');}};assert.throws(()=>resizePet(bad,290,350));assert.equal(bad.resizable,false);
});
function registry(){const registered=new Map(),other=new Set();return {registered,other,api:{register(key,fn){if(registered.has(key)||other.has(key))return false;registered.set(key,fn);return true;},unregister(key){registered.delete(key);}}};}
test('shortcut values validate exact modifiers, duplicates, IME and safe action names',()=>{
 assert.equal(keys.normalize('Alt+Control+J','global'),'Control+Alt+J');assert.equal(keys.normalize('J','global'),null);assert.equal(keys.normalize('Shift+J','global'),null);assert.equal(keys.normalize('F12','global'),'F12');assert.equal(keys.normalize('Control+Control+J'),null);assert.equal(keys.normalize('Control+Quit'),null);
 assert.ok(keys.validate({...keys.defaults,chat:keys.defaults.reveal}).error);assert.equal(keys.fromEvent({key:'Enter',code:'Enter',isComposing:true}),null);assert.equal(keys.fromEvent({key:'Enter',code:'Enter',keyCode:229}),null);
 assert.equal(keys.fromEvent({key:'j',code:'KeyJ',ctrlKey:true,altKey:true}),'Control+Alt+J');assert.equal(keys.matches({key:'Enter',code:'Enter',shiftKey:true},'Enter'),false);
});
test('custom keys persist, duplicate or occupied registrations roll back all changes and own callbacks stay intact',()=>{
 const reg=registry(),calls=[],s=new Shortcuts(null,reg.api,id=>calls.push(id));s.start();assert.equal(reg.registered.size,keys.definitions.filter(d=>d.scope==='global'&&d.key).length);reg.registered.get('Control+Alt+C')();assert.deepEqual(calls,['chat']);
 s.capture(true);reg.registered.get('Control+Alt+C')();assert.equal(calls.length,1);s.capture(false);
 assert.equal(s.configure({...keys.defaults,chat:'Control+Alt+K',send:'Control+Enter'}).ok,true);assert.equal(reg.registered.has('Control+Alt+C'),false);assert.ok(reg.registered.has('Control+Alt+K'));const saved=s.save();assert.equal(saved.keys.send,'Control+Enter');
 reg.other.add('Control+Alt+U');const failure=s.configure({...saved.keys,chat:'Control+Alt+B',reveal:'Control+Alt+U'});assert.match(failure.error,/未保存/);assert.deepEqual(s.save(),saved);assert.ok(reg.registered.has('Control+Alt+K'));assert.ok(reg.registered.has('Control+Alt+J'));assert.equal(reg.registered.has('Control+Alt+B'),false);
 assert.ok(s.configure({...saved.keys,chat:saved.keys.reveal}).error);s.stop();assert.equal(reg.registered.size,0);const restored=new Shortcuts(saved,reg.api,id=>calls.push(id));restored.start();assert.ok(reg.registered.has('Control+Alt+K'));restored.stop();
});
test('all non-chat fixed responses and reminders have intact recordings, first head touch is only light-touch words',()=>{
 const texts=new Set(),collect=e=>{const say=e.say.bind(e);e.say=(text,...args)=>{texts.add(text);return say(text,...args);};return e;};const v=new Voice({presetGreetings:false,autoInteraction:true},{presetDirectory:()=>require('node:path').join(__dirname,'../../components/voice/files/assets/voice/presets'),request(){throw Error('Synthesis forbidden');}});
 for(const command of ['touch','tea','talk','jump','wave','read','rest','companion','focus','stop-focus'])for(const random of [0,.3,.6,.9]){const e=collect(new Engine({},0,()=>random));e.command(command,1000);if(command==='tea')e.command(command,2000);}
 for(const part of ['head','face','tail','body']){const e=collect(new Engine({},0));for(const now of [1000,7500,14000])e.touch(part,now);}
 for(const random of [0,.21,.41,.61,.81]){const e=collect(new Engine({},0,()=>random));e.nextSpeech=0;e.tick(1000,{x:0,y:0},{x:0,y:0,width:1920,height:1080},{width:300,height:400});}
 const e=collect(new Engine({settings:{focusMinutes:1,drinkMinutes:1,restMinutes:1}},0));e.command('focus',1000);e.tick(62000,{x:0,y:0},{x:0,y:0,width:1920,height:1080},{width:300,height:400});e.todo('add','可变待办名字',63000);e.todo('toggle',e.todos[0].id,64000);
 for(const text of texts){assert.ok(findPreset(text),text);assert.ok(v.preset(text),text);assert.equal(v.playPreset(text,{daily:true}).preset,true);v.playback(v.playId,'ended');}
 assert.equal(findPreset('touch').text,'轻一点。');const head=new Engine({},0);head.touch('head',1000);assert.equal(head.lastUtterance,'轻一点。');
 for(const line of presets){const clip=v.preset(line.id);assert.ok(clip,line.id);assert.equal(clip.text,line.text);assert.equal(v.playPreset(line.id,{manual:true}).preset,true);v.playback(v.playId,'ended');}
 for(const id of ['custom-reminder','action-note','action-todo','action-reminder','action-link','action-done'])assert.ok(v.preset(id));v.stop();assert.ok(texts.size>=30);
});
test('daily recordings obey daily opt-out separately from greeting opt-out, never start service',()=>{
 const v=new Voice({presetGreetings:false,autoInteraction:true},{presetDirectory:()=>require('node:path').join(__dirname,'../../components/voice/files/assets/voice/presets'),request(){throw Error('No synthesis');}});assert.equal(v.playPreset('touch',{daily:true}).preset,true);v.stop();assert.equal(v.playPreset('morning').skipped,true);v.configure({autoInteraction:false,presetGreetings:true});assert.equal(v.playPreset('touch',{daily:true}).skipped,true);assert.equal(v.playPreset('morning').preset,true);v.stop();
});
