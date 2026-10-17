'use strict';
const byId=id=>document.getElementById(id);let anchor=null,rect=null,busy=false,ready=false;
const point=e=>({x:Math.max(0,Math.min(innerWidth,e.clientX)),y:Math.max(0,Math.min(innerHeight,e.clientY))});
function draw(){const selected=byId('selection');selected.hidden=!rect;byId('shade').hidden=!!rect;if(rect){Object.assign(selected.style,{left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px'});byId('size').textContent=Math.round(rect.width)+' × '+Math.round(rect.height);}}
function reset(){if(busy)return;anchor=null;rect=null;byId('toolbar').hidden=true;byId('capture-error').textContent='';draw();}
document.addEventListener('pointerdown',e=>{if(!ready||busy||e.button!==0||e.target.closest('button,#toolbar,#help'))return;anchor=point(e);rect=null;byId('toolbar').hidden=true;byId('capture-error').textContent='';document.body.setPointerCapture(e.pointerId);});
document.addEventListener('pointermove',e=>{if(!anchor)return;const p=point(e);rect={x:Math.min(anchor.x,p.x),y:Math.min(anchor.y,p.y),width:Math.abs(anchor.x-p.x),height:Math.abs(anchor.y-p.y)};draw();});
document.addEventListener('pointerup',e=>{if(!anchor)return;const p=point(e);rect={x:Math.min(anchor.x,p.x),y:Math.min(anchor.y,p.y),width:Math.abs(anchor.x-p.x),height:Math.abs(anchor.y-p.y)};anchor=null;if(rect.width<8||rect.height<8){reset();return;}draw();byId('toolbar').hidden=false;byId('accept').focus();});
document.addEventListener('pointercancel',reset);
for(const id of ['cancel-top','cancel'])byId(id).onclick=()=>{if(!busy)void window.capture.cancel();};byId('retry').onclick=reset;
byId('accept').onclick=async()=>{if(!rect||busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{const result=await window.capture.accept(rect);if(result?.error)byId('capture-error').textContent=result.error;}catch{byId('capture-error').textContent='截图未能加入聊天，请重新框选或取消。';}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!busy){e.preventDefault();void window.capture.cancel();}if(e.key==='Enter'&&!byId('toolbar').hidden&&!busy){e.preventDefault();byId('accept').click();}});
window.capture.state().then(state=>{byId('screen').onload=()=>ready=true;byId('screen').src=state.image;}).catch(()=>{byId('capture-error').textContent='没有取得屏幕画面，请取消后重试。';});
