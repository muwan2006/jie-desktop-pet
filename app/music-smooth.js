(function(root){
 'use strict';
 const COUNT=49,STEPS=96,mod=v=>((v%1)+1)%1,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 class CelPlayback{
  constructor(){this.key='';this.last=0;this.phase=.25;this.period=500;this.serial=null;this.counter=0;this.gridAt=0;this.entered=0;}
  sample(motion,now){
   const form=motion.pose==='seat'?'seat':motion.form||'classic',style=motion.pose==='sway'?'sway':'listen';
   if(form!==this.key){this.key=form;this.last=now;this.entered=now;this.phase=.25;this.serial=null;this.counter=0;this.gridAt=0;}
   const dt=clamp((now-this.last)/1000,0,.25);this.last=now;
   const r=motion.rhythm||{},grid=r.gridAt||r.beatAt,locked=Number.isFinite(grid)&&Number.isFinite(r.period)&&r.confidence>=.35&&r.period>=250&&r.period<=1500&&r.beatAt<=now&&(now-r.beatAt<r.period*3||r.clockUntil>now);
   if(locked){
    const kind=r.audioSource==='manual'?'manual':'detected';if(this.clockKind!==kind){this.serial=null;this.clockKind=kind;}
    if(this.serial===null){this.counter=0;this.gridAt=grid;}
    else if(kind==='detected'&&r.serial!==this.serial){this.counter+=Math.max(1,Math.round((grid-this.gridAt)/this.period));this.gridAt=grid;}
    if(kind==='manual'){this.counter=0;this.gridAt=grid;}
    this.serial=r.serial;this.period=r.period;
    // The two DOWN poses are on beats; UP poses are between beats.
    // Use the absolute audio clock instead of chasing it with a slow servo.
    this.phase=mod((this.counter+(now-this.gridAt-(motion.syncOffset||0))/r.period)/2);
   }else{this.serial=null;this.phase=mod(this.phase+dt/Math.max(1.2,this.period*2/1000));}
   const beatPhase=mod(this.phase*2),fade=clamp((now-this.entered)/Math.max(250,this.period),0,1),entry=fade*fade*(3-2*fade);
   const depth=(1+Math.cos(this.phase*Math.PI*4))*.5*(style==='listen'?.55:1)*entry;
   // Both styles select complete cels on the same continuous path.
   const arc=Math.acos(clamp(depth*2-1,-1,1))/(Math.PI*4);
   const source=this.phase<.25?arc:this.phase<.5?.5-arc:this.phase<.75?.5+arc:1-arc;
   const step=Math.round(source*STEPS)%STEPS,index=step<=48?step:STEPS-step;
   return {form,style,index,phase:this.phase,beatPhase,depth,locked};
  }
 }
 const assets={},bitmaps={},decoded={},player=new CelPlayback();let active='',displayed='';
 function load(form='classic'){
  if(!root.Image)return;
  if(active!==form){for(const key of Object.keys(assets))if(key!==form){bitmaps[key]?.forEach(im=>im.close?.());delete assets[key];delete bitmaps[key];delete decoded[key];}active=form;}
  if(assets[form]?.length===COUNT)return;
  assets[form]=Array.from({length:COUNT},(_,i)=>{const im=new root.Image();im.src='assets/music-smooth/'+form+'-'+i+'.webp';return im;});
  const images=assets[form];
  Promise.all(images.map(async im=>{await im.decode();return root.createImageBitmap?root.createImageBitmap(im):im;})).then(frames=>{
   if(assets[form]!==images){frames.forEach(im=>im.close?.());return;}bitmaps[form]=frames;decoded[form]=true;
  }).catch(()=>{if(assets[form]===images)decoded[form]=images.every(im=>im.complete&&im.naturalWidth===768);});
 }
 function ready(form='classic'){return (!root.Image||decoded[form]===true)&&assets[form]?.length===COUNT&&assets[form].every(im=>im.complete&&im.naturalWidth===768&&im.naturalHeight===(form==='desk'?768:832));}
 function draw(ctx,motion,now,width,height){
  if(motion?.source!=='music'||!['sway','listen','seat'].includes(motion.pose))return false;
  const form=motion.pose==='seat'?'seat':motion.form||'classic';if(!assets[form])load(form);if(!ready(form))return false;
  if(displayed!==form){displayed=form;player.key='';}
  const sampled=player.sample(motion,now);ctx.drawImage((bitmaps[form]||assets[form])[sampled.index],0,0,width,height);return true;
 }
 const api={CelPlayback,COUNT,STEPS,assets,player,load,ready,draw};if(typeof module==='object'&&module.exports)module.exports=api;else root.JieMusicCels=api;
})(typeof globalThis==='object'?globalThis:this);
