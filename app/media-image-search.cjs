'use strict';
const Net=require('./media-network.cjs'),{clean}=require('./chinese-search.cjs');
function candidates(rows,limit=12){const out=[],seen=new Set();for(const row of rows){try{const image=new URL(row.image),source=new URL(row.source||row.image);if(image.protocol!=='https:'||source.protocol!=='https:'||image.username||image.password||source.username||source.password||seen.has(image.href))continue;seen.add(image.href);out.push({id:'web-'+out.length,image:image.href,source:source.href,title:clean(row.title||'').slice(0,200),...(row.evidence?{evidence:row.evidence}:{})});if(out.length>=limit)break;}catch{}}return out;}
function bing(html){const rows=[];for(const m of html.matchAll(/\bm=(?:"([^"]+)"|'([^']+)')/g))try{const v=JSON.parse(clean(m[1]||m[2]));rows.push({image:v.murl,source:v.purl,title:v.t||v.desc});}catch{}return candidates(rows);}
function baidu(value){return candidates((Array.isArray(value?.data)?value.data:[]).map(v=>({image:v.middleURL||v.thumbURL||v.objURL,source:v.fromURLHost&&v.fromURLHost.startsWith('https:')?v.fromURLHost:v.fromURL||v.middleURL,title:v.fromPageTitleEnc||v.fromPageTitle})));}
function query(value){value=String(value||'').trim().slice(0,160);if(value.length<2||/https?:|[\r\n\0]|\b\d{5,}\b/.test(value))throw Error('请用公开图片主题搜索，不包含账号、群号或私密聊天原文。');return value;}
async function search(text,{fetch,signal,endpoint='',lookup}={}){
 const query=module.exports.query(text);
 if(endpoint){const u=new URL(endpoint);u.searchParams.set('q',query);u.searchParams.set('categories','images');u.searchParams.set('language','zh-CN');u.searchParams.set('format','json');u.searchParams.set('safesearch','2');const r=await Net.get(u.href,{fetch,signal,lookup,local:true});return candidates((JSON.parse(r.bytes).results||[]).map(v=>({image:v.img_src,source:v.url,title:v.title})));}
 const errors=[];
 for(const provider of ['bing','baidu']){try{const url=provider==='bing'?'https://cn.bing.com/images/search?q='+encodeURIComponent(query)+'&form=HDRSC2&adlt=strict':'https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&ie=utf-8&word='+encodeURIComponent(query)+'&pn=0&rn=15';const r=await Net.get(url,{fetch,signal,lookup}),items=provider==='bing'?bing(r.bytes.toString('utf8')):baidu(JSON.parse(r.bytes));if(items.length)return items;}catch(e){if(signal?.aborted)throw e;errors.push(e.message);}}
 throw Error('图片搜索暂未取得可用结果；可能需要验证。可在设置中配置自己的图片搜索服务后重试。');
}
module.exports={search,query,candidates,bing,baidu};
