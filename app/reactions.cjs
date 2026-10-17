'use strict';
const expressions=['smile','laugh','shy','surprise','puzzled','serious','sleepy','comfort','idea','relief','typo'];
const gestures=['nod','shake','greet','unroll','roll','ponder','stretch','tail','think','inspect','chin','rub','slow','fast'];
function validateReaction(value){
 if(!value||typeof value!=='object')return null;
 const result={};if(expressions.includes(value.expression))result.expression=value.expression;
 if(gestures.includes(value.gesture))result.gesture=value.gesture;
 return Object.keys(result).length?result:null;
}
function inferReaction(text){
 // Only react to specific cues; neutral replies keep their current pose.
 if(/害羞|不好意思|脸红/.test(text))return {expression:'shy'};
 if(/哈哈|笑出|好好笑/.test(text))return {expression:'laugh'};
 if(/辛苦了|别难过|慢慢来|我陪着你|不用自责/.test(text))return {expression:'comfort'};
 if(/晚安|早点休息|困了/.test(text))return {expression:'sleepy'};
 if(/早上好|早安|晚上好|见到你|欢迎回来/.test(text))return {expression:'smile',gesture:'greet'};
 if(/让我想想|想一想|需要思考/.test(text))return {gesture:'ponder'};
 if(/原来如此|有办法了|想到办法/.test(text))return {expression:'idea'};
 return null;
}
function idsFor(form,reaction){
 const r=validateReaction(reaction);if(!r)return [];
 const map=form==='desk'?{surprise:'idea',serious:'think',comfort:'relief',greet:'nod',unroll:'inspect',roll:'inspect',ponder:'think',shake:'rub',tail:'stretch'}:{idea:'surprise',relief:'smile',typo:'puzzled',think:'ponder',inspect:'serious',chin:'ponder',rub:'stretch',slow:'ponder',fast:'ponder'};
 return [...new Set([r.expression,r.gesture].filter(Boolean).map(id=>map[id]||id))];
}
module.exports={expressions,gestures,validateReaction,inferReaction,idsFor};
