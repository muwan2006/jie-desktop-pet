'use strict';
(function(root){
 const clamp=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
 function curve(incoming){return Float32Array.from({length:65},(_,i)=>incoming?Math.sin(i/64*Math.PI/2):Math.cos(i/64*Math.PI/2));}
 function overlap(duration){return Math.min(4,duration/4);}
 class AmbientPlayback{
  constructor(context,buffers,random=Math.random){this.context=context;this.buffers=buffers;this.random=random;this.master=context.createGain();this.master.gain.value=0;this.master.connect(context.destination);this.channels={};for(const k of ['rain','wind','pages']){const g=context.createGain();g.gain.value=0;g.connect(this.master);this.channels[k]=g;}this.sources=new Set();this.next={};this.active=false;this.targets={};this.loops=0;}
  source(kind,start,fade=0,first=false){const c=this.context,b=this.buffers[kind],s=c.createBufferSource(),g=c.createGain();s.buffer=b;s.connect(g);g.connect(this.channels[kind]);if(kind==='pages')g.gain.value=.8+this.random()*.2;else{g.gain.setValueAtTime(first?1:0,start);if(!first)g.gain.setValueCurveAtTime(curve(true),start,fade);g.gain.setValueAtTime(1,start+b.duration-fade);g.gain.setValueCurveAtTime(curve(false),start+b.duration-fade,fade);}s.onended=()=>{this.sources.delete(s);s.disconnect();g.disconnect();};this.sources.add(s);s.start(start);s.stop(start+b.duration);if(kind!=='pages')this.loops++;}
  start(){if(this.active)return;this.active=true;const now=this.context.currentTime+.06;for(const k of ['rain','wind']){const d=this.buffers[k].duration,f=overlap(d);this.source(k,now,f,true);this.next[k]=now+d-f;}this.next.pages=now+12+this.random()*16;}
  pump(){if(!this.active)return;const now=this.context.currentTime;for(const k of ['rain','wind']){const d=this.buffers[k].duration,f=overlap(d);if(this.next[k]<now)this.next[k]=now+.03;while(this.next[k]<now+2){this.source(k,this.next[k],f);this.next[k]+=d-f;}}if(this.next.pages<=now+.1){if(this.targets.pages>0)this.source('pages',Math.max(now+.02,this.next.pages));this.next.pages=now+12+this.random()*18;}}
  update(v){const now=this.context.currentTime,m=v.mix||{};this.targets.master=v.playing?clamp(m.volume)*(v.ducked?.18:1):0;this.master.gain.setTargetAtTime(this.targets.master,now,.15);for(const k of ['rain','wind','pages']){this.targets[k]=clamp(m[k]);this.channels[k].gain.setTargetAtTime(this.targets[k],now,.12);}}
  stop(){this.active=false;for(const s of this.sources){try{s.stop();}catch{}s.disconnect();}this.sources.clear();this.next={};}
 }
 const api={AmbientPlayback,curve,overlap,clamp};if(typeof module==='object')module.exports=api;else root.JieAmbient=api;
})(globalThis);
