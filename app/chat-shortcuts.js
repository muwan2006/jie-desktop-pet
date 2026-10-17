'use strict';
(()=>{
 const keys=window.JieKeys,$=s=>document.querySelector(s);let active={...keys.defaults};
 function update(s){if(s.shortcuts?.keys)active={...s.shortcuts.keys};const hint=$('#chat-key-hint');if(hint)hint.textContent=keys.label(active.send)+' 发送，'+keys.label(active.newline)+' 换行；可在设置里修改快捷键。';}
 window.jie.onSnapshot(update);window.jie.snapshot().then(update);
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.repeat||e.isComposing||e.keyCode===229||window.JieShortcutCapturing||$('#page-chat').hidden)return;
  // Browser/OS dialogs and other editors keep their keyboard behaviour.
  if(document.querySelector('dialog[open]'))return;
  const input=$('#chat-input'),inInput=e.target===input;
  if(inInput&&keys.matches(e,active.newline)){e.preventDefault();input.setRangeText('\n',input.selectionStart,input.selectionEnd,'end');input.dispatchEvent(new Event('input',{bubbles:true}));return;}
  if(inInput&&(keys.matches(e,active.send)||(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey))){e.preventDefault();if(!$('#chat-send').disabled)$('#chat-form').requestSubmit();return;}
  if(keys.matches(e,active.focusChat)){e.preventDefault();input.focus();return;}
  if(keys.matches(e,active.stopReply)){e.preventDefault();void window.jie.chat('stop');return;}
  if(keys.matches(e,active.replay)){e.preventDefault();void window.jie.voice('replay');}
 });
})();
