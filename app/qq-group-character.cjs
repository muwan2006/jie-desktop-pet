'use strict';
const C=require('./character.cjs');
function card(value){try{return C.validateCard(value);}catch{return null;}}
function resolve(fallback,identity,preferences={}){return identity?.type==='group'&&card(preferences.characterCard)||fallback;}
function selected(settings,group,fallback=C.DEFAULT_CARD){const custom=card(settings.groupOverrides?.[group]?.characterCard);return {mode:custom?'custom':'default',card:custom||fallback,defaultCard:fallback};}
module.exports={card,resolve,selected};
