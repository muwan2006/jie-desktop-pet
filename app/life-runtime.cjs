'use strict';
const {MusicComments}=require('./music-comments.cjs');
const {DesktopLife,PROPS}=require('./desktop-life.cjs'),{LifeSensors}=require('./life-sensors.cjs'),path=require('node:path'),fs=require('node:fs'),{adjacent}=require('./life-layout.cjs');
class LifeRuntime{
 constructor(h){Object.assign(this,h);this.life=new DesktopLife(h.saved);this.musicComments=new MusicComments();this.propWindows=new Map();this.motion=null;this.blockUntil=0;this.lastEmit=0;this.lastMilestones=0;this.sensor=new LifeSensors((v,at)=>this.life.observe(v,at),r=>h.screen.screenToDipRect(null,r));this.syncSensor();}
 syncSensor(){if(this.life.settings.windows||this.life.settings.music)this.sensor.start(this.life.settings.music);else if(this.sensor.child)this.sensor.stop();}
 data(){const previous=this.life.profile;this.life.setProfile(this.profile());if(previous!==this.life.profile){this.closeProps();this.closeGame();}return this.life.current();}
 geometry(){const bounds=this.pet().getBounds(),settings=this.engine.settings,d=require('./desk-animation.js').dimensions(settings);return {width:bounds.width,height:bounds.height,bodyWidth:d.width,bodyHeight:d.height,canvasTop:bounds.height-8-d.height,headTop:.03,seatY:bounds.height-8-d.height+d.height*(580/832)};}
 interrupt(){this.blockUntil=Date.now()+6000;this.motion=null;this.life.motion=null;}
 dragStart(){this.life.dragStart();this.interrupt();}
 drop(position){const area=this.screen.getDisplayMatching({...position,width:1,height:1}).workArea;const attached=this.life.drop(position,this.geometry(),Date.now(),area);if(attached)this.blockUntil=0;return attached;}
 detach(){this.life.detach();this.interrupt();}
 musicComment(now,allowed){this.data();const s=this.life.settings;return this.musicComments.take({active:this.musicActive(now),allowed:allowed&&!this.life.audioSuppressed,enabled:s.musicCommentary,interval:s.musicCommentInterval,rhythm:this.life.rhythmSnapshot(now),peak:this.life.sensor.peak,now});}
 context(){this.data();return this.life.context();}
 snapshot(){this.data();return {...this.life.snapshot(),sensorStatus:this.sensor.status};}
 publish(force=false){const now=Date.now();if(!force&&now-this.lastEmit<1000)return;this.lastEmit=now;this.send('life-state',this.snapshot());}
 tick(now,position,area,blocked=false){const previous=this.life.profile;this.data();if(previous!==this.life.profile){this.closeProps();this.closeGame();}if(now-this.lastMilestones>10000){this.lastMilestones=now;this.life.milestones(this.milestoneData(),now);}
  const form=this.engine.settings.form,builtin=this.builtin(),active=this.pet().isVisible(),dtblocked=blocked||now<this.blockUntil||!active;
  if(!builtin||form!=='classic')this.life.detach();
  if(this.life.perch&&!dtblocked){const w=this.life.windows.find(w=>w.id===this.life.perch.id);if(w)area=this.screen.getDisplayMatching({x:w.x,y:w.y,width:w.width,height:w.height}).workArea;}
  if(this.life.trip?.type==='window'){const w=this.life.windows.find(w=>w.id===this.life.trip.windowId);if(w)area=this.screen.getDisplayMatching({x:w.x,y:w.y,width:w.width,height:w.height}).workArea;}
  const out=this.life.tick(now,{position,geom:this.geometry(),area,blocked:dtblocked,form,builtin});this.motion=out.motion;if(form==='desk'&&builtin&&!dtblocked&&now-(this.lastDeskPose||0)>12000){if(this.life.musicActive(now)){this.lastDeskPose=now;}else if(this.life.current().plan&&!this.life.current().plan.paused){this.engine.startEmote('emote:desk:'+({read:'inspect',write:'slow',tea:'relief',rest:'sleepy'})[this.life.current().plan.kind],now,'daily');this.lastDeskPose=now;}}
  for(const e of out.events){if(e.kind==='prop-use'){if(e.prop==='book')this.life.startPlan('read',10,now);if(e.prop==='ink')this.life.startPlan('write',6,now);this.engine.careFor('与颉一起使用桌面道具。',now,2);}if(e.kind==='prop-consumed')this.removeProp(e.id);if(e.kind==='plan-done')this.engine.record('颉完成日常计划：'+e.title,now);}
  if(!this.musicActive(now)&&this.life.settings.autoWindows&&this.life.settings.windows&&!dtblocked&&form==='classic'&&builtin&&!this.life.perch&&!this.life.trip&&!this.life.current().plan&&now>=this.life.nextWindow){this.life.nextWindow=now+180000;const target=this.life.windows.find(w=>w.x<area.x+area.width&&w.x+w.width>area.x);if(target){this.life.sit(target.id,now);this.life.trip.automatic=true;}}
  this.positionGame();this.publish();return out.position;
 }
 reserve(){this.data();return !!(this.life.trip||this.life.perch||this.life.current().plan&&!this.life.current().plan.paused||this.life.settings.music&&Date.now()<this.life.musicUntil||this.life.motion?.until>Date.now());}
 musicActive(now=Date.now()){this.data();return this.life.musicActive(now)&&this.builtin()&&this.pet().isVisible();}
 openProp(kind){if(!this.builtin()||this.engine.settings.form!=='classic')throw Error('桌面道具目前用于第一形态；请先切回第一形态。');const bounds=this.pet().getBounds(),area=this.screen.getDisplayMatching(bounds).workArea,p=this.life.addProp(kind,adjacent(bounds,{width:94,height:104},area));const win=new this.BrowserWindow({width:94,height:104,x:Math.round(p.x),y:Math.round(p.y),transparent:true,frame:false,hasShadow:false,resizable:false,skipTaskbar:true,alwaysOnTop:true,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});this.propWindows.set(p.id,win);this.secure(win,'life-prop.html');win.loadFile(path.join(__dirname,'life-prop.html'));win.once('ready-to-show',()=>{if(!win.isDestroyed()){win.webContents.send('life-prop-state',p);win.showInactive();this.life.queueProp(p.id);this.blockUntil=0;}});win.on('move',()=>{if(!win.isDestroyed()&&this.life.props.has(p.id)){const [x,y]=win.getPosition();this.life.moveProp(p.id,{x,y});}});win.on('closed',()=>{this.propWindows.delete(p.id);this.life.removeProp(p.id);this.publish(true);});this.publish(true);return {ok:true};}
 propOwn(event){for(const [id,win] of this.propWindows)if(!win.isDestroyed()&&win.webContents===event.sender)return id;return null;}
 propOperation(event,op){const id=this.propOwn(event);if(!id)throw Error('道具窗口已关闭。');if(op==='state')return this.life.props.get(id);if(op==='use'){this.blockUntil=0;return this.life.useProp(id);}if(op==='remove'){this.removeProp(id);return {ok:true};}throw Error('道具操作无效。');}
 removeProp(id){this.propWindows.get(id)?.close();this.life.removeProp(id);}
 closeProps(){for(const win of this.propWindows.values())if(!win.isDestroyed())win.close();this.life.props.clear();this.life.propQueue=[];}
 closeGame(){if(this.gameWindow&&!this.gameWindow.isDestroyed())this.gameWindow.close();this.gameWindow=null;}
 gameState(){const s=this.life.snapshot();return {game:s.game,games:s.games};}
 publishGame(){if(this.gameWindow&&!this.gameWindow.isDestroyed())this.gameWindow.webContents.send('life-game-state',this.gameState());}
 positionGame(){const win=this.gameWindow;if(!win||win.isDestroyed())return;const owner=this.pet().getBounds(),area=this.screen.getDisplayMatching(owner).workArea,p=adjacent(owner,{width:290,height:250},area);const old=win.getBounds();if(old.x!==Math.round(p.x)||old.y!==Math.round(p.y))win.setPosition(Math.round(p.x),Math.round(p.y));}
 gameFeedback(expression){const now=Date.now();this.blockUntil=0;if(this.life.game.kind==='rps'){this.life.perch=null;this.life.trip=null;}this.engine.say(this.life.game.result,now,6500,'game');if(expression)this.engine.react({expression,gesture:'nod'},now,'game');else if(this.engine.settings.form==='desk'||!this.builtin())this.engine.react({expression:'smile',gesture:'nod'},now,'game');else{this.engine.emote=null;this.engine.emotionHold=null;this.engine.reactionQueue=[];}
  if(!this.gameWindow||this.gameWindow.isDestroyed()){const win=new this.BrowserWindow({width:290,height:250,frame:false,transparent:true,hasShadow:false,resizable:false,skipTaskbar:true,alwaysOnTop:true,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});this.gameWindow=win;this.secure(win,'life-game.html');win.loadFile(path.join(__dirname,'life-game.html'));win.once('ready-to-show',()=>{if(!win.isDestroyed()){this.positionGame();this.publishGame();win.showInactive();}});win.on('closed',()=>{if(this.gameWindow===win)this.gameWindow=null;});}else this.publishGame();}
 gameOwn(event){return this.gameWindow&&!this.gameWindow.isDestroyed()&&this.gameWindow.webContents===event.sender;}
 async gameOperation(event,op,v){if(!this.gameOwn(event))throw Error('游戏窗口已关闭。');if(op==='state')return this.gameState();if(op==='close'){this.closeGame();return {ok:true};}if(!['guess-start','guess','rps'].includes(op))throw Error('游戏操作无效。');return this.operation(op,v);}
 async operation(op,v={}){this.data();let result;
  if(op==='state')return this.snapshot();
  if(op==='settings'){result=this.life.configure(v);this.syncSensor();}
  else if(op==='window-sit'){if(!this.builtin()||this.engine.settings.form!=='classic')throw Error('窗口活动目前用于第一形态，请先切回第一形态。');const w=this.life.windows.find(w=>w.id===v.id);if(!w)throw Error('窗口已不在桌面上。');this.interrupt();this.blockUntil=Date.now();result=this.life.sit(v.id);}
  else if(op==='window-leave'){this.life.perch=null;this.life.trip={type:'fall',started:Date.now()};result={ok:true};}
  else if(op==='prop-add')result=this.openProp(v.kind);
  else if(op==='prop-use')result=this.life.useProp(v.id);
  else if(op==='props-clear'){this.closeProps();result={ok:true};}
  else if(op==='plan-start')result=this.life.startPlan(v.kind,Number(v.minutes),Date.now(),v.title);
  else if(op==='plan-pause')result=this.life.pausePlan(true);
  else if(op==='plan-resume')result=this.life.pausePlan(false);
  else if(op==='plan-stop')result=this.life.stopPlan();
  else if(op==='card-add'){this.life.remember(v.title,v.body);result={ok:true};}
  else if(op==='card-edit')result=this.life.editCard(v);
  else if(op==='card-remove')result=this.life.removeCard(v.id);
  else if(op==='card-celebrate'){const card=this.life.current().album.find(c=>c.id===v.id);if(!card)throw Error('这张卡片不存在。');this.interrupt();this.engine.say(card.title+'。'+card.body,Date.now(),12000);this.engine.lastVoicePreset='action-done';this.engine.react({expression:'smile',gesture:'greet'},Date.now());result={ok:true};}
  else if(op==='card-export'){const card=this.life.current().album.find(c=>c.id===v.id);if(!card)throw Error('这张卡片不存在。');if(typeof v.png!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v.png)||v.png.length>4000000)throw Error('纪念卡图片无效。');const bytes=Buffer.from(v.png.split(',')[1],'base64'),image=this.nativeImage.createFromBuffer(bytes),size=image.getSize();if(image.isEmpty()||size.width!==1200||size.height!==800)throw Error('纪念卡尺寸无效。');const chosen=await this.dialog.showSaveDialog(this.panel(),{title:'保存纪念卡',defaultPath:'颉-纪念卡-'+new Date(card.at).toISOString().slice(0,10)+'.png',filters:[{name:'PNG 图片',extensions:['png']}]});if(chosen.canceled)return {canceled:true};if(path.extname(chosen.filePath).toLowerCase()!=='.png')throw Error('请使用 .png 文件名。');await fs.promises.writeFile(chosen.filePath,image.toPNG());result={ok:true,result:'纪念卡已保存。'};}
  else if(op==='guess-start'){result=this.life.guessStart();this.gameFeedback('serious');}
  else if(op==='guess'){result=this.life.guess(v.value);this.gameFeedback(this.life.game.finished?'smile':'puzzled');}
  else if(op==='rps'){result=this.life.rps(v.choice);this.gameFeedback(null);}
  else throw Error('未支持的相伴操作。');this.publish(true);this.publishGame();this.save();return result;
 }
 stop(){this.sensor.stop();this.closeProps();this.closeGame();}
 saveData(){return this.life.save();}
}
module.exports={LifeRuntime};

