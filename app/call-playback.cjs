'use strict';
class CallPlayback{
 constructor({performance,voice,onChange=()=>{}}){Object.assign(this,{performance,voice,onChange});this.queue=[];this.active=false;this.closed=true;this.timer=null;}
 begin(){this.cancel();this.active=true;this.closed=false;this.timer=setInterval(()=>this.pump(),40);this.timer.unref?.();}
 push(text,reaction){if(!this.active)return;this.queue.push({text,reaction});this.pump();}
 end(){this.closed=true;this.pump();}
 pump(){if(!this.active||this.performance.active||this.voice.state!=='idle')return;const next=this.queue.shift();if(next){this.performance.start(next.text,[],next.reaction,{manualVoice:true,fast:next.text.length<=90});this.onChange();}else if(this.closed){this.active=false;clearInterval(this.timer);this.timer=null;this.onChange();}}
 cancel(){this.active=false;this.closed=true;this.queue=[];clearInterval(this.timer);this.timer=null;this.performance.cancel();}
}
module.exports={CallPlayback};
