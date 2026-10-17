'use strict';
const {randomUUID}=require('node:crypto');
const clip=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
class GameNotebook{
 constructor(saved={},h){this.h=h;this.books=(Array.isArray(saved.books)?saved.books:[]).slice(0,30);this.active=saved.active&&typeof saved.active==='object'?saved.active:{};this.pending=[];}
 owner(){return this.h.owner().profile;}
 snapshot(){return {books:this.books.filter(b=>b.profile===this.owner()),active:this.active[this.owner()]||'',pending:this.pending.filter(v=>v.profile===this.owner())};}
 save(){return {books:this.books,active:this.active};}
 book(id=this.active[this.owner()]){const b=this.books.find(b=>b.profile===this.owner()&&b.id===id);if(!b)throw Error('请先建立或选择游戏线索本。');return b;}
 create(title){title=clip(title,80);if(!title)throw Error('请填写游戏名称。');if(this.books.length>=30)throw Error('最多30本线索本。');const b={id:randomUUID(),profile:this.owner(),title,progress:'',spoilerFree:true,entries:[],at:Date.now()};this.books.push(b);this.active[this.owner()]=b.id;this.emit();return {ok:true,id:b.id};}
 select(id){if(id)this.book(id);this.active[this.owner()]=id||'';this.pending=[];this.emit();return {ok:true};}
 configure(v){const b=this.book(v.id);b.progress=clip(v.progress,300);b.spoilerFree=v.spoilerFree!==false;this.emit();return {ok:true};}
 add(v){const b=this.book(v.bookId),text=clip(v.text,1200),kind=['fact','clue','guess','question','person'].includes(v.kind)?v.kind:'guess';if(!text)throw Error('记录不能为空。');if(b.entries.length>=300)throw Error('每本线索本最多300条。');b.entries.push({id:randomUUID(),kind,text,at:Date.now(),source:v.source||{kind:'manual'}});this.emit();return {ok:true};}
 remove(v){const b=this.book(v.bookId);b.entries=b.entries.filter(e=>e.id!==v.id);this.emit();return {ok:true};}
 observe(v){const b=this.books.find(b=>b.profile===this.owner()&&b.id===this.active[this.owner()]);if(!b||!clip(v.text,1200)||this.pending.some(e=>e.text===v.text)||b.entries.some(e=>e.text===v.text))return;this.pending.push({id:randomUUID(),bookId:b.id,profile:this.owner(),kind:'clue',text:clip(v.text,1200),source:{kind:'screen',at:v.at,label:clip(v.label,80)}});this.pending=this.pending.slice(-20);this.emit();}
 accept(id,kind){const p=this.pending.find(p=>p.id===id&&p.profile===this.owner());if(!p)throw Error('候选记录已失效。');const r=this.add({...p,kind:kind||'clue'});this.pending=this.pending.filter(v=>v!==p);return r;}
 dismiss(id){this.pending=this.pending.filter(v=>v.id!==id||v.profile!==this.owner());this.emit();return {ok:true};}
 context(){const b=this.books.find(b=>b.id===this.active[this.owner()]&&b.profile===this.owner());if(!b)return null;return {title:b.title,progress:b.progress,spoilerFree:b.spoilerFree,entries:b.entries.slice(-40),rules:'只依据用户已经看到并确认的记录讨论。guess是猜测，question是未解问题，屏幕来源只是观察候选，不是客观已证实事实。防剧透开启时不使用后续剧情或搜索攻略泄露答案。缺少依据就询问，不自行补全剧情。'};}
 emit(){this.h.onChange?.();}
}
module.exports={GameNotebook};
