'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const MAX_COUNT=200,MAX_BYTES=100*1024*1024,MAX_FILE=10*1024*1024;
const trim=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
// Model connections scope conversation memory, but favorites belong to the QQ
// account and original conversation. Keep legacy IDs and files unchanged.
function conversationScope(scope){const m=typeof scope==='string'&&/^[a-f0-9]{16}-(\d{5,15})-([gp])-(\d{5,15})$/.exec(scope);return m?m.slice(1).join('-'):null;}
function sameScope(a,b){if(a===b)return true;const key=conversationScope(a);return key!==null&&key===conversationScope(b);}
const imageId=(scope,bytes)=>createHash('sha256').update(scope).update(bytes).digest('hex');
function format(bytes){if(!Buffer.isBuffer(bytes))return '';if(bytes.subarray(0,6).toString().match(/^GIF8[79]a$/))return 'gif';if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpeg';if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'webp';return '';}
class StickerLibrary{
 constructor({directory,builtinRoot=path.join(__dirname,'assets/qq-stickers')}){
  this.root=path.join(directory,'jie-qq-stickers');this.file=path.join(this.root,'index.json');this.builtinRoot=builtinRoot;this.items=[];this.builtin=[];
  try{this.builtin=JSON.parse(fs.readFileSync(path.join(builtinRoot,'index.json'),'utf8')).filter(v=>/^pet-[a-z-]+$/.test(v.id)&&/^[a-z-]+\.(png|gif)$/.test(v.file)).slice(0,40);}catch{}
  try{const stat=fs.statSync(this.file);if(stat.size>2000000)throw Error();const saved=JSON.parse(fs.readFileSync(this.file,'utf8'));this.items=(Array.isArray(saved)?saved:[]).filter(v=>/^[a-f0-9]{64}$/.test(v.id)&&typeof v.scope==='string'&&/^[\w-]{1,160}$/.test(v.scope)&&/^[a-f0-9]{64}\.(png|gif|jpeg|webp)$/.test(v.file)&&Number(v.size)>0&&v.size<=MAX_FILE).slice(-MAX_COUNT);}catch{}
 }
 save(){fs.mkdirSync(this.root,{recursive:true});const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.items));fs.renameSync(tmp,this.file);}
 catalog(scope){return [...this.builtin.map(v=>({...v,builtin:true})),...this.items.filter(v=>sameScope(v.scope,scope)).map(v=>({...v,builtin:false}))].map(v=>({id:v.id,label:trim(v.label,40),tags:(v.tags||[]).map(x=>trim(x,20)).slice(0,8),animated:!!v.animated,builtin:v.builtin,collectedAt:Number(v.at)||0}));}
 async collect(scope,selection,media){
  if(!/^[\w-]{1,160}$/.test(scope))return [];
  const saved=[];
  for(const choice of selection.slice(0,2)){
   if(choice.isMeme!==true)continue;const source=media.find(v=>v.index===choice.image-1),bytes=source?.bytes,mime=format(bytes);
   if(!mime||!bytes.length||bytes.length>MAX_FILE)continue;
   const hash=imageId(scope,bytes);if(this.items.some(v=>sameScope(v.scope,scope)&&v.id===imageId(v.scope,bytes)))continue;
   if(this.items.length>=MAX_COUNT||this.items.reduce((n,v)=>n+v.size,0)+bytes.length>MAX_BYTES)break;
   const item={id:hash,scope,file:hash+'.'+mime,label:trim(choice.label,40),tags:(choice.tags||[]).map(x=>trim(x,20)).filter(Boolean).slice(0,8),size:bytes.length,animated:mime==='gif'||mime==='webp'&&bytes.includes(Buffer.from('ANIM')),at:Date.now()};
   fs.mkdirSync(this.root,{recursive:true});fs.writeFileSync(path.join(this.root,item.file),bytes,{flag:'wx'});this.items.push(item);saved.push(item.label);
  }
  if(saved.length)this.save();return saved;
 }
 resolve(scope,id){const builtin=this.builtin.find(v=>v.id===id),saved=this.items.find(v=>sameScope(v.scope,scope)&&v.id===id);return builtin?{...builtin,root:this.builtinRoot}:saved?{...saved,root:this.root}:null;}
 data(scope,id){const v=this.resolve(scope,id);if(!v)return null;try{const file=path.join(v.root,v.file),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_FILE)return null;const bytes=fs.readFileSync(file),mime=format(bytes);if(!mime)return null;return {bytes,mime,label:v.label,animated:v.animated};}catch{return null;}}
 remove(scope,id){const v=this.items.find(v=>sameScope(v.scope,scope)&&v.id===id);if(!v)return false;const file=path.join(this.root,v.file);if(fs.existsSync(file))fs.unlinkSync(file);this.items=this.items.filter(x=>x.id!==id);this.save();return true;}
}
module.exports={StickerLibrary,format,MAX_COUNT,MAX_BYTES};
