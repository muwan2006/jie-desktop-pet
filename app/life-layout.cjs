'use strict';
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(v,Math.max(lo,hi)));
function intersection(a,b){return Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));}
function adjacent(owner,size,area,gap=14){
 const candidates=[{x:owner.x+owner.width+gap,y:owner.y+owner.height-size.height},{x:owner.x-size.width-gap,y:owner.y+owner.height-size.height},{x:owner.x+(owner.width-size.width)/2,y:owner.y-size.height-gap},{x:owner.x+(owner.width-size.width)/2,y:owner.y+owner.height+gap}];
 return candidates.map(p=>({...p,x:clamp(p.x,area.x,area.x+area.width-size.width),y:clamp(p.y,area.y,area.y+area.height-size.height),...size})).sort((a,b)=>intersection(a,owner)-intersection(b,owner))[0];
}
function seatTarget(window,geom,area,fraction=.55){
 const bodyHeight=geom.bodyHeight||geom.height,top=geom.canvasTop||0,head=geom.headTop??.11;
 const minY=area.y-top-head*bodyHeight+3,outerY=window.y-geom.seatY,inside=outerY<minY;
 const bodyWidth=geom.bodyWidth||geom.width,canvasX=(geom.width-bodyWidth)/2;
 const center=inside?window.x+window.width-bodyWidth/2-15:window.x+window.width*fraction;
 return {x:clamp(center-geom.width/2,area.x-canvasX+3,area.x+area.width-canvasX-bodyWidth-3),y:Math.max(minY,outerY),inside};
}
function propTarget(prop,position,geom,area){
 const bodyWidth=geom.bodyWidth||geom.width,offset=bodyWidth*.5+62,center=prop.x+47;
 const candidates=[center-offset,center+offset].map(x=>({x:clamp(x-geom.width/2,area.x,area.x+area.width-geom.width),y:clamp(prop.y+104-geom.height+8,area.y,area.y+area.height-geom.height)}));
 const owner=p=>({x:p.x+(geom.width-bodyWidth)/2,y:p.y,width:bodyWidth,height:geom.height});
 return candidates.sort((a,b)=>intersection(owner(a),{...prop,width:94,height:104})-intersection(owner(b),{...prop,width:94,height:104})||Math.abs(a.x-position.x)-Math.abs(b.x-position.x))[0];
}
module.exports={seatTarget,propTarget,adjacent,intersection};
