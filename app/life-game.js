'use strict';
const byId=id=>document.getElementById(id),icons={rock:'✊',paper:'✋',scissors:'✌'};
let busy=false;
function show(s){if(!s?.game)return;const g=s.game,number=g.kind==='number';byId('title').textContent=number?'猜猜她心里的数字':'和颉猜拳';byId('result').textContent=g.result;byId('number').hidden=!number;byId('rps').hidden=number;byId('guess').disabled=!!g.finished;byId('submit').disabled=!!g.finished;if(!number){byId('your-hand').textContent=icons[g.choice];byId('jie-hand').textContent=icons[g.opponent];}}
async function call(op,v){if(busy)return;busy=true;try{const r=await window.jie.lifeGame(op,v);byId('error').textContent=r?.error||'';if(!r?.error)show(await window.jie.lifeGame('state'));}catch(e){byId('error').textContent=e.message;}finally{busy=false;}}
window.jie.onLifeGame(show);window.jie.lifeGame('state').then(show);
byId('number').onsubmit=e=>{e.preventDefault();call('guess',{value:Number(byId('guess').value)});};byId('again').onclick=async()=>{byId('guess').value='';await call('guess-start');byId('guess').focus();};byId('close').onclick=()=>call('close');for(const b of document.querySelectorAll('[data-choice]'))b.onclick=()=>call('rps',{choice:b.dataset.choice});
byId('guess').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();if(!busy&&byId('guess').checkValidity())byId('number').requestSubmit();}});
