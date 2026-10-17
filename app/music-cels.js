(function(root){
 'use strict';
 const cycles={sway:[0,1,2,3,4,5,4,3,2,1,0,6,7,8,9,10,9,8,7,6],listen:[0,1,2,3,2,1,0,6,7,8,7,6]};
 class CelPlayback{
  constructor(){this.key='';this.last=0;this.phase=0;this.period=1.2;}
  sample(motion,now){
   const form=motion.pose==='seat'?'seat':motion.form||'classic',style=motion.pose==='sway'?'sway':'listen',key=form+':'+style;
   if(key!==this.key){this.key=key;this.last=now;this.phase=0;this.period=1.2;}
   const gap=now-this.last,dt=gap>=0&&gap<=250?gap/1000:0;this.last=now;
   const r=motion.rhythm||{},locked=r.confidence>=.35&&r.period>=280&&r.period<=1300&&r.beatAt<=now&&(now-r.beatAt<r.period*3||r.clockUntil>now);
   const target=locked?Math.max(.8,Math.min(2.4,r.period*2/1000)):1.2;
   this.period+=(target-this.period)*(1-Math.exp(-dt*3));this.phase+=dt/this.period;
   if(locked){const desired=(now-(r.gridAt||r.beatAt)-(motion.syncOffset||0))/(r.period*2),error=((desired-this.phase+.5)%1+1)%1-.5;this.phase+=Math.max(-.15,Math.min(.15,error))*(1-Math.exp(-dt*2));}
   this.phase=((this.phase%1)+1)%1;
   const cycle=cycles[style];return {form,style,index:cycle[Math.floor(this.phase*cycle.length)%cycle.length],phase:this.phase,locked};
  }
 }
 const assets={},player=new CelPlayback();
 function load(){if(!root.Image)return;for(const form of ['classic','desk','seat'])assets[form]=Array.from({length:11},(_,i)=>{const im=new root.Image();im.src='assets/music-cels/'+form+'-'+i+'.webp';return im;});}
 function ready(form='classic'){return !!assets[form]?.every(im=>im.complete&&im.naturalWidth===768&&im.naturalHeight===(form==='desk'?768:832));}
 function draw(ctx,motion,now,width,height){
  if(motion?.source!=='music'||!['sway','listen','seat'].includes(motion.pose))return false;
  const sampled=player.sample(motion,now);if(!ready(sampled.form))return false;
  // A single complete pre-rendered cel. No head layer, mask, mesh, crossfade,
  // rotation, or previous frame is drawn on top of it.
  ctx.drawImage(assets[sampled.form][sampled.index],0,0,width,height);return true;
 }
 const api={CelPlayback,cycles,assets,player,load,ready,draw};if(typeof module==='object'&&module.exports)module.exports=api;else root.JieMusicCels=api;
})(typeof globalThis==='object'?globalThis:this);
