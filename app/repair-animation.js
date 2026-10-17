(function(root){
 'use strict';
 const classic=['smile','laugh','shy','surprise','puzzled','serious','sleepy','comfort'];
 const desk=['think','inspect','chin','rub','stretch','nod','smile','laugh','shy','typo','idea','puzzled','sleepy','relief'];
 let sheets={};
 function supports(form,id){return (form==='classic'?classic:form==='desk'?desk:[]).includes(id);}
 function load(prefix='assets/'){
  for(const [form,ids] of [['classic',classic],['desk',desk]])for(const id of ids){
   const im=new root.Image();im.crossOrigin="anonymous";im.src=prefix+'repair-1.7.3/'+form+'-'+id+'.png';sheets[form+'-'+id]=im;
  }
 }
 function ready(form,id){const im=sheets[form+'-'+id];return supports(form,id)&&!!im&&(im.complete??true)&&(im.naturalWidth??im.width)>0;}
 function setSheets(value){sheets=value;}
 function frameAt(form,id,elapsed,duration){
  if(elapsed<220)return 0;
  if(duration-elapsed<220)return 5;
  const times=[220,330,Math.max(350,duration-1330),120,440,220];
  let t=Math.max(0,elapsed);
  for(let i=0;i<6;i++){if(t<times[i])return i;t-=times[i];}
  return 5;
 }
 function pose(ctx,form,id,frame,width,height){
  if(!ready(form,id))return false;
  const im=sheets[form+'-'+id];const w=(im.naturalWidth??im.width)/3,h=(im.naturalHeight??im.height)/2;
  ctx.drawImage(im,(frame%3)*w,Math.floor(frame/3)*h,w,h,0,0,width,height);return true;
 }
 function draw(ctx,form,id,elapsed,duration,width,height){
  if(!ready(form,id))return false;
  return pose(ctx,form,id,frameAt(form,id,elapsed,duration),width,height);
 }
 function typingFrame(elapsed,duration,fast){
  if(elapsed<180||duration-elapsed<180)return 0;
  const period=fast?110:280;
  return Math.floor((elapsed-180)/period)%2?3:2;
 }
 const api={classic,desk,supports,load,ready,setSheets,frameAt,pose,draw,typingFrame};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.JieRepair=api;
})(typeof globalThis==='object'?globalThis:this);
