(function(root){
 'use strict';
 const W=768,H=832,AX=315,AY=120;
 let images=[],started=0,last=null,velocity=0,previous=0,angle=0;
 function geometry(width,height){const scale=Math.min(width/W,height/H);return {width:W*scale,height:H*scale,x:(width-W*scale)/2,y:(height-H*scale)/2,anchorX:(width-W*scale)/2+AX*scale,anchorY:(height-H*scale)/2+AY*scale};}
 function frameAt(now){const phase=((Math.max(0,now-started)%1800)+1800)%1800;return phase<650||phase>=1050?0:1;}
 function load(base){images=[0,1].map(i=>{const image=new Image();image.crossOrigin="anonymous";image.src=base+'lift/hang-'+i+'.webp';return image;});}
 function ready(){return images.length===2&&images.every(i=>i.complete&&i.naturalWidth);}
 function begin(now){started=now;previous=now;last=null;angle=0;velocity=0;}
 function move(x,y,now){if(last){const dt=Math.max(8,now-last.now);velocity=Math.max(-1,Math.min(1,(x-last.x)/dt/2));}last={x,y,now};}
 function draw(ctx,now,width,height){
  if(!ready())return false;
  const dt=Math.min(100,Math.max(0,now-previous));previous=now;
  if(last&&now-last.now>80)velocity*=Math.exp(-dt/220);
  const target=-velocity*.035+Math.sin((now-started)/310)*.012;angle+=(target-angle)*(1-Math.exp(-dt/140));
  const g=geometry(width,height);ctx.save();ctx.translate(g.anchorX,g.anchorY);ctx.rotate(angle);
  // One complete character per frame; no cross-fade or overlapping idle sprite.
  ctx.drawImage(images[frameAt(now)],g.x-g.anchorX,g.y-g.anchorY,g.width,g.height);ctx.restore();return true;
 }
 const api={geometry,frameAt,load,ready,begin,move,draw};if(typeof module==='object')module.exports=api;else root.JieLift=api;
})(typeof window!=='undefined'?window:globalThis);
