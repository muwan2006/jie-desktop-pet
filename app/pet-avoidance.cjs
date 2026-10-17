'use strict';
const inside=(p,r,pad=0)=>p.x>=r.x-pad&&p.y>=r.y-pad&&p.x<=r.x+r.width+pad&&p.y<=r.y+r.height+pad;
function destination(position,area,z,cursor){const margin=12,xs=[area.x+margin,area.x+area.width-z.width-margin],ys=[area.y+margin,area.y+area.height-z.height-margin];const choices=xs.flatMap(x=>ys.map(y=>({x:Math.max(area.x,x),y:Math.max(area.y,y)}))).filter(p=>!inside(cursor,{...p,...z},70));return choices.sort((a,b)=>Math.hypot(a.x-position.x,a.y-position.y)-Math.hypot(b.x-position.x,b.y-position.y))[0]||null;}
class PetAvoidance{
 constructor(){this.until=0;this.hitAt=0;this.active=false;this.home=null;this.trip=null;this.clearAt=0;this.blockUntil=0;}
 fade(now=Date.now()){this.until=this.until>now?0:now+20000;return this.until>now;}
 faded(now=Date.now()){return this.until>now;}
 cancel(now=Date.now()){this.home=null;this.trip=null;this.active=false;this.clearAt=0;this.hitAt=0;this.blockUntil=now+15000;}
 tick({now=Date.now(),enabled=false,position,area,size,cursor,hit=false,blocked=false}){
  if(blocked||!enabled){this.hitAt=0;if(this.active)this.cancel(now);return position;}
  if(now<this.blockUntil)return position;
  if(this.trip){const t=Math.min(1,(now-this.trip.at)/350),k=t*t*(3-2*t),p={x:this.trip.from.x+(this.trip.to.x-this.trip.from.x)*k,y:this.trip.from.y+(this.trip.to.y-this.trip.from.y)*k};if(t>=1){this.trip=null;if(!this.home)this.active=false;}return p;}
  if(this.home){if(inside(cursor,{...this.home,...size},70)){this.clearAt=0;return position;}this.clearAt||=now;if(now-this.clearAt>=3000&&now-this.movedAt>=10000){this.trip={from:{...position},to:this.home,at:now};this.home=null;this.clearAt=0;}return position;}
  if(!hit||!inside(cursor,{...position,...size})){this.hitAt=0;return position;}this.hitAt||=now;
  if(now-this.hitAt<1500)return position;const to=destination(position,area,size,cursor);if(!to)return position;
  this.home={...position};this.trip={from:{...position},to,at:now};this.movedAt=now;this.hitAt=0;this.active=true;return position;
 }
}
module.exports={PetAvoidance,destination,inside};
