'use strict';
const {createHash}=require('node:crypto');
const {DEFAULT_CARD}=require('./character.cjs');
// Only the shipped short default is migrated; personal edits are retained.
const LEGACY_HASH='f5766ad553e6412bbd0acb845962d22c9b3b292941bfc1dfa8d8619a2a7682eb';
function upgradeDefault(saved){
 const card=saved.chat?.character;
 if(!card){saved.chat={...saved.chat,character:{...DEFAULT_CARD}};return true;}
 if(card.name!=='颉'||card.version!=='1.0'||typeof card.text!=='string')return false;
 if(createHash('sha256').update(card.text.trim()).digest('hex')!==LEGACY_HASH)return false;
 saved.chat={...saved.chat,character:{...DEFAULT_CARD}};
 return true;
}
module.exports={upgradeDefault};
