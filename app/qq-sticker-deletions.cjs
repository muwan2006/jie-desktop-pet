'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
function key(scope){if(typeof scope!=='string'||!/^[\w-]{1,160}$/.test(scope))return '';const m=/^[a-f0-9]{16}-(\d{5,15}-[gp]-\d{5,15})$/.exec(scope);return m?m[1]:'legacy:'+scope;}
class BuiltinDeletions{
 constructor(root){this.file=path.join(root,'builtin-deletions.json');this.scopes=Object.create(null);this.revision=0;try{if(fs.statSync(this.file).size>4000000)throw Error();const v=JSON.parse(fs.readFileSync(this.file,'utf8'));for(const [k,ids]of Object.entries(v.scopes||{}).slice(0,2000))if(/^(?:\d{5,15}-[gp]-\d{5,15}|legacy:[\w-]{1,160})$/.test(k)&&Array.isArray(ids))this.scopes[k]=[...new Set(ids.filter(id=>typeof id==='string'&&/^pet-[a-z-]+$/.test(id)))].slice(0,100);}catch{}}
 has(scope,id){return (this.scopes[key(scope)]||[]).includes(id);}
 update(scope,ids){const k=key(scope);if(!k)return false;const next={...this.scopes};if(ids.length)next[k]=[...new Set(ids)];else delete next[k];if(JSON.stringify(next)===JSON.stringify(this.scopes))return true;if(Object.keys(next).length>2000)throw Error('表情包会话配置已达上限，请先整理不用的会话。');fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify({version:1,scopes:next}),{flag:'wx'});fs.renameSync(tmp,this.file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}this.scopes=next;this.revision++;return true;}
 remove(scope,id){return this.update(scope,[...(this.scopes[key(scope)]||[]),id]);}
 removeAll(scope,ids){return this.update(scope,[...(this.scopes[key(scope)]||[]),...ids]);}
 restore(scope){return this.update(scope,[]);}
}
module.exports={BuiltinDeletions,key};
