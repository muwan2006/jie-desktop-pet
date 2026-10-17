const {test}=require('node:test');const assert=require('node:assert/strict');
const {Engine,clampPosition,settings}=require('../engine.cjs');
const area={x:-1280,y:0,width:1280,height:900},size={width:290,height:350};
test('drag coordinates stay within a negative-coordinate monitor',()=>{
 assert.deepEqual(clampPosition({x:-1400,y:700},area,size),{x:-1280,y:550});
 assert.deepEqual(clampPosition({x:500,y:-500},area,size),{x:-290,y:0});
});
test('walking reverses at screen boundary and cannot leave work area',()=>{
 const e=new Engine({},0,()=>.99);e.walk={direction:1,until:10000};
 const r=e.tick(100,{x:-291,y:550},area,size);
 assert.equal(r.position.x,-290);assert.equal(e.walk.direction,-1);
});
test('focus pauses, resumes and completes once across wall-clock jumps',()=>{
 const e=new Engine({settings:{focusMinutes:1}},1000);e.command('focus',1000);
 e.command('pause-focus',11000);assert.equal(e.focus.remaining,50000);
 e.command('pause-focus',90000);assert.equal(e.focus.deadline,140000);
 const r=e.tick(200000,{x:-800,y:500},area,size);assert.equal(r.focusDone,true);assert.equal(e.completed,1);
 assert.equal(e.tick(201000,{x:-800,y:500},area,size).focusDone,false);
});
test('restart restores paused focus and does not spend paused time',()=>{
 const e=new Engine({settings:{focusMinutes:1}},0);e.command('focus',0);e.command('pause-focus',20000);
 const restored=new Engine(e.save(),900000);assert.equal(restored.snapshot(900000).focus.remaining,40000);
 restored.command('pause-focus',900000);assert.equal(restored.focus.deadline,940000);
});
test('expired persisted focus sends exactly one completion at startup',()=>{
 const e=new Engine({focus:{deadline:10000,paused:false,remaining:8000}},20000);
 assert.equal(e.tick(20000,{x:-800,y:400},area,size).focusDone,true);assert.equal(e.completed,1);
});
test('interactions cancel a walk and return to reading mode',()=>{
 const e=new Engine({},0);e.command('read',0);e.command('touch',100);
 assert.equal(e.walk,null);assert.equal(e.snapshot(101).emote.command,'emote:classic:shy');e.tick(5000,{x:-800,y:500},area,size);assert.equal(e.snapshot(5000).action,'work');assert.equal(e.snapshot(5000).emote,null);
});
test('focus and rest prohibit automatic roaming',()=>{
 const e=new Engine({},0,()=>.99);e.nextActivity=0;e.command('focus',0);e.tick(20000,{x:-800,y:500},area,size);assert.equal(e.walk,null);
 e.command('stop-focus',20001);e.command('rest',20002);e.tick(100000,{x:-800,y:500},area,size);assert.equal(e.walk,null);
});
test('settings reject malformed values and clamp sensible limits',()=>{
 assert.equal(settings({scale:Infinity}).scale,1);assert.equal(settings({scale:99}).scale,1.6);
 assert.equal(settings({speed:-1}).speed,15);assert.equal(settings({roam:'false'}).roam,true);
});
test('tea raises care with a cooldown and retains progress after restart',()=>{
 const e=new Engine({},0);e.command('tea',1000);const energy=e.care.energy,affinity=e.care.affinity;
 e.command('tea',2000);assert.equal(e.care.energy,energy);assert.equal(e.care.affinity,affinity);
 const restored=new Engine(e.save(),3000);assert.equal(restored.care.affinity,affinity);assert.equal(restored.journal.length,1);
});
test('todo add/toggle/delete are persistent and bounded',()=>{
 const e=new Engine({},0);assert.equal(e.todo('add','  写一页  ',1),true);assert.equal(e.todos[0].text,'写一页');
 const id=e.todos[0].id;assert.equal(e.todo('toggle',id,2),true);assert.equal(e.todos[0].done,true);
 const restored=new Engine(e.save(),3);assert.equal(restored.todos[0].done,true);assert.equal(restored.todo('remove',id,4),true);
 assert.equal(restored.todo('add','   ',5),false);assert.equal(restored.todos.length,0);
});
test('reminders fire once per interval and respect disable setting',()=>{
 const e=new Engine({settings:{drinkMinutes:1,restReminder:false}},0);const p={x:-800,y:500};
 assert.equal(e.tick(60000,p,area,size).notifications.length,1);
 assert.equal(e.tick(60100,p,area,size).notifications.length,0);
 assert.equal(e.tick(120000,p,area,size).notifications.length,1);
});
test('focus records its original duration even after setting changes',()=>{
 const e=new Engine({settings:{focusMinutes:1}},0);e.command('focus',0);e.settings.focusMinutes=40;e.tick(60000,{x:-800,y:500},area,size);
 const day=e.snapshot(60000).daily[e.snapshot(60000).today];assert.equal(day.minutes,1);assert.equal(day.count,1);
});
test('low energy prevents roaming and resting restores energy',()=>{
 const e=new Engine({care:{energy:10,mood:30,affinity:8}},0);e.nextActivity=0;e.tick(1000,{x:-800,y:500},area,size);assert.equal(e.walk,null);
 e.command('rest',1001);const n=e.care.energy;e.tick(1100,{x:-800,y:500},area,size);assert.ok(e.care.energy>n);
});
test('voice can use the current interaction even when speech bubbles are hidden',()=>{const e=new Engine({settings:{speech:false}},1000);e.command('tea',2000);assert.equal(e.message,'');assert.match(e.lastUtterance,/多谢/);const id=e.speechId;e.command('pause-focus',2001);assert.equal(e.speechId,id);e.command('wave',2002);assert.ok(e.speechId>id);assert.equal(e.lastUtterance,'见到你，真好。');});
