'use strict';
let card;const $=id=>document.getElementById(id);
async function call(op){try{const r=await window.jie.inspiration(op,{value:!card?.favorite});$('status').textContent=r.error||r.result||'';}catch(e){$('status').textContent=e.message;}}
window.jie.onInspiration(c=>{card=c;$('title').textContent=c.title;$('text').textContent=c.content;$('tags').textContent=c.tags;$('image').hidden=!c.image;if(c.image){$('image').src=c.image;$('image').alt=c.title;}$('favorite').textContent=c.favorite?'取消收藏':'收藏';});
$('close').onclick=()=>call('card-close');$('favorite').onclick=()=>call('card-favorite');$('note').onclick=()=>call('card-note');$('later').onclick=()=>call('card-snooze');window.jie.inspiration('state').catch(()=>{});
