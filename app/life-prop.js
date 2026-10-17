'use strict';
function show(p){if(!p?.kind)return;document.getElementById('name').textContent=p.label;for(const kind of ['tea','book','crane','ink'])document.getElementById(kind).toggleAttribute('hidden',kind!==p.kind);}
window.jie.onLifeProp(show);window.jie.lifeProp('state').then(show);
document.getElementById('use').onclick=async()=>{const r=await window.jie.lifeProp('use');if(r?.error)document.getElementById('name').textContent=r.error;};document.getElementById('close').onclick=()=>window.jie.lifeProp('remove');
