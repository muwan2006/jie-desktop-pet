'use strict';
const {spokenText}=require('./voice.cjs');
const {validateReaction,inferReaction}=require('./reactions.cjs');
const {findPreset}=require('./utterances.cjs');
function validateCues(reply,input){
 if(!Array.isArray(input))return [];
 const result=[];let after=0;
 for(const cue of input.slice(0,24)){
  if(typeof cue?.quote!=='string'||!cue.quote.trim()||cue.quote.length>160)continue;
  const quote=cue.quote.trim(),at=reply.indexOf(quote,after),reaction=validateReaction(cue.reaction||cue);
  if(at<0||!reaction)continue;result.push({quote,reaction});after=at+quote.length;
 }return result;
}
function splitSpeech(reply,maxChars=6000){
 const text=spokenText(reply.replace(/\[(?:资料|记忆)\d+\]/g,''),maxChars),segments=[];

 // Sentence boundaries determine actual audio clips, not guessed speech timestamps.
 const parts=text.match(/[^。！？!?\n]+[。！？!?\n]*|[。！？!?\n]+/g)||[];
 let offset=0;
 for(const part of parts){let remaining=part;
  while(remaining.length){let end=Math.min(160,remaining.length);
   if(end<remaining.length){const prefix=remaining.slice(0,end),boundary=Math.max(prefix.lastIndexOf('，'),prefix.lastIndexOf('；'),prefix.lastIndexOf(','),prefix.lastIndexOf(' '));if(boundary>=50)end=boundary+1;}
   const raw=remaining.slice(0,end),value=raw.trim();if(value)segments.push({text:value,start:offset,end:offset+raw.length,reaction:null});offset+=raw.length;remaining=remaining.slice(end);
  }
 }
 return segments;
}
function validateBeats(reply,input){
 if(!Array.isArray(input))return [];
 const count=splitSpeech(reply).length,result=[],seen=new Set();
 for(const beat of input.slice(0,120)){
  if(!Number.isInteger(beat?.index)||beat.index<0||beat.index>=count||seen.has(beat.index))continue;
  const reaction=validateReaction(beat.reaction);if(beat.reaction!==null&&!reaction)continue;
  seen.add(beat.index);result.push({index:beat.index,reaction});
 }return result.sort((a,b)=>a.index-b.index);
}
function cueBeats(reply,cues){
 const text=spokenText(reply,6000),segments=splitSpeech(reply),result=new Map();let after=0;
 for(const cue of validateCues(reply,cues)){
  const quote=spokenText(cue.quote,6000),at=text.indexOf(quote,after);if(!quote||at<0)continue;
  const index=segments.findIndex(s=>s.start<=at&&at<s.end);if(index>=0)result.set(index,{index,reaction:cue.reaction});after=at+quote.length;
 }return [...result.values()];
}
function needsAnalysis(reply,cues,beats){
 const count=splitSpeech(reply).length;
 return (count>1||reply.length>=35)&&validateBeats(reply,beats).length<count&&cueBeats(reply,cues).length<count;
}
function segmentsFor(reply,cues=[],overall=null,maxChars=6000,beats=[]){
 const text=spokenText(reply.replace(/\[(?:资料|记忆)\d+\]/g,''),maxChars),valid=validateCues(reply,cues),preset=findPreset(text),tagged=validateBeats(reply,beats);
 if(preset&&valid.length<=1&&!tagged.length)return [{text,start:0,end:text.length,reaction:valid[0]?.reaction||validateReaction(overall)||{expression:preset.expression}}];
 const segments=splitSpeech(reply,maxChars);
 let after=0;
 for(const cue of valid){const quote=spokenText(cue.quote,6000),at=text.indexOf(quote,after);if(!quote||at<0)continue;
  const segment=segments.find(s=>s.start<=at&&at<s.end);if(segment)segment.reaction=cue.reaction;after=at+quote.length;
 }
 for(let i=0;i<segments.length;i++)if(!segments[i].reaction)segments[i].reaction=inferReaction(segments[i].text)||(i===0?validateReaction(overall):null);
 for(const beat of tagged)if(segments[beat.index])segments[beat.index].reaction=beat.reaction;
 return segments;
}
class ReplyPerformance {
 constructor(engine,voice,hooks={}){this.engine=engine;this.voice=voice;this.hooks=hooks;this.version=0;this.timer=null;this.active=false;}
 cancel(stopVoice=true){this.version++;clearTimeout(this.timer);this.timer=null;const wasActive=this.active;this.active=false;this.engine.clearFeeling();this.lastExpression=null;this.engine.performance=null;this.engine.performanceActive=false;
  if(this.engine.emote?.source==='chat')this.engine.emote=null;
  if(this.engine.reactionQueueSource==='chat')this.engine.reactionQueue=[];
  if(stopVoice&&wasActive)this.voice.stop();this.hooks.onChange?.();
 }
 beat(segment,index,total,mode){this.engine.performanceActive=true;this.engine.performance={mode,index:index+1,total,text:segment.text,reaction:segment.reaction};
  if(this.engine.emote?.source==='chat')this.engine.emote=null;
  if(this.engine.reactionQueueSource==='chat')this.engine.reactionQueue=[];
  this.engine.say(segment.text.slice(0,120),Date.now(),Math.max(9000,segment.text.length*280),'chat');
  if(segment.reaction?.expression)this.lastExpression=segment.reaction.expression;
  this.engine.react(segment.reaction,Date.now(),'chat');this.hooks.onBeat?.(segment,index,mode);this.hooks.onChange?.();
 }
 start(reply,cues=[],overall=null,{manualVoice=false,beats=[],fast=false}={}){
  this.cancel();const version=this.version,engine=this.engine,voice=this.voice;
  const voiced=voice.settings.enabled&&(voice.settings.autoChat||manualVoice);
  if(!engine.settings.contextEmotes){engine.say(reply.slice(0,120),Date.now(),15000,'chat');if(voiced)void voice.speak(reply,{manual:true});return;}
  const segments=fast&&spokenText(reply,90)?[{text:spokenText(reply,90),reaction:validateReaction(overall)||inferReaction(reply),start:0,end:reply.length}]:segmentsFor(reply,cues,overall,voiced?voice.settings.maxChars:6000,beats);if(!segments.length)return;
  this.active=true;engine.performanceActive=true;this.hooks.onChange?.();
  const finish=()=>{if(version!==this.version)return;const expression=this.lastExpression;this.cancel(false);this.engine.holdEmotion(expression);this.hooks.onChange?.();};
  const readFrom=(start,source=segments)=>{let index=start;const advance=()=>{
   if(version!==this.version)return;if(index>=source.length){finish();return;}
   const segment=source[index];this.beat(segment,index,source.length,'reading');index++;
   this.timer=setTimeout(advance,fast?Math.min(6500,Math.max(1600,segment.text.length*140)):Math.min(14000,Math.max(2200,segment.text.length*220)));this.timer.unref?.();
  };advance();};
  if(!voiced){readFrom(0);return;}
  let started=-1;if(fast)this.beat(segments[0],0,segments.length,'preparing');
  for(const segment of segments)segment.voiceTone=this.hooks.voiceTone?.(segment)||null;
  void voice.speakSegments(segments,{onSegment:(segment,index)=>{if(version!==this.version)return;started=index;this.beat(segment,index,segments.length,'voice');},onFinish:reason=>{
   if(version!==this.version)return;
   if(reason==='error'){readFrom(Math.max(0,started+1));}else if(reason==='ended')finish();else this.cancel(false);
  }});
 }
}
module.exports={validateCues,validateBeats,splitSpeech,cueBeats,needsAnalysis,segmentsFor,ReplyPerformance};
