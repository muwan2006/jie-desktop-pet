'use strict';
// Select exact card passages; never fabricate a summarized personality.
function persona(card,query='',budget=6500){
 const text=String(card?.text||''),parts=text.split(/\n\s*\n/).map((text,index)=>({text,index})),terms=[...new Set((String(query).match(/[\u3400-\u9fff]{2,}|[a-z]{3,}/gi)||[]).flatMap(t=>t.length>2?Array.from({length:t.length-1},(_,i)=>t.slice(i,i+2)):[t]))];
 for(const p of parts)p.score=(p.index<5?100:0)+(/性格|说话|语气|口吻|幽默|桌宠互动|相处|总纲|称呼|现代汉语|日常回应|不要.*古风|游戏陪玩/.test(p.text)?30:0)+terms.reduce((n,t)=>n+(p.text.includes(t)?4:0),0);
 const chosen=[];let size=0;
 for(const p of [...parts].sort((a,b)=>b.score-a.score||a.index-b.index)){if(p.score<=0&&size>budget*.65)break;if(size+p.text.length>budget)continue;chosen.push(p);size+=p.text.length;}
 return {name:card?.name||'颉',version:card?.version||'',text:chosen.sort((a,b)=>a.index-b.index).map(p=>p.text).join('\n\n'),sourceCharacters:text.length,selectedCharacters:size};
}
function sceneContext(context){if(!context)return null;return {preferences:context.preferences,mode:context.mode,observations:(context.observations||[]).slice(-4).map(o=>({text:String(o.text||'').slice(0,220),at:o.at})),comments:(context.comments||[]).slice(-4)};}
module.exports={persona,sceneContext};
