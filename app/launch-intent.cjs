'use strict';
function normalize(v){return String(v||'').toLowerCase().replace(/[\s，。！？、,.!?“”"'「」《》]/g,'');}
function aliases(v){return (Array.isArray(v)?v:typeof v==='string'?v.split(/[,，、\n]/):[]).filter(s=>typeof s==='string').map(s=>s.trim().slice(0,60)).filter(Boolean).slice(0,10);}
function launchIntent(text,links){
 if(typeof text!=='string'||text.length>160||/[\n;；&|`]/.test(text))return null;
 const match=text.trim().match(/^(?:请|麻烦|帮我|请帮我|能不能帮我|能不能|帮忙)?\s*(?:打开|启动|进入)\s*(.+?)(?:一下|看看|吧|好吗|可以吗)?[。！!？?]*$/);
 if(!match)return null;const query=normalize(match[1]);if(!query||/https?:|[\\/]/.test(query))return null;
 const matches=links.filter(l=>[l.label,...aliases(l.aliases)].some(a=>normalize(a)===query));return matches.length?{matches}:null;
}
module.exports={launchIntent,normalize,aliases};
