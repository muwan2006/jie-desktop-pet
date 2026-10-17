'use strict';
const d$=id=>document.getElementById(id);let diaryState=null,diaryAuth=null,diaryProfile='',diaryDirty=false,diaryEntryKey='',diaryListKey='';const diaryDrafts=new Map();
async function diaryOperation(operation,input){try{const result=await window.jie.chat(operation,input);if(result?.error)d$('diary-error').textContent=result.error;return result||{};}catch{d$('diary-error').textContent='操作没有完成，请重试。';return {error:true};}}
function stashDiaryDraft(){if(diaryDirty&&diaryState)diaryDrafts.set(diaryProfile+'|'+d$('diary-date').value,{title:d$('diary-title').value,text:d$('diary-text').value});}
function diaryEntry(){return diaryState?.entries.find(e=>e.date===d$('diary-date').value);}
function loadDiaryEditor(){const entry=diaryEntry(),date=d$('diary-date').value,key=diaryProfile+'|'+date+'|'+JSON.stringify(entry||null);if(key===diaryEntryKey)return;diaryEntryKey=key;
 const draft=diaryDrafts.get(diaryProfile+'|'+date);diaryDirty=!!draft;d$('diary-editor').hidden=!entry&&!draft;d$('diary-empty').hidden=!!entry||!!draft;
 d$('diary-title').value=draft?.title??entry?.title??'';d$('diary-text').value=draft?.text??entry?.text??'';diaryMeta();
}
function diaryMeta(){const entry=diaryEntry();d$('diary-meta').textContent=diaryDirty?'有未保存修改':entry?((entry.edited?'已手动修改':'颉写于 '+new Date(entry.generatedAt).toLocaleString('zh-CN'))+(entry.partial?' · 依据保留的部分聊天记录':'')):'';}
function selectDiaryDay(date){stashDiaryDraft();d$('diary-date').value=date;diaryDirty=false;diaryEntryKey='';renderDiaryControls();loadDiaryEditor();}
function renderDiaryControls(){if(!diaryState)return;const entry=diaryEntry(),busy=diaryState.busy;
 d$('diary-generate').disabled=busy||!diaryAuth?.connected||!diaryAuth?.model;d$('diary-generate').textContent=entry?'重写这天的小记':'写这天的小记';d$('diary-stop').hidden=!busy;
 for(const id of ['diary-save','diary-restore','diary-remove'])d$(id).disabled=busy||!entry;d$('diary-export').disabled=!entry;d$('diary-restore').hidden=!entry?.versions?.length;
 d$('diary-status').textContent=diaryState.status||'';d$('diary-error').textContent=diaryState.error||'';
}
function renderDiary(state){if(!state.diary)return;const next=state.diary;diaryAuth=state.auth;
 if(next.profile!==diaryProfile){stashDiaryDraft();diaryProfile=next.profile;diaryEntryKey='';diaryListKey='';diaryDirty=false;d$('diary-date').value=next.today;}
 diaryState=next;d$('diary-date').max=next.today;if(!d$('diary-date').value)d$('diary-date').value=next.today;
 if(document.activeElement!==d$('diary-auto'))d$('diary-auto').checked=next.settings.automatic;if(document.activeElement!==d$('diary-time'))d$('diary-time').value=next.settings.time;
 renderDiaryControls();if(!diaryDirty)loadDiaryEditor();else diaryMeta();
 const listKey=JSON.stringify(next.entries.map(e=>[e.date,e.title,e.updatedAt]));if(listKey!==diaryListKey){diaryListKey=listKey;const list=d$('diary-list');list.replaceChildren();
  for(const entry of next.entries){const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=entry.date+' · '+entry.title;button.onclick=()=>selectDiaryDay(entry.date);li.append(button);list.append(li);}
  if(!next.entries.length){const li=document.createElement('li');li.className='empty';li.textContent='还没有每日小记。今天的片刻，可以从这一页开始。';list.append(li);}
 }
}
window.jie.onReviewSource(v=>{if(v.kind==='diary')selectDiaryDay(v.date);});
d$('diary-date').onchange=()=>{const date=d$('diary-date').value;if(!date)return;const old=diaryEntryKey.split('|')[1];if(diaryDirty&&old){diaryDrafts.set(diaryProfile+'|'+old,{title:d$('diary-title').value,text:d$('diary-text').value});}diaryDirty=false;diaryEntryKey='';renderDiaryControls();loadDiaryEditor();};
for(const id of ['diary-title','diary-text'])d$(id).addEventListener('input',()=>{diaryDirty=true;stashDiaryDraft();diaryMeta();});
d$('diary-settings').onsubmit=async event=>{event.preventDefault();const result=await diaryOperation('diary-settings',{automatic:d$('diary-auto').checked,time:d$('diary-time').value});if(result.ok)d$('diary-status').textContent='小记设置已保存。';};
d$('diary-generate').onclick=async()=>{const entry=diaryEntry(),date=d$('diary-date').value;if(!date){d$('diary-error').textContent='请先选择日期。';return;}
 if(entry&&!confirm('重新写 '+date+' 的小记？当前已保存内容会保留为上一版。'))return;stashDiaryDraft();const result=await diaryOperation('diary-generate',{date,force:!!entry});if(result.ok&&!diaryDirty){diaryEntryKey='';loadDiaryEditor();}
};
d$('diary-stop').onclick=()=>diaryOperation('diary-stop');
d$('diary-editor').onsubmit=async event=>{event.preventDefault();const date=d$('diary-date').value,title=d$('diary-title').value,text=d$('diary-text').value,profile=diaryProfile;const result=await diaryOperation('diary-save',{date,title,text});
 if(result.ok){const draft=diaryDrafts.get(profile+'|'+date);if(!draft||draft.title===title&&draft.text===text){diaryDrafts.delete(profile+'|'+date);if(profile===diaryProfile&&date===d$('diary-date').value){diaryDirty=false;diaryEntryKey='';loadDiaryEditor();}}}
};
d$('diary-discard').onclick=()=>{if(diaryDirty&&!confirm('放弃这一天尚未保存的修改？'))return;diaryDrafts.delete(diaryProfile+'|'+d$('diary-date').value);diaryDirty=false;diaryEntryKey='';loadDiaryEditor();};
d$('diary-export').onclick=()=>diaryOperation('diary-export',{date:d$('diary-date').value});
d$('diary-restore').onclick=async()=>{if(diaryDirty&&!confirm('恢复上一版会替换编辑区的未保存内容，继续？'))return;const date=d$('diary-date').value;const result=await diaryOperation('diary-restore',{date});if(result.ok){diaryDrafts.delete(diaryProfile+'|'+date);diaryDirty=false;diaryEntryKey='';loadDiaryEditor();}};
d$('diary-remove').onclick=async()=>{const date=d$('diary-date').value;if(!confirm('删除 '+date+' 的小记？当天不会自动重新生成。'))return;const result=await diaryOperation('diary-remove',{date});if(result.ok){diaryDrafts.delete(diaryProfile+'|'+date);diaryDirty=false;diaryEntryKey='';loadDiaryEditor();}};
window.jie.onChat(renderDiary);window.jie.chatState().then(renderDiary);
