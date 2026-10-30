'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const digest=s=>createHash('sha256').update(s).digest('hex'),valid=/^[\w-]{1,160}$/;
const words=s=>require('./qq-event-memory.cjs').words(s);
const MAX_BYTES=64*1024*1024,MAX_CHUNKS=128,CHUNK_ROWS=256;
function atomic(file,value){const temp=file+'.tmp';let fd;try{fd=fs.openSync(temp,'w');fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,file);}finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temp))fs.unlinkSync(temp);}}
class MemoryArchive{
 constructor(directory){this.root=path.resolve(directory,'jie-qq-conversations','archive');this.cache=new Map();}
 location(key){if(!valid.test(key))throw Error('归档会话标识无效。');return path.join(this.root,digest(key));}
 load(key){const dir=this.location(key);if(this.cache.has(key))return this.cache.get(key);const file=path.join(dir,'index.json');let db={version:1,key,chunks:[],blocked:[]};if(fs.existsSync(file)){const v=JSON.parse(fs.readFileSync(file,'utf8'));if(v.key!==key||!Array.isArray(v.chunks)||!Array.isArray(v.blocked))throw Error('归档会话标识不匹配。');db={...v,chunks:v.chunks.filter(c=>/^[a-f0-9-]+\.json$/.test(c.file)).slice(-MAX_CHUNKS)};}this.cache.set(key,db);return db;}
 commit(key,db){const dir=this.location(key);fs.mkdirSync(dir,{recursive:true});atomic(path.join(dir,'index.json'),db);this.cache.set(key,db);}
 rows(key,entry){const v=JSON.parse(fs.readFileSync(path.join(this.location(key),entry.file),'utf8'));if(v.key!==key||!Array.isArray(v.rows))throw Error('归档分片标识不匹配。');return v.rows;}
 meta(file,rows,bytes){return {file,count:rows.length,bytes,first:rows[0]?.at||0,last:rows.at(-1)?.at||0,terms:[...new Set(rows.flatMap(r=>words(r.text)))].slice(0,8192)};}
 append(key,rows){if(!rows.length)return true;const db=structuredClone(this.load(key)),denied=new Set(db.blocked);rows=rows.filter(r=>r&&typeof r.text==='string'&&r.messageId&&!r.recalled&&!r.contextExcluded&&!denied.has(r.messageId)&&!denied.has(r.replySource));if(!rows.length)return true;
 let last=db.chunks.at(-1),tail=last&&last.count<CHUNK_ROWS?this.rows(key,last):[],existing=new Set(tail.map(r=>r.messageId+'|'+r.role));const incoming=rows.filter(r=>!existing.has(r.messageId+'|'+r.role)).map(r=>({role:r.role,rolePlayed:r.rolePlayed||'',delivery:r.delivery||'',sticker:r.sticker||null,sender:r.sender||'',name:r.name||'',text:r.text.slice(0,3000),at:r.at||0,messageId:r.messageId,replySource:r.replySource||'',topic:r.topic||'',quotedId:r.social?.quoted?.messageId||''}));if(!incoming.length)return true;
 if(tail.length)db.chunks.pop();else last=null;
 const combined=[...tail,...incoming],dir=this.location(key);fs.mkdirSync(dir,{recursive:true});for(let i=0;i<combined.length;i+=CHUNK_ROWS){const chunk=combined.slice(i,i+CHUNK_ROWS),file=i===0&&last?last.file:randomUUID()+'.json',v={version:1,key,rows:chunk};atomic(path.join(dir,file),v);db.chunks.push(this.meta(file,chunk,Buffer.byteLength(JSON.stringify(v))));}
 const expired=[];while(db.chunks.length>MAX_CHUNKS||db.chunks.reduce((n,c)=>n+c.bytes,0)>MAX_BYTES)expired.push(db.chunks.shift());this.commit(key,db);for(const e of expired)fs.rmSync(path.join(dir,e.file),{force:true});return true;
 }
 search(key,text,{sender='',blocked=[],limit=6,budget=4200}={}){const db=this.load(key),tokens=words(text);if(!tokens.length)return [];const denied=new Set([...db.blocked,...blocked]),threshold=/记得|之前|以前|上次|那次/.test(text)?1:2;
 const chunks=db.chunks.map(c=>({c,s:tokens.filter(t=>c.terms.includes(t)).length})).filter(v=>v.s>=threshold).sort((a,b)=>b.s-a.s||b.c.last-a.c.last).slice(0,12),matches=[];
 for(const {c}of chunks)for(const row of this.rows(key,c)){if(denied.has(row.messageId)||denied.has(row.replySource)||sender&&row.role==='user'&&row.sender!==sender)continue;const s=tokens.filter(t=>row.text.toLowerCase().includes(t)).length;if(s>=threshold)matches.push({...row,score:s,historical:true,replyEligible:false,source:'本会话本机归档原文；不是当前待回复消息'});}
 const seen=new Set(),out=[];let used=0;for(const row of matches.sort((a,b)=>b.score-a.score||b.at-a.at)){if(seen.has(row.messageId))continue;const size=JSON.stringify(row).length;if(out.length>=limit||used+size>budget)continue;seen.add(row.messageId);used+=size;out.push(row);}return out;
 }
 forget(key,ids){const db=structuredClone(this.load(key)),denied=new Set([...db.blocked,...ids]);db.blocked=[...denied];this.commit(key,db);const chunks=[];for(const entry of db.chunks){const rows=this.rows(key,entry).filter(r=>!denied.has(r.messageId)&&!denied.has(r.replySource));if(!rows.length){fs.rmSync(path.join(this.location(key),entry.file),{force:true});continue;}const v={version:1,key,rows};atomic(path.join(this.location(key),entry.file),v);chunks.push(this.meta(entry.file,rows,Buffer.byteLength(JSON.stringify(v))));}db.chunks=chunks;this.commit(key,db);}
 clear(key){const dir=this.location(key);if(fs.existsSync(dir)){this.commit(key,{version:1,key,chunks:[],blocked:[]});for(const name of fs.readdirSync(dir))if(/^[a-f0-9-]+\.json$/.test(name))fs.rmSync(path.join(dir,name),{force:true});}this.cache.delete(key);}
 find(key,id){const db=this.load(key);if(db.blocked.includes(id))return null;for(const c of db.chunks.slice().reverse()){const row=this.rows(key,c).find(r=>r.messageId===id);if(row)return row;}return null;}
 stats(key){const db=this.load(key);return {rows:db.chunks.reduce((n,c)=>n+c.count,0),bytes:db.chunks.reduce((n,c)=>n+c.bytes,0),maxBytes:MAX_BYTES,chunks:db.chunks.length};}
}
module.exports={MemoryArchive,MAX_BYTES,MAX_CHUNKS,CHUNK_ROWS};
