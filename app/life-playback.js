(function(root){
 'use strict';
 class LifePlayback{
  constructor(){this.key='';this.elapsed=0;this.last=0;this.level=0;this.beats=0;this.period=.5;this.beatSerial=0;this.correction=0;}
  sample(motion,now,count){
   const name=motion.pose==='sway'?'listen':motion.pose,key=name.startsWith('rps-')?name+':'+motion.started:name;
   if(key!==this.key){this.key=key;this.elapsed=0;this.last=now;this.level=0;this.beats=0;this.period=.5;this.beatSerial=0;this.correction=0;}
   const gap=now-this.last,dt=gap>250||gap<0?0:gap/1000;this.last=now;
   this.level+=(Math.max(0,Math.min(1,motion.level||0))-this.level)*(1-Math.exp(-dt*6));
   const fps=name==='seat'?10:name==='listen'?(motion.pose==='sway'?12:10):name==='write'?1.25:1;
   this.elapsed+=dt*(name==='listen'?.96+.08*this.level:1);
   const music=motion.source==='music'||name==='listen',rhythm=motion.rhythm||{},locked=rhythm.confidence>=.35&&rhythm.period>=280&&rhythm.period<=1300&&rhythm.beatAt<=now&&(now-rhythm.beatAt<rhythm.period*3||rhythm.clockUntil>now);
   if(music){
    const targetPeriod=locked?rhythm.period/1000:.5;this.period+=(targetPeriod-this.period)*(1-Math.exp(-dt*3));
    if(locked&&rhythm.serial!==this.beatSerial){this.beatSerial=rhythm.serial;const elapsed=(now-rhythm.beatAt)/rhythm.period;this.correction=Math.max(-.45,Math.min(.45,Math.round(this.beats-elapsed)+elapsed-this.beats));}
    this.beats+=dt*Math.max(.2,1/this.period+(locked?this.correction*4:0));this.correction*=Math.exp(-dt*4);
   }
   const index=name.startsWith('rps-')?Math.min(count-1,Math.floor(this.elapsed/.14)):music?Math.floor(this.beats*4)%count:Math.floor(this.elapsed*fps)%count;
   const phase=locked?((now-(rhythm.gridAt||rhythm.beatAt)-(motion.syncOffset||0))/rhythm.period%1+1)%1:0;
   const distance=Math.min(phase,1-phase);
   const pulse=locked?Math.exp(-Math.pow(distance/.12,2)):rhythm.audioSource==='spectrum'&&rhythm.beatAt&&now>=rhythm.beatAt&&now-rhythm.beatAt<180?Math.exp(-Math.pow((now-rhythm.beatAt)/75,2)):0;
   return {index,elapsed:this.elapsed,level:this.level,beats:this.beats,period:this.period,locked,phase,pulse};
  }
 }
 if(typeof module==='object'&&module.exports)module.exports={LifePlayback};else root.JieLifePlayback=LifePlayback;
})(typeof globalThis==='object'?globalThis:this);
