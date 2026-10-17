(function(root){
 'use strict';
 function deskFrame(now,state,activity={}){
  if(state.resting)return 1;
  const gesture=state.deskGesture;
  if(gesture?.until>now&&gesture.name==='tea'){
   const elapsed=now-gesture.started;
   return elapsed<550?4:elapsed<2600?5:4;
  }
  if(gesture?.until>now&&gesture.name==='typing')return Math.floor(now/140)%2?2:3;
  if(now-(activity.lastPress??-Infinity)<320)return Math.floor(now/110)%2?2:3;
  const cycle=now%5200;
  return cycle>=4750&&cycle<4880?1:0;
 }
 function dimensions(settings={}){
  const scale=Number.isFinite(settings.scale)?settings.scale:1;
  return settings.form==='desk'?{width:310*scale,height:310*scale}:{width:192*1.2*scale,height:208*1.2*scale};
 }
 function drawDesk(ctx,sheet,index,width,height){
  const sw=sheet.naturalWidth/3,sh=sheet.naturalHeight/2;
  ctx.save();ctx.scale(width/512,height/512);
  // One fixed drawing anchors the desk, keyboard, head, hair, horns and torso.
  ctx.drawImage(sheet,0,0,sw,sh,0,0,512,512);
  function overlay(frame,offset,points){
   ctx.save();ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();
   ctx.drawImage(sheet,(frame%3)*sw,Math.floor(frame/3)*sh,sw,sh,offset[0],offset[1],512,512);ctx.restore();
  }
  const eyes=[[205,225],[371,225],[371,280],[205,280]];
  if(index===1||index===5)overlay(1,[9,0],eyes);
  if(index===2)overlay(2,[19,0],[[289,331],[396,331],[396,394],[289,394]]);
  if(index===3)overlay(3,[0,3],[[127,325],[255,325],[255,394],[127,394]]);
  if(index===4||index===5)overlay(index,index===4?[9,3]:[19,2],[[126,394],[142,365],[157,337],[188,293],[208,274],[295,274],[295,332],[257,351],[235,394]]);
  // Neither a key press nor a sip may change any keyboard or desk pixel.
  ctx.drawImage(sheet,0,sh*394/512,sw,sh*118/512,0,394,512,118);
  ctx.restore();
 }
 const api={deskFrame,dimensions,drawDesk};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.JieDesk=api;
})(typeof globalThis==='object'?globalThis:this);
