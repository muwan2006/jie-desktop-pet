(function(root){
 'use strict';
 const parts=['head','face','tail','body'];
 function hitPart(form,x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>1||y>1)return null;
  if(form==='desk'){
   if(x>=.09&&x<.34&&y>=.59&&y<=.78)return 'tail';
   if(x>=.36&&x<=.76&&y>=.435&&y<=.59)return 'face';
   if(x>=.15&&x<=.85&&y<.435)return 'head';
   if(y>=.79)return null; // The desk and keyboard are objects, not her body.
  }else{
   if(x>=.20&&x<.43&&y>=.78&&y<=.96)return 'tail';
   if(x>=.40&&x<=.72&&y>=.435&&y<=.55)return 'face';
   if(x>=.23&&x<=.82&&y<.435)return 'head';
  }
  return 'body';
 }
 const lines={
  head:[['shy','轻一点。'],['smile','又摸到我的头了。'],['puzzled','头发都要被你揉乱啦。']],
  face:[['puzzled','嗯？脸上有什么吗？'],['shy','别一直戳啦……'],['laugh','好啦，我知道你在逗我。']],
  tail:[['puzzled','嗯？是你碰了我的尾巴？'],['shy','尾巴也会怕痒的。'],['laugh','被我发现啦，别再偷碰了。']],
  body:[['smile','我在这里。'],['puzzled','怎么啦？有事叫我就好。'],['laugh','好啦，我看见你了。']]
 };
 function reaction(part,count){if(!parts.includes(part))return null;const [expression,text]=lines[part][Math.min(2,Math.max(0,count-1))];return {expression,text};}
 const api={parts,hitPart,reaction};if(typeof module==='object'&&module.exports)module.exports=api;else root.JieBody=api;
})(typeof globalThis==='object'?globalThis:this);
