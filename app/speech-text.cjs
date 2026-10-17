'use strict';
const DOMAIN=String.raw`(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|cn|org|net|gov|edu|io|ai|app|dev|co|me|info|biz|tv|xyz|site)(?:\.[a-z]{2})?`;
const domainLabel=/^(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,63}(?:\/[^\s]*)?$/i;
function spokenText(text,maxChars=6000){
 if(typeof text!=='string')return '';
 let t=text.replace(/\[(?:资料|记忆)\d+\]/g,'').replace(/```[\s\S]*?```/g,'这段代码请看文字。').replace(/!\[[^\]]*\]\([^)]*\)/g,'');
 // Tool citation tokens are display metadata, never spoken words.
 t=t.replace(/[\s\S]*?/g,'').replace(/[^\n]*$/g,'').replace(/[]/g,'')
  .replace(/(?:\[|【)(?:\d+(?:\s*[,，]\s*\d+)*|(?:来源|引用|注|source|citation)\s*\d+|turn\d+(?:search|view|fetch)\d+)(?:\]|】)/gi,'');
 let inSources=false;
 t=t.split('\n').filter(line=>{
  const value=line.replace(/^[ \t]*#{1,6}[ \t]*/,'').replace(/[*_`]/g,'').trim();
  const heading=/^(?:参考来源|引用来源|信息来源|参考资料|来源|sources?|references?|citations?)\s*[:：]?\s*$/i.test(value);
  if(heading){inSources=true;return false;}
  if(inSources&&/^[ \t]*#{1,6}[ \t]+/.test(line))inSources=false;
  if(inSources)return false;
  return !/^(?:参考来源|引用来源|信息来源|参考资料|来源|sources?|references?|citations?)\s*[:：]\s*(?:https?:\/\/|\[[^\]]+\]\(https?:\/\/)/i.test(value);
 }).join('\n');
 // Parenthesized link references can have a human-readable publisher label.
 t=t.replace(/[（(]\s*(?:\[[^\]\n]+\]\(https?:\/\/[^\n]*?\)\s*[,，;；、]?\s*)+[）)]/g,'')
  .replace(/\[([^\]]+)\]\(([^)]*)\)/g,(_match,label,target)=>/^https?:\/\//i.test(target)&&(domainLabel.test(label.trim())||/^(?:\d+|来源\s*\d*|引用\s*\d*)$/.test(label.trim()))?'':label)
  .replace(/https?:\/\/[^\s<>()\[\]{}，。！？；、："'“”‘’]+/gi,'')
  .replace(new RegExp('(^|[^a-z0-9@_-])'+DOMAIN+'(?:/[^\\s<>()\\[\\]{}，。！？；、："“”]*)?(?=$|[^a-z0-9_-])','gi'),'$1')
  .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm,'')
  .replace(/^[ \t]*(?:[-+*•][ \t]+|\d+[.)、][ \t]+|>[ \t]*)/gm,'')
  .replace(/[#*_`~|]/g,'').replace(/[（(]\s*[）)]/g,'')
  .replace(/^[ \t]*[，。！？；：,.!?;:]+[ \t]*/gm,'')
  .replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').replace(/[ \t]{2,}/g,' ').trim();
 if(t.length>maxChars){t=t.slice(0,maxChars);const end=Math.max(t.lastIndexOf('。'),t.lastIndexOf('！'),t.lastIndexOf('？'),t.lastIndexOf('\n'));if(end>=maxChars*.55)t=t.slice(0,end+1);}
 return t;
}
module.exports={spokenText};
