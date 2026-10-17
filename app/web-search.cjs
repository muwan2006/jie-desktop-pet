'use strict';
const MODES=['auto','required','off'];
function webURL(value){try{if(typeof value!=='string'||value.length>4000)return null;const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return null;return u.href;}catch{return null;}}
function sources(items){const result=[],seen=new Set();for(const item of Array.isArray(items)?items:[]){const url=webURL(item?.url);if(!url||seen.has(url))continue;seen.add(url);result.push({url,title:typeof item.title==='string'?item.title.trim().slice(0,220)||new URL(url).hostname:new URL(url).hostname});if(result.length>=40)break;}return result;}
function searchRequest(mode){return mode==='off'?{}:{tools:[{type:'web_search',user_location:{type:'approximate',country:'CN',timezone:'Asia/Shanghai'}}],tool_choice:mode==='required'?{type:'web_search'}:'auto',include:['web_search_call.action.sources']};}
class SearchTrace{
 constructor(onStatus=()=>{}){this.onStatus=onStatus;this.used=false;this.attempted=false;this.citations=[];this.visited=[];this.calls=new Map();}
 item(item){if(item?.type==='web_search_call'){this.attempted=true;if(item.status==='completed')this.used=true;this.calls.set(item.id||'search',item.status);this.visited.push(...(item.action?.sources||[]));this.onStatus(item.status==='completed'?'搜索完成，正在整理答案……':'正在联网搜索……');}for(const c of item?.content||[])this.citations.push(...(c.annotations||[]).filter(a=>a.type==='url_citation').map(a=>a.url_citation||a));}
 event(e){if(e.type?.startsWith('response.web_search_call.')){this.attempted=true;if(e.type.endsWith('.completed'))this.used=true;this.onStatus(e.type.endsWith('.completed')?'搜索完成，正在整理答案……':'正在联网搜索……');}if(e.item)this.item(e.item);if(e.type==='response.output_text.annotation.added'&&e.annotation?.type==='url_citation')this.citations.push(e.annotation.url_citation||e.annotation);if(e.type==='response.completed')for(const item of e.response?.output||[])this.item(item);}
 result(){return {used:this.used,attempted:this.attempted,citations:sources(this.citations),sources:sources(this.visited)};}
}
module.exports={MODES,webURL,sources,searchRequest,SearchTrace};
