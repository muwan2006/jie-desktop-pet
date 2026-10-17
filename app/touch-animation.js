(function(root){
 'use strict';
 let images={},layout={};
 function load(base='assets/'){
  for(const id of ['landing','tail-classic','tail-desk']){const im=new root.Image();im.crossOrigin="anonymous";im.src=base+'touch/'+id+'.png';images[id]=im;}
  // Layout records crop rectangles and one proportional transform per frame.
  // Each source is a complete generated character, never a face/body composite.
  layout=root.JieTouchLayout||{};
 }
 function ready(id){return !!layout[id]&&!!images[id]?.complete&&images[id].naturalWidth>0;}
 function frameAt(id,elapsed,duration){const ends=id==='landing'?[420,1050,1750,duration]:[420,1000,1900,duration];return ends.findIndex(t=>elapsed<t)<0?3:ends.findIndex(t=>elapsed<t);}
 function draw(ctx,state,now,width,height){
  if(!state||now>=state.until||!ready(state.id))return false;
  const frame=layout[state.id][frameAt(state.id,Math.max(0,now-state.started),state.until-state.started)];
  ctx.save();
  if(state.id==='landing'){const k=Math.min(width/768,height/832);ctx.translate((width-768*k)/2,(height-832*k)/2);ctx.scale(k,k);}
  else ctx.scale(width/768,height/832);
  const [sx,sy,sw,sh]=frame.source,[dx,dy,dw,dh]=frame.destination;
  ctx.translate(dx,dy);ctx.scale(dw/sw,dh/sh);
  if(!frame.path){frame.path=new root.Path2D();for(const [x,y,w] of frame.clip)frame.path.rect(x,y,w,1);}
  ctx.clip(frame.path);ctx.drawImage(images[state.id],sx,sy,sw,sh,0,0,sw,sh);ctx.restore();return true;
 }
 const api={load,ready,frameAt,draw};if(typeof module==='object'&&module.exports)module.exports=api;else root.JieTouch=api;
})(typeof globalThis==='object'?globalThis:this);
