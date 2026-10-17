'use strict';
const fs=require('node:fs'),path=require('node:path');
const MAX_TEXT=30000,MAX_FILE_BYTES=256000;
const DEFAULT_CARD=Object.freeze({format:'jie-character-card',format_version:1,name:'颉',version:'1.0',text:fs.readFileSync(path.join(__dirname,'jie-character-card.txt'),'utf8').trim()});
function validateCard(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('角色卡格式不正确。');
 if(value.format!==undefined&&value.format!=='jie-character-card')throw Error('此 JSON 不是颉桌宠角色卡；可将角色正文另存为 TXT 后导入。');
 if(value.format_version!==undefined&&value.format_version!==1)throw Error('此角色卡格式版本暂不支持。');
 for(const [key,max] of [['name',80],['version',40],['text',MAX_TEXT]]){
  if(typeof value[key]!=='string'||!value[key].trim())throw Error('请填写角色名称、版本和正文。');
  if(value[key].trim().length>max)throw Error(key==='text'?'角色正文最多 30000 字，请缩短后保存。':'角色名称或版本过长。');
 }
 return {format:'jie-character-card',format_version:1,name:value.name.trim(),version:value.version.trim(),text:value.text.trim()};
}
function parseCard(raw,extension){
 if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>MAX_FILE_BYTES)throw Error('角色卡文件过大。');
 raw=raw.replace(/^\uFEFF/,'');
 if(extension.toLowerCase()==='.json'){
  let value;try{value=JSON.parse(raw);}catch{throw Error('JSON 格式不正确，请检查文件。');}return validateCard(value);
 }
 if(!['.txt','.md'].includes(extension.toLowerCase()))throw Error('请选择 UTF-8 编码的 TXT、MD 或颉桌宠 JSON 角色卡。');
 return validateCard({...DEFAULT_CARD,text:raw});
}
function serializeCard(card,extension){card=validateCard(card);return extension.toLowerCase()==='.json'?JSON.stringify(card,null,2)+'\n':card.text+'\n';}
module.exports={DEFAULT_CARD,MAX_TEXT,MAX_FILE_BYTES,validateCard,parseCard,serializeCard};
