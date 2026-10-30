'use strict';
// Ranking changes availability, never the truth status of a source statement.
const DAY=86400000;
function importance(b){return Math.min(10,2+(b.origin==='owner_correction'?5:0)+(b.origin==='source_note'?3:0)+(/记住/.test(b.quote)?3:0)+(b.kind==='preference'?2:0)+(b.kind==='plan'&&b.status==='current'?2:0)+(b.kind==='experience'?1:0));}
function strength(b,now=Date.now()){
 const age=Math.max(0,now-Math.max(b.lastMentionAt||0,b.updated||0,b.at||0))/DAY;
 const repetitions=Math.min(8,Math.max(0,(b.mentions||b.sourceIds?.length||1)-1));
 const halfLife=importance(b)>=7?365:b.kind==='preference'?180:b.kind==='plan'?30:45;
 return Math.max(.03,Math.pow(.5,age/halfLife))*(importance(b)+Math.log2(1+repetitions))*(b.status==='superseded'?.35:1);
}
function describe(b,now=Date.now()){const s=strength(b,now);return {importance:importance(b),strength:Math.round(s*100)/100,familiarity:s>=4?'清晰':s>=1?'一般':'较淡',meaning:'记忆强弱仅表示保留与检索优先度，不表示事实可信度；较淡时回看来源，不补猜细节。'};}
function retain(blocks,limit=1200,now=Date.now()){
 if(blocks.length<=limit)return blocks;
 const kept=new Set(blocks.map(b=>({id:b.id,s:strength(b,now)})).sort((a,b)=>b.s-a.s).slice(0,limit).map(v=>v.id));
 return blocks.filter(b=>kept.has(b.id));
}
module.exports={importance,strength,describe,retain};
