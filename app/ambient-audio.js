'use strict';
// Bundled licensed recordings only. No microphones or network services.
(()=>{
 let context,player,loading,last,timer,stopTimer,revision=0;const stats={playing:false,ducked:false,targets:{},created:0,source:'recordings'};
 async function create(){
  if(!loading)loading=(async()=>{context=new AudioContext();await context.suspend();const entries=await Promise.all(['rain','wind','pages'].map(async k=>{const r=await fetch('assets/ambient/'+k+'.ogg');if(!r.ok)throw Error('Missing ambient asset');const b=await context.decodeAudioData(await r.arrayBuffer());if(b.duration<.1||b.numberOfChannels!==2)throw Error('Invalid ambient asset');return [k,b];}));player=new window.JieAmbient.AmbientPlayback(context,Object.fromEntries(entries));stats.created++;})();
  try{await loading;}catch(e){loading=null;player=null;await context?.close();context=null;throw e;}
 }
 async function update(v){last=v;const token=++revision;clearTimeout(stopTimer);stats.playing=!!v.playing;stats.ducked=!!v.ducked;
  try{if(v.playing){await create();if(token!==revision||!last.playing)return;await context.resume();if(token!==revision||!last.playing)return;player.start();player.update(last);if(!timer)timer=setInterval(()=>player.pump(),250);}else if(player){player.update(v);stopTimer=setTimeout(async()=>{if(token!==revision||last?.playing)return;clearInterval(timer);timer=null;player.stop();await context.suspend();},750);}stats.targets=player?{...player.targets}:{master:0};}
  catch{if(token===revision){stats.playing=false;await window.jie.leisure('ambient-error');}}
 }
 window.jie.onAmbient(update);window.ambientDiagnostics=()=>({...stats,targets:player?{...player.targets}:stats.targets,contextState:context?.state||'none',sampleRate:context?.sampleRate||0,buffersLoaded:!!player,durations:player?Object.fromEntries(Object.entries(player.buffers).map(([k,b])=>[k,b.duration])):{},scheduledSources:player?.sources.size||0,loops:player?.loops||0});
 window.addEventListener('beforeunload',()=>{revision++;clearTimeout(stopTimer);clearInterval(timer);player?.stop();void context?.close();});
})();
