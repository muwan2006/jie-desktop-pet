'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const median=a=>{const s=a.slice().sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
class MusicRhythm{
 constructor(){this.reset();}
 reset(){this.last=0;this.prev=0;this.baseline=0;this.beatAt=0;this.serial=0;this.intervals=[];this.period=0;this.confidence=0;this.strength=0;this.features=[];this.before=null;this.candidate=null;this.gridAt=0;this.audioSource='level';this.onsets=[];this.clockUntil=0;}
 updateFeatures(features,received=Date.now()){
  this.audioSource='spectrum';
  for(const f of features.slice(-64)){
   if(![f.at,f.low,f.mid,f.high,f.energy,f.peak].every(Number.isFinite)||Math.abs(f.at-received)>1500)continue;
   if(this.last&&f.at<=this.last)continue;
   if(this.last&&f.at-this.last>1500){this.reset();this.audioSource='spectrum';}
   this.last=f.at;
   const p=this.candidate,b=this.before;
   const history=this.features.filter(x=>x.at>f.at-1600),mean=history.length?history.reduce((n,x)=>n+x.low,0)/history.length:0;
   const floor=Math.max(.0008,mean*2.4);
   const midMean=history.length?history.reduce((n,x)=>n+x.mid,0)/history.length:0;
   const bass=p&&b&&p.low>b.low&&p.low>=f.low&&p.low>floor;
   // Kick and snare may alternate on consecutive beats; reject bright offbeat hats.
   const snare=p&&b&&p.mid>b.mid&&p.mid>=f.mid&&p.mid>Math.max(.004,midMean*3,p.energy*.5)&&p.mid>p.high*.7;
   if(p&&p.energy>.001&&(bass||snare))this.acceptOnset(p.at,clamp((bass?p.low:p.mid)/Math.max(floor,.015),0,1));
   this.before=p;this.candidate=f;this.features=[...history,f];
  }
  if(this.beatAt&&received>this.clockUntil&&received-this.beatAt>Math.max(2500,this.period*4)){this.period=0;this.confidence=0;this.intervals=[];}
  return this.snapshot(received);
 }
 holdClock(now){this.clockUntil=now+1800;}
 resumeClock(now){this.last=now;this.before=null;this.candidate=null;this.features=[];this.onsets=[];this.holdClock(now);}
 acceptOnset(at,strength){
  const rawPrevious=this.onsets.at(-1),rawGap=rawPrevious?at-rawPrevious.at:0;
  if(rawPrevious&&rawGap<220)return;
  this.onsets.push({at,strength});this.onsets=this.onsets.filter(x=>x.at>at-8000).slice(-24);
  const gaps=this.onsets.slice(1).map((v,i)=>v.at-this.onsets[i].at).filter(v=>v>=280&&v<=1300);
  const latest=gaps.slice(-3),proposal=latest.length===3?median(latest):0;
  const consistent=proposal&&latest.every(v=>Math.abs(v-proposal)<proposal*.09);
  const changing=consistent&&this.period&&Math.abs(proposal-this.period)>this.period*.11;
  if(changing){this.period=proposal;this.intervals=latest.slice();this.gridAt=at;this.confidence=.65;}
  const interval=this.beatAt?at-this.beatAt:0;
  if(this.beatAt&&interval<220)return;
  if(this.period&&this.confidence>=.5&&!changing&&interval<1500){const cycles=Math.round(interval/this.period);if(cycles<1||Math.abs(interval-cycles*this.period)>this.period*.22)return;}
  if(!changing&&interval>=280&&(interval<=1500||at<this.clockUntil)){
   const normalized=this.period&&this.confidence>=.5?interval/Math.max(1,Math.round(interval/this.period)):interval;
   this.intervals.push(normalized);this.intervals=this.intervals.slice(-8);
  }else if(!changing&&interval>1500){this.intervals=[];this.period=0;this.confidence=0;}
  this.beatAt=at;this.serial++;this.strength=strength;
  if(this.intervals.length>=3){const p=median(this.intervals.slice(-5)),mad=median(this.intervals.map(v=>Math.abs(v-p)))/p;this.period=this.period?this.period*.6+p*.4:p;this.confidence=clamp((this.intervals.length-1)/4,0,1)*clamp(1-mad/.15,0,1);}
  if(changing)this.confidence=Math.max(this.confidence,.65);
  if(this.period){const predicted=this.gridAt?this.gridAt+Math.round((at-this.gridAt)/this.period)*this.period:at;this.gridAt=predicted+clamp(at-predicted,-60,60)*.65;}else this.gridAt=at;
 }
 update(peak,now,threshold=.025){
  peak=Number.isFinite(peak)?clamp(peak,0,1):0;
  if(!Number.isFinite(now))return this.snapshot(0);
  const gap=this.last?now-this.last:20;
  if(gap<0||gap>1500)this.reset();
  const dt=clamp(gap,1,200)/1000,previous=this.prev,base=this.baseline;this.last=now;
  this.baseline+=(peak-this.baseline)*(1-Math.exp(-dt/.45));this.prev=peak;
  const rise=peak-previous,excess=peak-base,minimum=Math.max(.006,threshold*.4);
  if(peak>=threshold&&rise>=minimum&&excess>=Math.max(minimum,base*.24)&&(!this.beatAt||now-this.beatAt>=230)){
   const interval=this.beatAt?now-this.beatAt:0;
   if(interval>=280&&interval<=1300){this.intervals.push(interval);this.intervals=this.intervals.slice(-8);}
   else if(interval>1300){this.intervals=[];this.period=0;this.confidence=0;}
   this.beatAt=now;this.serial++;this.strength=clamp(excess/Math.max(.08,base),0,1);
   if(this.intervals.length>=3){const p=median(this.intervals),mad=median(this.intervals.map(v=>Math.abs(v-p)))/p;this.period=p;this.confidence=clamp((this.intervals.length-2)/4,0,1)*clamp(1-mad/.18,0,1);}
  }
  if(this.beatAt&&now-this.beatAt>Math.max(2500,this.period*4)){this.confidence=0;this.period=0;this.intervals=[];}
  return this.snapshot(now);
 }
 snapshot(now){return {beatAt:this.beatAt,gridAt:this.gridAt||this.beatAt,serial:this.serial,period:this.period,confidence:this.confidence,strength:this.strength,bpm:this.period?Math.round(60000/this.period):0,age:this.beatAt?Math.max(0,now-this.beatAt):0,audioSource:this.audioSource,clockUntil:this.clockUntil};}
}
module.exports={MusicRhythm};
