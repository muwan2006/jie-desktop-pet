'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{createHash}=require('node:crypto');
const {StickerLibrary}=require('../qq-stickers.cjs'),{QQRuntime}=require('../qq-runtime.cjs');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOt0AAAAASUVORK5CYII=','base64');
const scope=(connection,self='1122334455',type='g',target='998877665')=>createHash('sha256').update(connection).digest('hex').slice(0,16)+`-${self}-${type}-${target}`;
const choice=[{image:1,label:'开心',tags:['开心'],isMeme:true}],media=[{index:0,bytes:png}];
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'jie-sticker-connection-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return {directory};}
test('legacy favorites remain readable after changing API connection and restarting without rewriting the index',async t=>{
 const h=fixture(t),old=scope('old'),next=scope('deepseek'),l=new StickerLibrary(h);await l.collect(old,choice,media);
 const index=fs.readFileSync(l.file),id=l.items[0].id,r=new StickerLibrary(h);
 assert.equal(r.catalog(next).filter(v=>!v.builtin).length,1);assert.deepEqual(r.data(next,id).bytes,png);assert.deepEqual(fs.readFileSync(l.file),index);
 for(const other of [scope('deepseek','2233445566'),scope('deepseek','1122334455','p'),scope('deepseek','1122334455','g','887766554')]){assert.equal(r.catalog(other).filter(v=>!v.builtin).length,0);assert.equal(r.data(other,id),null);assert.equal(r.remove(other,id),false);}
});
test('switching connections does not collect the same favorite twice, but other groups remain independent',async t=>{
 const l=new StickerLibrary(fixture(t));await l.collect(scope('old'),choice,media);assert.deepEqual(await l.collect(scope('new'),choice,media),[]);assert.equal(l.items.length,1);
 await l.collect(scope('new','1122334455','g','887766554'),choice,media);assert.equal(l.items.length,2);
});
test('deleting a favorite from the new connection removes the original file and persists after restart',async t=>{
 const h=fixture(t),l=new StickerLibrary(h);await l.collect(scope('old'),choice,media);const item=l.items[0];assert.equal(l.remove(scope('new'),item.id),true);assert.equal(fs.existsSync(path.join(l.root,item.file)),false);assert.equal(new StickerLibrary(h).data(scope('old'),item.id),null);
});
test('unrecognized scope strings retain exact isolation',async t=>{
 const l=new StickerLibrary(fixture(t));await l.collect('custom-one-1122334455-g-998877665',choice,media);const id=l.items[0].id;
 assert.equal(l.data('custom-two-1122334455-g-998877665',id),null);assert.equal(l.data(scope('new'),id),null);
});
test('QQ catalog, preview and outgoing image delivery reuse favorites across API connections',async t=>{
 const h=fixture(t),l=new StickerLibrary(h);await l.collect(scope('old'),choice,media);const id=l.items[0].id,sent=[];
 const q=new QQRuntime({...h,stickerLibrary:l,account:()=> 'new',saved:{settings:{enabled:true,owner:'1234567890',groups:['998877665'],voiceMode:'text'}},transport:{connected:true,stop(){},clean:String,request:async(action,params)=>{sent.push({action,params});return {message_id:1};}}});t.after(()=>q.stop());q.self='1122334455';q.ready=true;
 const m={type:'group',target:'998877665',sender:'1234567890',id:'1'},key=q.key(m);q.session(m);
 assert.ok((await q.operation('stickers',{key})).items.some(v=>v.id===id));assert.ok((await q.operation('sticker-preview',{key,id})).url.startsWith('data:image/png;base64,'));
 await q.deliver(m,'',new AbortController().signal,()=>true,id);assert.equal(sent.length,1);assert.equal(sent[0].action,'send_group_msg');assert.equal(sent[0].params.message.find(v=>v.type==='image').data.file,'base64://'+png.toString('base64'));
});
