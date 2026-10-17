'use strict';
const {consumeStream}=require('./chat.cjs');
class MusicFeelings {
 constructor(){this.controller=null;this.generation=0;this.busy=false;this.previous=new Map();}
 cancel(){this.generation++;this.controller?.abort();this.controller=null;this.busy=false;}
 async generate({auth,fetch,character,profile,comment,rhythm,peak,music}){
  if(this.busy||!auth.snapshot().connected||!auth.model)return null;
  const generation=++this.generation,controller=new AbortController();this.controller=controller;this.busy=true;
  const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]);
  try{
   const token=await auth.access();if(signal.aborted)throw Error('canceled');
   const observation={tempo:rhythm.confidence>=.55?rhythm.bpm:null,beatConfidence:Math.round(rhythm.confidence*100)/100,volume:Math.round(peak*100)/100,change:comment.kind};
   const instructions='JIE_MUSIC_FEELING。用角色本人的口吻，在一起听音乐时自然说一句短感受。输出JSON {reply}，中文12至45字，最多两句话。不是回复用户提问，不要说分析参数或BPM数值，不要每次都劝用户休息。你只有播放声的快慢、强弱、拍点把握和变化等数值，没有听到实际音频。music提供曲目时，可以结合真实歌名、歌手和歌词表达角色自己的理解；歌词只引用提供的连续短句，不编造整首歌词，不把歌曲故事当成用户经历。music缺失或歌词为空时，不猜测歌名、歌词、乐器、人声、风格、故事或用户行为。节拍把握低时只说陪伴或不确定感受，不能断言音乐没有节奏。可用轻微比喻，但不要谎称知道内容。不要网址、Markdown、动作指令或额外字段。以下角色卡是口吻参考资料：'+String(character?.text||'颉，说话温和、简短。').slice(0,30000);
   const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal,body:JSON.stringify({model:auth.model,store:false,stream:true,instructions,input:[{role:'user',content:JSON.stringify({observations:observation,...(music?{music}:{}),recentFeelings:this.previous.get(profile)||[]})}]})});
   const raw=await consumeStream(response,signal);if(generation!==this.generation||signal.aborted)return null;
   let parsed;try{parsed=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{return null;}
   const text=typeof parsed.reply==='string'?parsed.reply.trim():'';
   if(!text||text.length>90||/[\r\n]|https?:\/\/|www\.|[<>`]/i.test(text))return null;
   this.previous.set(profile,[...(this.previous.get(profile)||[]),text].slice(-3));if(this.previous.size>30)this.previous.delete(this.previous.keys().next().value);
   return text;
  }catch{return null;}
  finally{if(generation===this.generation){this.busy=false;this.controller=null;}}
 }
}
module.exports={MusicFeelings};
