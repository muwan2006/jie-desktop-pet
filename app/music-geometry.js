(function(root){
 'use strict';
 // Measured shoe soles, excluding loose ribbon pixels. Transform the complete frame
 // around its face anchor; both face position and the true floor remain stable.
 const soles=[759,759,812,812,812,812,813,813,812,813,813,813,812,812,812,812],faceY=375,floorY=812;
 function transform(index,width,height){const scaleY=(floorY-faceY)/(soles[index]-faceY);return {scaleY,offsetY:faceY/832*height*(1-scaleY),floorY:floorY/832*height,faceY:faceY/832*height};}
 const api={soles,faceY,floorY,transform};if(typeof module==='object'&&module.exports)module.exports=api;else root.JieMusicGeometry=api;
})(typeof globalThis==='object'?globalThis:this);
