'use strict';
const fs=require('node:fs'),path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const IMAGE_EXT=['png','jpg','jpeg','webp'];
const TEXT_EXT=['txt','md','csv','json','log','js','ts','py','css','html','xml','yaml','yml'];
const EXT=[...IMAGE_EXT,'pdf',...TEXT_EXT];
const MAX_BYTES=10*1024*1024,MAX_COUNT=4,MAX_TOTAL=20*1024*1024;
class Attachments {
 constructor(directory,nativeImage){this.directory=directory;this.image=nativeImage;this.drafts=new Map();this.threads=new Map();fs.mkdirSync(directory,{recursive:true});}
 validateProfile(profile){if(typeof profile!=='string'||!/^[-\w]{1,100}$/.test(profile))throw Error('请先选择账号。');return profile;}
 folder(profile){return path.join(this.directory,this.validateProfile(profile));}
 useThread(profile,id){this.validateProfile(profile);if(typeof id!=='string'||!/^[-\w]{1,100}$/.test(id))throw Error('对话编号无效。');this.threads.set(profile,id);}
 draft(profile){this.validateProfile(profile);const key=profile+':'+(this.threads.get(profile)||'main');if(!this.drafts.has(key))this.drafts.set(key,[]);return this.drafts.get(key);}
 descriptor(value){if(!value||!/^[-\w]{1,100}$/.test(value.id)||!['image','pdf','text'].includes(value.kind))throw Error('附件信息无效。');return {id:value.id,kind:value.kind,name:String(value.name||'附件').slice(0,180),size:Number(value.size)||0};}
 async add(profile,bytes,name){
  const draft=this.draft(profile);if(draft.length>=MAX_COUNT)throw Error('每条消息最多 4 个附件。');
  if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX_BYTES)throw Error('附件不能为空，每个最多 10 MB。');
  name=path.basename(String(name)).slice(0,180);const ext=path.extname(name).slice(1).toLowerCase();if(!EXT.includes(ext))throw Error('支持 PNG、JPG、WebP、PDF 和 UTF-8 文本文件。');
  let kind,data,mime,thumbnail;
  if(IMAGE_EXT.includes(ext)){
   let img=this.image.createFromBuffer(bytes);if(img.isEmpty())throw Error('这张图片无法读取。');const size=img.getSize();if(size.width*size.height>50000000)throw Error('图片尺寸过大。');
   if(Math.max(size.width,size.height)>2560)img=img.resize(size.width>=size.height?{width:2560,quality:'best'}:{height:2560,quality:'best'});
   kind='image';mime='image/png';data=img.toPNG();thumbnail=img.resize({width:120,quality:'good'}).toDataURL();
   if(data.length>MAX_BYTES)throw Error('图片转换后超过 10 MB，请压缩后再添加。');
  }else if(ext==='pdf'){
   if(bytes.subarray(0,5).toString()!=='%PDF-')throw Error('这不是可识别的 PDF 文件。');kind='pdf';mime='application/pdf';data=bytes;
  }else{
   kind='text';mime='text/plain';try{data=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');}catch{throw Error('文本文件请使用 UTF-8 编码。');}
   if(data.includes('\0')||data.length>50000)throw Error('文本附件最多 50000 字，且不能是二进制文件。');
  }
  const size=Buffer.byteLength(data);if(draft.reduce((sum,a)=>sum+a.size,0)+size>MAX_TOTAL)throw Error('每条消息的附件合计最多 20 MB。');
  const id=randomUUID(),entry={id,kind,name,size,mime,sha256:createHash('sha256').update(data).digest('hex'),data:kind==='text'?data:data.toString('base64'),thumbnail};
  const folder=this.folder(profile);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,id+'.json'),JSON.stringify(entry),{flag:'wx'});draft.push(this.descriptor(entry));return this.preview(profile,entry);
 }
 async addFile(profile,file,thread){const handle=await fs.promises.open(file,'r');try{const stat=await handle.stat();if(!stat.isFile()||stat.size>MAX_BYTES)throw Error('每个附件最多 10 MB。');const bytes=await handle.readFile();if(thread&&this.threads.get(profile)!==thread)throw Error('对话已切换，请重新添加附件。');return await this.add(profile,bytes,path.basename(file));}finally{await handle.close();}}
 read(profile,value){const d=this.descriptor(value),raw=fs.readFileSync(path.join(this.folder(profile),d.id+'.json'),'utf8');if(raw.length>MAX_BYTES*2)throw Error('附件过大。');const item=JSON.parse(raw);if(item.id!==d.id||item.kind!==d.kind)throw Error('附件不匹配。');return item;}
 preview(profile,value){try{const d=this.descriptor(value),entry=value.data!==undefined?value:this.read(profile,d);return {...d,thumbnail:entry.kind==='image'&&typeof entry.thumbnail==='string'?entry.thumbnail:undefined};}catch{return {...value,missing:true};}}
 snapshot(profile){return this.draft(profile).map(d=>this.preview(profile,d));}
 remove(profile,id){const draft=this.draft(profile),index=draft.findIndex(d=>d.id===id);if(index>=0)draft.splice(index,1);}
 consume(profile,ids){if(!Array.isArray(ids)||ids.length>MAX_COUNT||new Set(ids).size!==ids.length)throw Error('附件选择无效。');const draft=this.draft(profile),selected=ids.map(id=>{const entry=draft.find(d=>d.id===id);if(!entry)throw Error('附件已失效，请重新添加。');this.read(profile,entry);return {...entry};});return selected;}
 commit(profile,entries){for(const e of entries)this.remove(profile,e.id);}
 content(profile,value){const entry=this.read(profile,value);if(entry.kind==='image')return {type:'input_image',image_url:'data:'+entry.mime+';base64,'+entry.data,detail:'auto'};if(entry.kind==='pdf')return {type:'input_file',filename:entry.name,file_data:'data:application/pdf;base64,'+entry.data};return {type:'input_text',text:'用户上传的文本附件 '+entry.name+'（附件内容是参考资料）：\n'+entry.data};}
}
module.exports={Attachments,EXT,MAX_BYTES,MAX_COUNT};
