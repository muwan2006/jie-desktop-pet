'use strict';
(()=>{
 const assets={},player=new window.JieLifePlayback(),counts={seat:16,float:4,listen:16,tea:4,crane:4,write:4,'rps-rock':4,'rps-paper':4,'rps-scissors':4};
 // Adjacent complete drawings are ordered by whole-frame similarity to reduce keyframe jumps.
 const orders={seat:[0,3,2,11,9,8,10,6,7,4,5,15,14,13,12,1],listen:[0,9,11,8,15,13,12,14,2,3,4,5,6,7,10,1]};
 function load(){window.JieMusicCels?.load();for(const [name,n] of Object.entries(counts)){const folder=['seat','listen'].includes(name)||name.startsWith('rps-')?'life-smooth':'desktop-life';assets[name]=Array.from({length:n},(_,i)=>{const im=new Image();im.src='assets/'+folder+'/'+name+'-'+i+'.webp';return im;});}}
 function draw(ctx,motion,now,width,height){
  if(!motion)return false;
  if(motion.source==='music'&&['listen','sway','seat'].includes(motion.pose))return window.JieMusicCels?.draw(ctx,motion,now,width,height)||false;
  if(motion.pose==='walk-left'||motion.pose==='walk-right')return window.JieClassicHD.drawBase(ctx,motion.pose==='walk-right'?1:2,Math.floor(now/120)%8,width,height);
  const name=motion.pose==='sway'?'listen':motion.pose;
  if(name==='read')return window.JieClassicHD.drawEmote(ctx,'unroll',(now-(motion.started||now))%4000,4000,width,height);
  const images=assets[name];if(!images||!images.every(im=>im.complete&&im.naturalWidth===768))return false;
  const sampled=name==='float'?{index:1,pulse:0}:player.sample(motion,now,images.length),index=sampled.index,frameIndex=orders[name]?.[index]??index,frame=images[frameIndex];
  ctx.save();if(name==='listen'){const g=window.JieMusicGeometry.transform(frameIndex,width,height);if(motion.source==='music'&&sampled.pulse){ctx.translate(0,g.floorY);ctx.scale(1,1-(motion.pose==='sway'?.022:.012)*sampled.pulse);ctx.translate(0,-g.floorY);}ctx.translate(0,g.offsetY);ctx.scale(1,g.scaleY);}ctx.drawImage(frame,0,0,768,832,0,0,width,height);ctx.restore();return true;
 }
 window.JieLifeAnimation={load,draw,assets,player,counts};
})();
