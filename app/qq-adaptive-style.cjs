'use strict';
const Style=require('./conversation-style.cjs');
function plan(settings={},m={}){const limit=m.type==='group'?(settings.groupSentenceLimit||3):(settings.privateSentenceLimit||5);if(settings.adaptiveReplies===false)return {enabled:false};const scene=Style.scene(m.text,m);return {enabled:true,scene,sentences:scene==='explain'?0:Math.max(1,Math.min(8,scene==='casual'?Math.min(2,limit):limit))};}
function guidance(s,m){const p=plan(s,m);if(!p.enabled)return '';return (p.scene==='explain'?'本轮确有展开或成果内容要求，按问题需要说明清楚，不套闲聊句数。':p.scene==='casual'?'本轮有闲聊或情绪表达的信号，结合上下文判断是否是在打趣、分享或吐槽；通常接一两句，不解释笑点，不擅自开出建议清单。':'本轮先给直接回应，需要理由时说清要点，不因出现问号或“为什么”就自动写成长篇。')+(p.sentences?'用户的短回复目标约'+p.sentences+'句。':'')+'句数是自然表达目标，不靠截断半句话或删掉必要事实达标。';}
module.exports={plan,guidance};
