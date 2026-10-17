'use strict';
(()=>{
 const $=s=>document.querySelector(s),keys=window.JieKeys;let draft=null,saved='',dirty=false,capture=null,timeout=null;
 function status(text){$('#shortcut-status').textContent=text;}
 function cancelCapture(){if(!capture)return;capture=null;clearTimeout(timeout);window.JieShortcutCapturing=false;void window.jie.shortcuts('capture',{active:false});renderRows();}
 function renderRows(){
  if(!draft)return;$('#shortcut-list').replaceChildren();
  for(const scope of ['global','chat']){const title=document.createElement('h3');title.textContent=scope==='global'?'全局快捷键':'聊天面板快捷键';$('#shortcut-list').append(title);
   for(const d of keys.definitions.filter(d=>d.scope===scope)){const row=document.createElement('div');row.className='shortcut-row';const label=document.createElement('span');label.textContent=d.label;const record=document.createElement('button');record.type='button';record.textContent=capture===d.id?'请按组合键…':keys.label(draft[d.id]);record.setAttribute('aria-label',d.label+'：'+record.textContent);record.onclick=async()=>{cancelCapture();const result=await window.jie.shortcuts('capture',{active:true});if(result?.error){status(result.error);return;}capture=d.id;window.JieShortcutCapturing=true;status('请按下希望使用的按键；Esc 取消录入。');renderRows();timeout=setTimeout(()=>{cancelCapture();status('录入已结束，可以再点击一次。');},18000);};const clear=document.createElement('button');clear.type='button';clear.textContent='清除';clear.onclick=()=>{cancelCapture();draft[d.id]='';dirty=true;status('有未保存修改。');renderRows();};row.append(label,record,clear);$('#shortcut-list').append(row);}
  }
 }
 document.addEventListener('keydown',e=>{
  if(!capture)return;e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape'){cancelCapture();status('已取消录入。');return;}if(e.repeat)return;
  const value=keys.fromEvent(e),def=keys.definitions.find(d=>d.id===capture);if(!value)return;
  const key=keys.normalize(value,def.scope);if(key===null){status(def.scope==='global'?'全局快捷键请包含 Ctrl、Alt 或 Win，也可用功能键。':'聊天快捷键请使用组合键、回车或 Esc。');return;}
  draft[def.id]=key;dirty=true;cancelCapture();status('有未保存修改。');
 },true);
 $('#shortcut-save').onclick=async()=>{cancelCapture();const checked=keys.validate(draft);if(checked.error){status(checked.error);return;}const r=await window.jie.shortcuts('save',{keys:draft});if(r?.error){status(r.error);return;}dirty=false;saved=JSON.stringify(draft);status('快捷键已保存，下次打开也会保留。');};
 $('#shortcut-defaults').onclick=()=>{cancelCapture();draft={...keys.defaults};dirty=true;renderRows();status('已填入默认按键，点击保存后生效。');};
 window.addEventListener('blur',cancelCapture);window.addEventListener('beforeunload',cancelCapture);
 function update(s){const value=s.shortcuts;const hint=$('#reveal-key-hint');if(hint&&value)hint.textContent=keys.label(value.keys.reveal)+' 把她叫回来';if(!value)return;const serial=JSON.stringify(value.keys);if(!dirty&&saved!==serial){saved=serial;draft={...value.keys};renderRows();}const error=Object.values(value.errors||{}).join('；');if(error&&!dirty&&!capture)status(error);}
 window.jie.onSnapshot(update);window.jie.snapshot().then(update);
})();
