'use strict';
const title=document.querySelector('#title'),text=document.querySelector('#text'),saved=document.querySelector('#saved');
function show(n){if(document.activeElement!==title)title.value=n.title;if(document.activeElement!==text)text.value=n.text;}
window.jie.note().then(show);window.jie.onNote(show);
for(const el of [title,text])el.addEventListener('input',()=>{window.jie.editNote({title:title.value,text:text.value});saved.textContent='已记录 · 自动保存';});
