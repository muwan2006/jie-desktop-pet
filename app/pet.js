'use strict';
const canvas=document.querySelector('#pet'),ctx=canvas.getContext('2d',{willReadFrequently:true});
const bubble=document.querySelector('#bubble'),timer=document.querySelector('#timer');
const atlas=new Image();atlas.crossOrigin='anonymous';atlas.src='assets/jie.png';
const deskAtlas=new Image();deskAtlas.crossOrigin='anonymous';deskAtlas.src='assets/jie-desk.png';
window.JieFrames.load('assets/');
window.JieRepair.load('assets/');
window.JieClassicHD.load('assets/');
window.JieLift.load('assets/');
window.JieTouch?.load('assets/');window.JieLifeAnimation?.load();
const activity={lastPress:-Infinity};
const sourceWidth=384,sourceHeight=416;
function resizeCanvas(scale){const ratio=window.devicePixelRatio||1;const {width:w,height:h}=window.JieDesk.dimensions({...snapshot.settings,scale});
 canvas.style.width=w+'px';canvas.style.height=h+'px';const pw=Math.round(w*ratio),ph=Math.round(h*ratio);
 if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';}}
const rows={idle:[0,[280,110,110,140,140,320]],right:[1,Array(8).fill(120)],left:[2,Array(8).fill(120)],wave:[3,[140,140,140,280]],jump:[4,[140,140,140,140,280]],failed:[5,Array(8).fill(140)],waiting:[6,Array(6).fill(180)],work:[7,Array(6).fill(180)],review:[8,Array(6).fill(200)]};
let voiceBusy=false;window.jie.onVoiceState?.(s=>{voiceBusy=s.state!=='idle';if(voiceBusy)gaze=null;});window.jie.voiceState?.().then(s=>{voiceBusy=s.state!=='idle';if(voiceBusy)gaze=null;});
function canFollow(){return !snapshot.lettingPass&&!snapshot.lifeMotion&&!voiceBusy&&!snapshot.performanceActive&&!snapshot.performance&&!snapshot.emotionHold&&!snapshot.bodyMotion&&!down;}
let snapshot={settings:{scale:1},action:'idle'},action='idle',started=performance.now(),gaze=null,pointer=null,down=null,clickTimer,dragging=false;
let appearanceId='builtin';function update(s){snapshot=s;document.body.classList.toggle('letting-pass',!!s.lettingPass);const id=s.appearance?.id||'builtin';if(id!==appearanceId){appearanceId=id;window.JieRole.set(s.appearance);gaze=null;const base=s.appearance?.renderer==='jie-v1'?s.appearance.base:'assets/';atlas.src=base+'jie.png';deskAtlas.src=base+'jie-desk.png';for(const name of ['JieFrames','JieRepair','JieClassicHD','JieLift','JieTouch'])window[name]?.load(base);}document.body.classList.toggle('desk-form',s.settings.form==='desk');if(s.resting||s.settings.form!=='desk')activity.lastPress=-Infinity;canvas.setAttribute('aria-label',s.settings.form==='desk'?'颉的书案形态，摸头、戳脸、碰尾巴，右键切换形态，按住拖动':'颉，摸头、戳脸、碰尾巴，双击跳跃，右键菜单，按住拖动');resizeCanvas(s.settings.scale);if(dragging)window.jie.dragAnchor?.(liftAnchorPacket());bubble.hidden=!s.message;bubble.textContent=s.message;timer.hidden=!s.focus;
 if(s.focus){const sec=Math.ceil(s.focus.remaining/1000);timer.textContent=`${s.focus.paused?'已暂停 · ':''}${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`;}
 if(s.action!==action){action=s.action;started=performance.now();}if(s.resting||s.mode!=='companion'||s.dragging||s.emote||!canFollow())gaze=null;
}
window.jie.onTyping?.(()=>{if(snapshot.settings.form==='desk'&&!snapshot.resting)activity.lastPress=Date.now();});
window.jie.onSnapshot(update);window.jie.snapshot().then(update);
window.jie.onCursor(p=>{pointer=p;const r=canvas.getBoundingClientRect(),dx=p.x-r.left-r.width/2,dy=p.y-r.top-r.height*.35;const distance=Math.hypot(dx,dy);
 gaze=canFollow()&&!snapshot.emote&&!snapshot.dragging&&distance>70&&distance<700&&snapshot.action==='idle'&&!snapshot.resting&&snapshot.mode==='companion'?Math.round((Math.atan2(dx,-dy)*180/Math.PI+360)/22.5)%16:null;
});
function frame(now){if(atlas.complete&&atlas.naturalWidth){let row,col;
 if(canFollow()&&gaze!==null&&!dragging&&!snapshot.dragging&&!snapshot.emote){row=9+Math.floor(gaze/8);col=gaze%8;}
 else {const state=rows[action]||rows.idle;row=state[0];const durations=state[1];const period=durations.reduce((a,b)=>a+b,0);let t=(now-started)%period;col=0;while(col<durations.length-1&&t>=durations[col])t-=durations[col++];if(snapshot.resting)col=0;}
 resizeCanvas(snapshot.settings.scale||1);ctx.clearRect(0,0,canvas.width,canvas.height);if(window.JieRole?.draw(ctx,snapshot,Date.now(),canvas.width,canvas.height,gaze,dragging)){}else if((dragging||snapshot.dragging)&&window.JieLift.ready()){window.JieLift.draw(ctx,Date.now(),canvas.width,canvas.height);
 }else if(snapshot.bodyMotion&&window.JieTouch?.draw(ctx,snapshot.bodyMotion,Date.now(),canvas.width,canvas.height)){
 }else if(snapshot.lifeMotion&&(!snapshot.appearance||snapshot.appearance.id==='builtin')&&window.JieLifeAnimation?.draw(ctx,snapshot.lifeMotion,Date.now(),canvas.width,canvas.height)){
 }else if(snapshot.settings.form==='desk'&&deskAtlas.complete&&deskAtlas.naturalWidth){
  const index=window.JieDesk.deskFrame(Date.now(),snapshot,activity);
  if(window.JieFrames.ready('desk')&&window.JieEmotes.active(snapshot.emote,'desk',Date.now()))window.JieEmotes.drawDeskExtra(ctx,deskAtlas,null,snapshot.emote,Date.now(),canvas.width,canvas.height,activity);
  else window.JieDesk.drawDesk(ctx,deskAtlas,index,canvas.width,canvas.height);
 }else if(window.JieFrames.ready('classic')&&window.JieEmotes.active(snapshot.emote,'classic',Date.now())){
  if(!window.JieEmotes.drawClassic(ctx,null,snapshot.emote,Date.now(),canvas.width,canvas.height)){if(!window.JieClassicHD.drawBase(ctx,0,0,canvas.width,canvas.height))ctx.drawImage(atlas,0,0,sourceWidth,sourceHeight,0,0,canvas.width,canvas.height);}
 }else if(!window.JieClassicHD.drawBase(ctx,row,col,canvas.width,canvas.height)){
  // Keep a whole neutral character visible while new direction/gesture images
  // decode, rather than displaying an old facial-only animation for one frame.
  if(!window.JieClassicHD.drawBase(ctx,0,0,canvas.width,canvas.height))ctx.drawImage(atlas,0,0,sourceWidth,sourceHeight,0,0,canvas.width,canvas.height);
 }
 if(pointer&&!dragging){const r=canvas.getBoundingClientRect();const x=Math.floor((pointer.x-r.left)/r.width*canvas.width),y=Math.floor((pointer.y-r.top)/r.height*canvas.height);const overTimer=!timer.hidden&&pointer.x>=timer.offsetLeft-timer.offsetWidth/2&&pointer.x<=timer.offsetLeft+timer.offsetWidth/2&&pointer.y>=timer.offsetTop&&pointer.y<=timer.offsetTop+timer.offsetHeight;const vr=document.querySelector('#voice-badge').getBoundingClientRect(),overVoice=!document.querySelector('#voice-badge').hidden&&pointer.x>=vr.left&&pointer.x<=vr.right&&pointer.y>=vr.top&&pointer.y<=vr.bottom;const wb=document.querySelector('#watch-badge'),wr=wb?.getBoundingClientRect(),overWatch=wb&&!wb.hidden&&pointer.x>=wr.left&&pointer.x<=wr.right&&pointer.y>=wr.top&&pointer.y<=wr.bottom;const ab=document.querySelector('#assistant-badge'),ar=ab?.getBoundingClientRect(),overAssistant=ar&&pointer.x>=ar.left&&pointer.x<=ar.right&&pointer.y>=ar.top&&pointer.y<=ar.bottom;const hit=overAssistant||overWatch||overVoice||overTimer||(x>=0&&x<canvas.width&&y>=0&&y<canvas.height&&ctx.getImageData(x,y,1,1).data[3]>30);if(hit!==frame.lastHit){frame.lastHit=hit;window.jie.hit(hit);}}
 }requestAnimationFrame(frame);}requestAnimationFrame(frame);
function liftAnchorPacket(){
 const r=canvas.getBoundingClientRect(),g=window.JieRole?.anchor(canvas.width,canvas.height)||window.JieLift.geometry(canvas.width,canvas.height);
 return {form:snapshot.settings.form,scale:snapshot.settings.scale,viewport:{width:window.innerWidth,height:window.innerHeight},anchor:{x:r.left+g.anchorX*r.width/canvas.width,y:r.top+g.anchorY*r.height/canvas.height}};
}
function touchedPart(e){
 const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
 if(x<0||y<0||x>=1||y>=1)return null;
 if(ctx.getImageData(Math.floor(x*canvas.width),Math.floor(y*canvas.height),1,1).data[3]<=30)return null;
 return window.JieBody.hitPart(snapshot.settings.form,x,y);
}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;const part=touchedPart(e);if(!part)return;window.jie.petPointer(true);down={x:e.screenX,y:e.screenY,part};gaze=null;dragging=false;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(dragging)window.JieLift.move(e.screenX,e.screenY,Date.now());if(down&&!dragging&&Math.hypot(e.screenX-down.x,e.screenY-down.y)>5){clearTimeout(clickTimer);dragging=true;window.JieLift.begin(Date.now());window.jie.dragStart(liftAnchorPacket());}});
function end(e){window.jie.petPointer(false);if(!down)return;const wasDrag=dragging,part=down.part;down=null;dragging=false;if(wasDrag){window.jie.dragEnd();return;}clearTimeout(clickTimer);if(e.type==='pointerup')clickTimer=setTimeout(()=>window.jie.touch(part),220);}
canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',()=>{window.jie.petPointer(false);if(down){const wasDrag=dragging;down=null;dragging=false;if(wasDrag)window.jie.dragEnd();}});
canvas.addEventListener('dblclick',()=>{clearTimeout(clickTimer);window.jie.command('jump');});
document.addEventListener('contextmenu',e=>{e.preventDefault();window.jie.menu();});timer.addEventListener('click',()=>window.jie.command('settings'));
canvas.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();window.jie.command('touch');}if(e.key==='Escape')window.jie.command('hide');});

const watchBadge=document.querySelector('#watch-badge');if(watchBadge){watchBadge.onclick=()=>window.jie.command('watch-stop');window.jie.onWatch?.(s=>{watchBadge.hidden=!s.active;watchBadge.textContent=s.paused?'观察已暂停 · 停止':s.settings.mode==='companion'?'陪玩中 · 停止':'看屏幕中 · 停止';document.body.classList.toggle('watching',s.active);});}
