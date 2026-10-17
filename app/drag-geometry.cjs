'use strict';
const {geometry}=require('./lift-animation.js'),{dimensions}=require('./desk-animation.js');
function anchor(settings,bounds,packet){
 const d=dimensions(settings),fallback=geometry(d.width,d.height);
 const result={x:(bounds.width-d.width)/2+fallback.anchorX,y:bounds.height-8-d.height+fallback.anchorY};
 if(packet?.form!==settings.form||Math.abs(packet?.scale-settings.scale)>.001)return result;
 const p=packet?.anchor,v=packet?.viewport;
 if(!p||!v||![p.x,p.y,v.width,v.height].every(Number.isFinite)||v.width<=0||v.height<=0||p.x<0||p.y<0||p.x>v.width||p.y>v.height)return result;
 return {x:p.x*bounds.width/v.width,y:p.y*bounds.height/v.height};
}
function positionFor(cursor,anchor){return {x:cursor.x-anchor.x,y:cursor.y-anchor.y};}
function resizePet(window,width,height){
 const current=window.getSize();if(current[0]===width&&current[1]===height)return;
 const resizable=window.isResizable();try{if(!resizable)window.setResizable(true);window.setSize(width,height);}finally{if(!resizable)window.setResizable(false);}
}
module.exports={anchor,positionFor,resizePet};
