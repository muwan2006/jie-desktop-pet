'use strict';
const Net=require('./media-network.cjs'),fs=require('node:fs'),path=require('node:path');
const WORKS=[['明日方舟','arknights'],['原神','ys'],['星穹铁道','sr'],['绝区零','zzz']];
function work(query){return /终末地/.test(query)?null:WORKS.find(([name])=>query.includes(name));}
function subject(query){const target=work(query);if(!target)return '';return query.replace(/明日方舟|原神|崩坏[：:]?|星穹铁道|绝区零|官方|角色|高清|原图|立绘|图片|壁纸|照片|精二|精一|精英[一二12阶]|[\s：:]/g,'').replace(/的$/,'').trim();}
async function search(query,{fetch,signal,lookup,cacheDirectory}={}){
 const name=subject(query);if(!name||name.length>30||/[\/|<>:：]/.test(name))return [];
 const target=work(query),ROOT='https://wiki.biligame.com/'+target[1]+'/',key=target[1]+':'+name;
 const file=cacheDirectory?path.join(cacheDirectory,'wiki-image-sources.json'):null;let index={};
 if(file)try{if(fs.statSync(file).size<2*1024*1024)index=JSON.parse(fs.readFileSync(file,'utf8'));const hit=index[key];if(hit&&Date.now()-hit.at<7*86400000&&Array.isArray(hit.rows)&&hit.rows.length)return hit.rows;}catch{}
 // Read public article headings and the image URLs actually present in the page.
 const {clean}=require('./chinese-search.cjs');
 for(const base of [ROOT,...(target[1]==='arknights'?['https://prts.wiki/w/']:[])])try{
  const article=await Net.get(base+encodeURIComponent(name),{fetch,signal,lookup,limit:4*1024*1024});
  const html=article.bytes.toString('utf8'),heading=html.match(/<h1\b[^>]*id=["']firstHeading["'][^>]*>([\s\S]*?)<\/h1>/i),og=html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)/i);
  const canonical=clean(heading?.[1]||og?.[1]||'').replace(/\s*[-–·].*Wiki.*$/i,'').trim();
  if(!canonical||canonical.length>40||/没有|未找到|搜索|页面不存在/.test(canonical))continue;
  let redirected='';try{redirected=JSON.parse('"'+(html.match(/"wgRedirectedFrom"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1]||'')+'"');}catch{}
  if(canonical!==name&&redirected!==name)continue;
  const evidence={kind:'wiki-character-file',requested:name,canonical,aliases:[...new Set([name,canonical])],page:article.url};
  const rows=require('./media-model-search.cjs').pageImages(html,article.url,canonical,100).filter(r=>[name,canonical].some(n=>r.title.includes(n))&&/立绘|skin|portrait|立像|全身/i.test(r.title)&&!/头像|图标|技能|道具|合同|信物|背景/i.test(r.title)).map(r=>({...r,evidence:{...evidence,work:target[0],file:r.title}}));
  if(rows.length){const result=rows.slice(0,6);if(file)try{fs.mkdirSync(cacheDirectory,{recursive:true});index[key]={at:Date.now(),rows:result};const bounded=Object.fromEntries(Object.entries(index).sort((a,b)=>b[1].at-a[1].at).slice(0,100));require('./media-library.cjs').atomic(file,bounded);}catch{}return result;}
 }catch(e){if(signal?.aborted)throw e;}
 return [];
}
module.exports={search,subject};
