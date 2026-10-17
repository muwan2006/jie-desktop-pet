'use strict';
const $=selector=>document.querySelector(selector);let snapshot;
function display(s){snapshot=s;renderEmotes(s);$('#pet-form').value=s.settings.form;$('#keyboard-follow').checked=s.settings.keyboardFollow;$('#type-demo').disabled=s.settings.form!=='desk';$('#keyboard-follow').disabled=s.settings.form!=='desk';$('#keyboard-status').textContent=s.settings.form!=='desk'?'书案形态固定在桌前，仍可拖动到喜欢的位置。':!s.settings.keyboardFollow?'已关闭键盘跟随。':s.resting?'正在休息，暂停跟随打字。':s.keyboardStatus==='ready'?'键盘跟随已开启；你打字时，她会敲键盘。':s.keyboardStatus==='starting'?'正在开启键盘跟随……':s.keyboardStatus==='unavailable'||s.keyboardStatus==='unsupported'?'键盘跟随暂不可用，可以先点击“敲键盘演示”。':'书案形态已选中。';const names={companion:'自由陪伴',read:'正在看书',rest:'安静休息',focus:s.focus?.paused?'专注已暂停':'陪你专注'};$('#mode').textContent=names[s.mode]||'自由陪伴';$('#completed').textContent=`已完成 ${s.completed} 段专注`;
 for(const key of ['roam','speech','alwaysOnTop','drinkReminder','restReminder'])$('#'+key).checked=s.settings[key];
 for(const key of ['drinkMinutes','restMinutes'])if(document.activeElement!==$('#'+key))$('#'+key).value=s.settings[key];
 for(const key of ['mood','energy','affinity'])$('#'+key).value=s.care[key];
 $('#mood-label').textContent=s.care.mood>=70?'从容':s.care.mood>=40?'平静':'想歇歇';$('#energy-label').textContent=s.care.energy;$('#affinity-label').textContent=s.care.affinity>=50?'默契':s.care.affinity>=20?'相熟':'初识';
 const today=s.daily[s.today]||{count:0,minutes:0};$('#today-count').textContent=today.count;$('#today-minutes').textContent=today.minutes;
 renderLists(s);
 for(const key of ['scale','speed']){if(document.activeElement!==$('#'+key))$('#'+key).value=s.settings[key];}
 $('#scale-value').textContent=Math.round(s.settings.scale*100)+'%';$('#speed-value').textContent=s.settings.speed;
 if(document.activeElement!==$('#minutes'))$('#minutes').value=s.settings.focusMinutes;
 const seconds=s.focus?Math.ceil(s.focus.remaining/1000):s.settings.focusMinutes*60;$('#countdown').textContent=`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
 $('#focus-controls').hidden=!s.focus;$('#start').hidden=!!s.focus;$('#minutes').disabled=!!s.focus;$('#pause').textContent=s.focus?.paused?'继续计时':'暂停计时';
}
$('#pet-form').addEventListener('change',()=>window.jie.settings({form:$('#pet-form').value}));
$('#keyboard-follow').addEventListener('change',()=>window.jie.settings({keyboardFollow:$('#keyboard-follow').checked}));
window.jie.onSnapshot(display);window.jie.snapshot().then(display);
document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>window.jie.command(button.dataset.command)));
for(const key of ['roam','speech','alwaysOnTop','drinkReminder','restReminder'])$('#'+key).addEventListener('change',()=>window.jie.settings({[key]:$('#'+key).checked}));
for(const key of ['drinkMinutes','restMinutes'])$('#'+key).addEventListener('change',()=>window.jie.settings({[key]:Math.min(240,Math.max(1,Number($('#'+key).value)||45))}));
for(const key of ['scale','speed'])$('#'+key).addEventListener('input',()=>window.jie.settings({[key]:Number($('#'+key).value)}));
$('#minutes').addEventListener('change',()=>{const n=Number($('#minutes').value);if(Number.isFinite(n))window.jie.settings({focusMinutes:Math.min(180,Math.max(1,n))});});
$('#start').addEventListener('click',()=>{window.jie.settings({focusMinutes:Math.min(180,Math.max(1,Number($('#minutes').value)||25))});window.jie.command('focus');});
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{document.querySelector('main').classList.toggle('chat-mode',['voice','chat','character'].includes(button.dataset.page));document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('selected',b===button));document.querySelectorAll('article').forEach(a=>a.hidden=a.id!=='page-'+button.dataset.page);}));
$('#todo-form').addEventListener('submit',event=>{event.preventDefault();const text=$('#todo-text').value.trim();if(text){window.jie.todo('add',text);$('#todo-text').value='';}});
let listKey='';
function renderLists(s){const key=JSON.stringify([s.todos,s.journal]);if(key===listKey)return;listKey=key;
 $('#todos').replaceChildren();if(!s.todos.length){const li=document.createElement('li');li.className='empty';li.textContent='这一页还空着。慢慢添就好。';$('#todos').append(li);}
 for(const todo of s.todos){const li=document.createElement('li');li.className=todo.done?'done':'';const check=document.createElement('input');check.type='checkbox';check.checked=todo.done;check.setAttribute('aria-label','完成 '+todo.text);check.onchange=()=>window.jie.todo('toggle',todo.id);const text=document.createElement('span');text.textContent=todo.text;const remove=document.createElement('button');remove.textContent='删除';remove.onclick=()=>window.jie.todo('remove',todo.id);li.append(check,text,remove);$('#todos').append(li);}
 $('#journal').replaceChildren();if(!s.journal.length){const li=document.createElement('li');li.className='empty';li.textContent='从今日起，慢慢记下一些相伴的片刻。';$('#journal').append(li);}
 for(const entry of s.journal){const li=document.createElement('li'),time=document.createElement('time'),text=document.createElement('span');time.textContent=new Date(entry.at).toLocaleString('zh-CN');text.textContent=entry.text;li.append(time,text);$('#journal').append(li);}
}

let emoteForm='';
function renderEmotes(s){
 $('#auto-emotes').checked=s.settings.autoEmotes;$('#context-emotes').checked=s.settings.contextEmotes;
 const active=s.emote&&JieEmotes.find(s.emote.command);
 $('#emote-status').textContent=active?'正在'+active.label+'，结束后恢复陪伴。':s.settings.autoEmotes?'每隔一会儿做个小动作；休息、拖动和持续打字时会避让。':'已关闭自动小动作，仍可点击下面的按钮。';
 if(emoteForm===s.settings.form)return;emoteForm=s.settings.form;
 $('#emote-actions').replaceChildren();$('#emote-expressions').replaceChildren();
 for(const item of JieEmotes.catalog[emoteForm]){const button=document.createElement('button');button.textContent=item.label;button.addEventListener('click',()=>window.jie.command(item.command));$(item.kind==='action'?'#emote-actions':'#emote-expressions').append(button);}
}
$('#auto-emotes').addEventListener('change',()=>window.jie.settings({autoEmotes:$('#auto-emotes').checked}));

$('#context-emotes').addEventListener('change',()=>window.jie.settings({contextEmotes:$('#context-emotes').checked}));
