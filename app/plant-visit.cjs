'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function target(pet,plant,area){
 const ys=clamp(plant.y+203-pet.height+8,area.y,Math.max(area.y,area.y+area.height-pet.height));
 const xs=[plant.x-pet.width-10,plant.x+plant.width+10].filter(x=>x>=area.x&&x+pet.width<=area.x+area.width);
 if(!xs.length)return null;const x=xs.sort((a,b)=>Math.abs(a-pet.x)-Math.abs(b-pet.x))[0];return {x,y:ys};
}
class PlantVisit{
 constructor(){this.active=null;this.motion=null;}
 begin({owner,position,pet,plant,area,care=false,automatic=false,now}){if(this.active)throw Error('我已经在往青竹那边去了。');const to=target(pet,plant,area);if(!to)throw Error('青竹旁边放不下我，往桌面中间挪一点吧。');const distance=Math.hypot(to.x-position.x,to.y-position.y);this.active={owner:{...owner},from:{...position},to,plant:{...plant},pet:{width:pet.width,height:pet.height},care,automatic,started:now,duration:Math.round(clamp(distance/350*1000,650,2800)),phase:'travel'};this.motion={pose:'float',source:'plant',started:now,until:now+4000};return this.active;}
 cancel(){this.active=null;this.motion=null;}
 tick(now,position,{owner,plant,pet,blocked=false}){const v=this.active;if(!v)return {position};if(blocked||owner.profile!==v.owner.profile||owner.thread!==v.owner.thread||!plant||plant.x!==v.plant.x||plant.y!==v.plant.y||pet.width!==v.pet.width||pet.height!==v.pet.height){this.cancel();return {position,event:'cancel'};}
  if(v.phase==='travel'){const t=clamp((now-v.started)/v.duration,0,1),s=t*t*(3-2*t),p={x:v.from.x+(v.to.x-v.from.x)*s,y:v.from.y+(v.to.y-v.from.y)*s};if(t>=1){v.phase='inspect';v.arrived=now;this.motion=null;return {position:{...v.to},event:'arrive'};}return {position:p};}
  if(v.phase==='inspect'&&now-v.arrived>=2400){v.phase='care';v.cared=now;return {position:{...v.to},event:'care'};}
  if(v.phase==='care'&&now-v.cared>=1600){this.cancel();return {position:{...v.to},event:'finish',visit:v};}
  return {position:{...v.to}};
 }
}
function prompt(card,facts){return {instructions:'你就是颉，刚在用户桌面上的青竹旁停留。用完整角色卡的性格，以第一人称自然说一句感受，最多65字。严格依照事实：只有watered为true才说自己浇了水；newGrowth才说长出新叶；不要写旁白、指令、网址或捏造过去。返回JSON {"text":"一句台词","stage":数字,"watered":布尔值}。角色卡：\n'+String(card?.text||''),input:JSON.stringify(facts)};}
function reply(r,f){const t=typeof r?.text==='string'?r.text.trim():'';return r?.stage===f.stage&&r.watered===f.watered&&t&&t.length<=90&&!/[<>`\r\n]|https?:\/\//i.test(t)?t:null;}
function fallback(f){return f.newGrowth?'又多了一片叶子。你看，慢慢长，也有慢慢长的好处。':f.watered?'水添好了。让它慢慢长吧，我陪你等新叶子。':'我来看看这盆青竹。叶子倒是清静，陪你摆在这儿正好。';}
module.exports={PlantVisit,target,prompt,reply,fallback};
