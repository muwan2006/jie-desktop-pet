(function(root){
 'use strict';
 const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),smooth=t=>t*t*(3-2*t);
 // A neck hinge with a short transition into the collar. Everything beneath it
 // uses the same untouched neutral drawing on every frame, including the feet.
 const layouts={classic:{width:768,height:832,pivotX:424,pivotY:449,blendTop:422,fixedFrom:470},seat:{width:768,height:832,pivotX:421,pivotY:416,blendTop:397,fixedFrom:442},desk:{width:512,height:512,pivotX:268,pivotY:306,blendTop:290,fixedFrom:325}};
 class HeadMotion{
  constructor(){this.key='';this.last=0;this.phase=0;this.period=1;this.entered=0;}
  sample(motion,now){
   const key=(motion.form||'classic')+':'+motion.pose;
   if(key!==this.key){this.key=key;this.last=now;this.entered=now;this.phase=0;this.period=1;}
   const gap=now-this.last,dt=gap>250||gap<0?0:gap/1000;this.last=now;
   const r=motion.rhythm||{},locked=r.confidence>=.35&&r.period>=280&&r.period<=1300&&(now-r.beatAt<r.period*3||r.clockUntil>now);
   const target=locked?clamp(r.period*2/1000,.7,2.4):1.4;this.period+=(target-this.period)*(1-Math.exp(-dt*3));this.phase+=dt/this.period;
   if(locked){const desired=(now-(r.gridAt||r.beatAt)-(motion.syncOffset||0))/(r.period*2),error=((desired-this.phase+.5)%1+1)%1-.5;this.phase+=clamp(error,-.2,.2)*(1-Math.exp(-dt*3));}
   this.phase=((this.phase%1)+1)%1;
   const fade=smooth(clamp((now-this.entered)/500,0,1)),quiet=motion.pose!=='sway';
   return {angle:Math.sin(this.phase*TAU)*(quiet?.014:.032)*fade,nod:(1+Math.cos(this.phase*TAU*2))*.5*(quiet?.006:.013)*fade,phase:this.phase,locked};
  }
 }
 function point(x,y,layout,motion){
  if(y>=layout.fixedFrom)return {x,y};
  const weight=y<=layout.blendTop?1:1-smooth((y-layout.blendTop)/(layout.fixedFrom-layout.blendTop));
  const dx=x-layout.pivotX,dy=y-layout.pivotY,c=Math.cos(motion.angle),s=Math.sin(motion.angle);
  return {x:x+(dx*c-dy*s-dx)*weight,y:y+(dx*s+dy*c-dy-motion.nod*dy)*weight};
 }
 function triangle(ctx,image,source,dest){
  const [a,b,c]=source,[u,v,w]=dest,det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);
  const A=((v.x-u.x)*(c.y-a.y)-(w.x-u.x)*(b.y-a.y))/det,B=((v.y-u.y)*(c.y-a.y)-(w.y-u.y)*(b.y-a.y))/det;
  const C=((w.x-u.x)*(b.x-a.x)-(v.x-u.x)*(c.x-a.x))/det,D=((w.y-u.y)*(b.x-a.x)-(v.y-u.y)*(c.x-a.x))/det;
  const E=u.x-A*a.x-C*a.y,F=u.y-B*a.x-D*a.y;
  ctx.save();ctx.beginPath();
  // Slightly overlap internal triangle edges to avoid transparent raster seams.
  const normals=dest.map((p,i)=>{const q=dest[(i+1)%3],dx=q.x-p.x,dy=q.y-p.y,n=Math.hypot(dx,dy);return {x:dy/n,y:-dx/n};});
  for(const [i,p] of dest.entries()){const a=normals[(i+2)%3],b=normals[i],k=.8/Math.max(.00001,1+a.x*b.x+a.y*b.y),q={x:p.x+(a.x+b.x)*k,y:p.y+(a.y+b.y)*k};if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);}
  ctx.closePath();ctx.clip();ctx.globalCompositeOperation='copy';ctx.transform(A,B,C,D,E,F);ctx.drawImage(image,0,0);ctx.restore();
 }
 const bodyCache=new WeakMap();
 function fixedBody(image,width,height){
  let body=bodyCache.get(image);
  if(!body||body.width!==Math.round(width)||body.height!==Math.round(height)){
   body=root.document.createElement('canvas');body.width=Math.round(width);body.height=Math.round(height);
   body.getContext('2d',{willReadFrequently:true}).drawImage(image,0,0,body.width,body.height);bodyCache.set(image,body);
  }
  return body;
 }
 function render(ctx,image,form,motion,width,height){
  const l=layouts[form]||layouts.classic;ctx.save();ctx.scale(width/l.width,height/l.height);
  // Draw the fixed body after the mesh, so overlap can never move the lower pixels.
  const c=Math.cos(motion.angle),s=Math.sin(motion.angle),A=c,B=s,C=-s,D=c-motion.nod,E=l.pivotX-A*l.pivotX-C*l.pivotY,F=l.pivotY-B*l.pivotX-D*l.pivotY;
  ctx.save();ctx.transform(A,B,C,D,E,F);ctx.beginPath();ctx.rect(0,0,l.width,l.blendTop+.8);ctx.clip();ctx.drawImage(image,0,0);ctx.restore();
  const rows=[l.blendTop,l.fixedFrom];
  for(let i=0;i<rows.length-1;i++){
   const a={x:0,y:rows[i]},b={x:l.width,y:rows[i]},c={x:l.width,y:rows[i+1]},d={x:0,y:rows[i+1]};
   const u=point(a.x,a.y,l,motion),v=point(b.x,b.y,l,motion),w=point(c.x,c.y,l,motion),z=point(d.x,d.y,l,motion);
   triangle(ctx,image,[a,b,c],[u,v,w]);triangle(ctx,image,[a,c,d],[u,w,z]);
  }
  ctx.restore();
  // Keep the lower drawing in output pixels. Reusing this raster avoids GPU
  // resampling differences after the animated head's affine transforms.
  const body=fixedBody(image,width,height),cut=Math.ceil(l.fixedFrom/l.height*height);
  ctx.save();ctx.beginPath();ctx.rect(0,cut,width,height-cut);ctx.clip();ctx.globalCompositeOperation='copy';ctx.drawImage(body,0,0,width,height);ctx.restore();
 }
 const assets={},player=new HeadMotion();
 function load(){
  if(!root.Image)return;
  const classic=new root.Image();classic.src='assets/classic-hd/v176-base-0-0.webp';assets.classic=classic;
  const seat=new root.Image();seat.src='assets/life-smooth/seat-0.webp';assets.seat=seat;
  const sheet=new root.Image();sheet.onload=()=>{const c=root.document.createElement('canvas');c.width=512;c.height=512;c.getContext('2d').drawImage(sheet,0,0,sheet.naturalWidth/3,sheet.naturalHeight/2,0,0,512,512);assets.desk=c;};sheet.src='assets/jie-desk.png';
 }
 function ready(form='classic'){const im=assets[form];return !!im&&(form==='desk'||im.complete&&im.naturalWidth===768);}
 function draw(ctx,motion,now,width,height){const form=motion.pose==='seat'?'seat':motion.form||'classic';if(!ready(form))return false;render(ctx,assets[form],form,player.sample(motion,now),width,height);return true;}
 const api={HeadMotion,layouts,point,render,assets,player,load,ready,draw};if(typeof module==='object'&&module.exports)module.exports=api;else root.JieMusicHead=api;
})(typeof globalThis==='object'?globalThis:this);
