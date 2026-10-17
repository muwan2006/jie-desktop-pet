'use strict';
(()=>{
 function requested(text){
  const s=typeof text==='string'?text:'';
  const wants=/(?:给|发|提供|附|贴|列|带|显示|保留|要|求|求个|求一下|有没有|哪里有|哪儿有|找).{0,10}(?:链接|网址|URL|来源地址)|(?:链接|网址|URL).{0,8}(?:给我|发我|发来|是什么|在哪|呢|来一个)|^(?:链接|网址|URL|来源链接)[！!。.?？\s]*$|(?:source\s+links?|give|send|include|show|provide).{0,20}(?:links?|urls?)/i;
  const without=s.replace(/(?:不要|不用|无需|不需要|别|不必|不想要|禁止).{0,6}(?:给|发|附|显示|提供|贴|带|保留)?\s*(?:来源)?(?:链接|网址|URL)/gi,'');
  return wants.test(without);
 }
 function clean(text){
  return String(text||'').replace(/\n\s*(?:来源|参考来源|参考链接|引用来源|Sources?)\s*[:：][\s\S]*$/i,'')
   .replace(/[\s\S]*?/g,'').replace(/[^\n]*$/g,'').replace(/[]/g,'')
   .replace(/\[([^\]\n]*)\]\(\s*https?:\/\/[^\s)]*(?:\s+"[^"]*")?\s*\)/gi,(m,label)=>/^(?:\d+|来源|参考|链接|source|[^\s]+\.(?:com|cn|net|org|wiki)(?:\/\S*)?)$/i.test(label)?'':label)
   .replace(/\[([^\]\n]+)\]\[[^\]\n]*\]/g,'$1')
   .replace(/^\s*\[[^\]\n]+\]:\s*https?:\/\/\S+.*$/gm,'')
   .replace(/[（(]\s*(?:https?:\/\/|www\.)[^\s)）]+\s*[)）]/gi,'')
   .replace(/(?:https?:\/\/|www\.)[^\s<>）)\]，。；！？]+/gi,'')
   .replace(/[（(]\s*(?:[a-z\d-]+\.)+(?:com|cn|org|net|wiki|io|gov|edu)(?:\/[\w./?=&%-]*)?\s*[)）]/gi,'')
   .replace(/\[\d+(?:[,，-]\d+)*\]/g,'').replace(/[（(]\s*[)）]/g,'')
   .replace(/[ \t]+([，。；！？])/g,'$1').replace(/\n[ \t]*\n(?:[ \t]*\n)+/g,'\n\n').trim();
 }
 function visible(text,enabled=false){return enabled===true||requested(text);}
 function guidance(show){return show?'用户要求或设置开启了来源链接。正文自然回答，不编造网址；来源由程序使用本轮真实检索结果展示。':'默认不展示任何联网来源链接、网址、域名括号或引用符号。回复只说结论与必要的不确定性，不贴来源列表；不能因隐藏链接而降低核实要求。仅用户这条明确索要链接时才提供真实来源。';}
 const api={requested,clean,visible,guidance};if(typeof module!=='undefined'&&module.exports)module.exports=api;else globalThis.JieReplyLinks=api;
})();
