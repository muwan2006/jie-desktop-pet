'use strict';
const LINES=[
 {id:'music-steady',kind:'steady',text:'这个拍子挺稳，听着很踏实。'},
 {id:'music-brisk',kind:'brisk',text:'节奏快起来了，脚步也想跟着走。'},
 {id:'music-gentle',kind:'gentle',text:'轻轻的，像一页书慢慢翻过去。'},
 {id:'music-rise',kind:'rise',text:'这一段有劲，我也跟着精神起来了。'},
 {id:'music-fall',kind:'fall',text:'这会儿缓下来，正好松口气。'},
 {id:'music-loose',kind:'loose',text:'这一段的拍子不太整齐，我先慢慢跟着。'},
 {id:'music-return',kind:'return',text:'又接上了，就跟着这一拍走吧。'},
 {id:'music-company',kind:'company',text:'先把手边的事搁一搁，一起听一会儿。'}
];
class MusicComments {
 constructor(){this.activeAt=0;this.lastActive=0;this.lastSpoke=0;this.lastId='';this.history=[];this.count=0;}
 observe(peak,rhythm,now){if(this.history.at(-1)?.at>now-500)return;this.history.push({at:now,peak,bpm:rhythm.bpm,confidence:rhythm.confidence});this.history=this.history.filter(x=>x.at>=now-60000);}
 take({active,allowed,enabled,interval=120,rhythm,peak,now}){
  if(!active){if(this.lastActive&&now-this.lastActive>15000)this.activeAt=0;return null;}
  if(!this.activeAt)this.activeAt=now;this.lastActive=now;if(allowed)this.observe(peak,rhythm,now);
  if(!enabled||!allowed||now-this.activeAt<25000||this.lastSpoke&&now-this.lastSpoke<Math.max(30,interval)*1000)return null;
  const recent=this.history.filter(x=>x.at>now-6000),older=this.history.filter(x=>x.at<now-15000&&x.at>now-30000),avg=a=>a.length?a.reduce((s,x)=>s+x.peak,0)/a.length:0;
  let kind=avg(older)>0&&avg(recent)>avg(older)*1.5?'rise':avg(older)>.04&&avg(recent)<avg(older)*.55?'fall':rhythm.confidence>=.55&&rhythm.bpm>=132?'brisk':peak<.1?'gentle':rhythm.confidence>=.55?'steady':'loose';
  let line=LINES.find(x=>x.kind===kind);if(line.id===this.lastId)line=LINES.find(x=>x.kind==='company');if(line.id===this.lastId)line=LINES.find(x=>x.kind==='return');
  this.lastId=line.id;this.lastSpoke=now;this.count++;return {...line,at:now};
 }
 resetSession(){this.activeAt=0;this.lastActive=0;this.history=[];}
}
module.exports={MusicComments,LINES};
