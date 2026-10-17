'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),S=require('./qq-state.cjs');
const LIMIT=10000,MAX_BYTES=30*1024*1024,KEY=/^[\w-]{1,160}$/;
class GroupStore{
 constructor(directory){this.root=path.resolve(directory,'jie-qq-conversations','groups');this.cache=new Map();this.blocked=new Set();this.errors=[];}
 file(key){if(!KEY.test(key))throw Error('群记录标识无效。');return path.join(this.root,createHash('sha256').update(key).digest('hex')+'.json');}
 read(file){if(fs.statSync(file).size>MAX_BYTES)throw Error('群记录文件过大。');const v=JSON.parse(fs.readFileSync(file,'utf8'));if(!KEY.test(v.key)||path.basename(this.file(v.key))!==path.basename(file).replace(/\.bak$/,''))throw Error('群记录标识不匹配。');if(v.deleted===true)return v;const c=S.restore({sessions:{[v.key]:v.conversation}},LIMIT,1)[v.key];if(c?.type!=='group')throw Error('群记录格式无效。');return {key:v.key,conversation:c};}
 load(legacy={},preferLegacy=false){
  const sessions=Object.create(null);
  if(fs.existsSync(this.root))for(const name of fs.readdirSync(this.root).filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){const file=path.join(this.root,name);let v;try{v=this.read(file);}catch{try{v=this.read(file+'.bak');this.errors.push('一份群记录已从备份恢复。');}catch{this.blocked.add(file);this.errors.push('一份群记录无法读取，原文件已保留。');continue;}}
   if(!v.deleted)sessions[v.key]=v.conversation;
   this.cache.set(v.key,v.deleted?null:JSON.stringify(v.conversation));
  }
  // Existing per-group files (including deletion markers) take precedence over
  // old global settings, so restart cannot resurrect cleared conversations.
  for(const [key,c]of Object.entries(legacy))if(KEY.test(key)&&c?.type==='group'&&this.cache.get(key)!==null&&(preferLegacy||!this.cache.has(key)&&(!fs.existsSync(this.file(key))||this.blocked.has(this.file(key))))){const clean=S.restore({sessions:{[key]:c}},LIMIT,1)[key];if(clean)sessions[key]=clean;}
  this.flush(sessions);return sessions;
 }
 write(key,value){const file=this.file(key);if(this.blocked.has(file))throw Error('群记录损坏，已保留原文件；请先导出或修复。');fs.mkdirSync(this.root,{recursive:true});const tmp=file+'.tmp';let fd;try{fd=fs.openSync(tmp,'w');fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;if(fs.existsSync(file)){try{this.read(file);fs.copyFileSync(file,file+'.bak');}catch{ /* Keep the verified recovery backup. */ }}fs.renameSync(tmp,file);if(!fs.existsSync(file+'.bak'))fs.copyFileSync(file,file+'.bak');}finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
 flush(sessions){let ok=true;for(const [key,c]of Object.entries(sessions)){if(c.type!=='group')continue;try{let value=JSON.stringify(c);if(value===this.cache.get(key))continue;const envelope=()=>JSON.stringify({version:1,key,conversation:c});while(Buffer.byteLength(envelope())>MAX_BYTES&&c.history.length)c.history=c.history.slice(Math.max(1,Math.floor(c.history.length/10)));value=JSON.stringify(c);this.write(key,{version:1,key,conversation:c});this.cache.set(key,value);}catch{ok=false;this.errors.push('群记录保存失败，请检查磁盘空间和文件权限；记录仍留在总设置中。');}}this.errors=[...new Set(this.errors)].slice(-3);return ok;}
 clear(key){const value={version:1,key,deleted:true};this.write(key,value);fs.copyFileSync(this.file(key),this.file(key)+'.bak');this.cache.set(key,null);}
}
module.exports={GroupStore,LIMIT};
