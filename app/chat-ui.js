'use strict';
const c$=s=>document.querySelector(s);let chatView=null,historyKey='',memoryKey='',accountKey='',modelsKey='',welcomeShownFor='',connectionKey='';
async function chatOperation(operation,input){try{const r=await window.jie.chat(operation,input);if(r?.error)c$('#chat-error').textContent=r.error;return r||{};}catch{c$('#chat-error').textContent='操作没有完成，请重试。';return {error:true};}}
function chatButton(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b;}
function renderReplyText(container,h){
 if(h.role==='assistant'&&h.search?.used&&h.search.showLinks!==true){container.textContent=window.JieReplyLinks.clean(h.text);return;}
 const citations=h.search?.citations||[],pattern=/\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)/g;let last=0,match;
 while((match=pattern.exec(h.text))){let url;try{url=new URL(match[2]).href;}catch{continue;}const index=citations.findIndex(c=>c.url===url);if(index<0)continue;container.append(document.createTextNode(h.text.slice(last,match.index)));const link=document.createElement('a');link.href=url;link.textContent=match[1];link.onclick=e=>{e.preventDefault();void chatOperation('source-open',{id:h.id,index,kind:'citations'});};container.append(link);last=pattern.lastIndex;}
 container.append(document.createTextNode(h.text.slice(last)));
}

function showPage(name){const b=document.querySelector('[data-page="'+name+'"]');if(b)b.click();}
window.jie.onPage(name=>{if(['voice','chat','memories','character','companion','tools','utilities','journal','assistant','settings'].includes(name))showPage(name);});
c$('#chat-login').onclick=()=>chatOperation('login',{id:c$('#chat-account').value||undefined});
c$('#chat-cancel-login').onclick=()=>chatOperation('cancel-login');c$('#chat-signout').onclick=()=>chatOperation('signout');
c$('#chat-account').onchange=()=>{const id=c$('#chat-account').value;if(id)chatOperation('account',{id});};
c$('#chat-model').onchange=()=>chatOperation('model',{id:c$('#chat-model').value});c$('#chat-refresh').onclick=()=>chatOperation('models');c$('#chat-usage').onclick=()=>chatOperation('usage');
c$('#chat-source-links').onchange=()=>chatOperation('source-links',{enabled:c$('#chat-source-links').checked});
c$('#chat-search').onchange=()=>chatOperation('search-mode',{mode:c$('#chat-search').value});
c$('#chat-stop').onclick=()=>chatOperation('stop');c$('#chat-clear').onclick=()=>{if(confirm('清空当前这段对话的记录？已保存的记忆和便签仍保留。'))chatOperation('clear');};
c$('#chat-export').onclick=()=>chatOperation('chat-export');c$('#chat-history-more').onclick=()=>chatOperation('history-more');
c$('#chat-attach').onclick=()=>chatOperation('attachment-pick');
c$('#chat-screen').onclick=async()=>{c$('#chat-screen').disabled=true;try{await chatOperation('screen-share');}finally{c$('#chat-screen').disabled=!!chatView?.chat.busy;}};
async function addChatFiles(files){const profile=chatView?.chat.profile;if(!profile)return;for(const file of files){if(file.size>10*1024*1024){c$('#chat-error').textContent='每个附件最多 10 MB。';continue;}try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const r=await chatOperation('attachment-add',{profile,name:file.name||'粘贴的截图.png',data});if(r.error)break;}catch{c$('#chat-error').textContent='附件无法读取，请重试。';}}}
c$('#chat-input').addEventListener('paste',e=>{const files=[...(e.clipboardData?.files||[])];if(files.length){e.preventDefault();void addChatFiles(files);}});
c$('#chat-form').addEventListener('dragover',e=>{e.preventDefault();});
c$('#chat-form').addEventListener('drop',e=>{e.preventDefault();void addChatFiles([...(e.dataTransfer?.files||[])]);});
c$('#chat-form').onsubmit=async e=>{e.preventDefault();if(chatView?.chat.busy)return;const text=c$('#chat-input').value.trim();if(!text&&!(chatView?.chat.draftAttachments||[]).length)return;
 c$('#chat-error').textContent='';const request=chatOperation('send',{text,attachments:(chatView?.chat.draftAttachments||[]).map(a=>a.id)});await new Promise(r=>setTimeout(r,0));if(chatView?.chat.busy)c$('#chat-input').value='';const result=await request;if(result.ok&&c$('#chat-input').value.trim()===text)c$('#chat-input').value='';if(result.error&&!c$('#chat-input').value)c$('#chat-input').value=text;
};
// Keyboard submission is handled by chat-shortcuts.js, including IME guards.
document.querySelectorAll('[data-chat-example]').forEach(b=>b.onclick=()=>{c$('#chat-input').value=b.dataset.chatExample;c$('#chat-input').focus();});
c$('#memory-form').onsubmit=async e=>{e.preventDefault();const r=await chatOperation('memory-add',{text:c$('#memory-input').value});if(!r.error)c$('#memory-input').value='';};
c$('#chat-welcome-ok').onclick=()=>{c$('#chat-welcome').close();chatOperation('welcome');};
c$('#chat-welcome').addEventListener('cancel',()=>chatOperation('welcome'));
function renderChat(state){chatView=state;const {auth:a,chat:c}=state;renderCharacter(c);
 const ck=String(a.connected)+a.active;if(ck!==connectionKey){connectionKey=ck;c$('#chat-connection').open=!a.connected;}
 c$('#chat-auth-status').textContent=a.status||(a.connected?'聊天服务已连接。':'还未连接。点击下方按钮登录。');
 c$('#chat-login').disabled=a.pending;c$('#chat-cancel-login').hidden=!a.pending;c$('#chat-signout').hidden=!a.connected;c$('#chat-refresh').disabled=!a.connected||a.pending||a.loading;
 c$('#chat-plan').hidden=!a.connected||!a.planEnabled;c$('#chat-send').disabled=c.busy||a.pending||!a.connected||!a.model;c$('#chat-stop').hidden=!c.busy&&!c.performing;c$('#chat-working').hidden=!c.busy&&!c.performing;
 c$('#chat-source-links').checked=c.sourceLinks===true;c$('#chat-source-links').disabled=c.busy;
 c$('#chat-search').value=a.capabilities?.search===false?'off':c.searchMode||'auto';c$('#chat-search').disabled=c.busy||a.capabilities?.search===false;
 c$('#chat-working').textContent=c.analyzing?'正在为这段回复配合表情……':c.busy?(c.searchStatus||'正在整理这一句……'):c.performance?(c.performance.mode==='voice'?'正在说':'正在读')+' · '+c.performance.index+'/'+c.performance.total+'：'+c.performance.text.slice(0,80):'正在准备声音……';
 c$('#chat-error').textContent=c.error||'';
 c$('#chat-attach').disabled=c.busy;c$('#chat-screen').disabled=c.busy||(c.draftAttachments||[]).length>=4;c$('#chat-history-more').hidden=c.totalMessages<=c.history.length;
 c$('#chat-session-status').textContent='连续对话 · 已保存 '+c.totalMessages+' 条消息'+(c.continuity?' · 已整理早些的上下文':'');
 c$('#chat-summary-text').textContent=c.continuity||'对话变长后，会在回复时自动整理上下文。';
 const drafts=c$('#chat-attachments');drafts.replaceChildren();for(const a of c.draftAttachments||[]){const item=document.createElement('div');item.className='chat-attachment';if(a.thumbnail){const img=document.createElement('img');img.src=a.thumbnail;img.alt=a.name;item.append(img);}const label=document.createElement('span');label.textContent=a.name;item.append(label,chatButton('移除',()=>chatOperation('attachment-remove',{id:a.id})));drafts.append(item);}
 const ak=JSON.stringify([a.accounts,a.active]);if(ak!==accountKey){accountKey=ak;const select=c$('#chat-account');select.replaceChildren();for(const account of a.accounts){const opt=document.createElement('option');opt.value=account.id;opt.textContent=account.label+(account.signedIn?'':'（已退出）');select.append(opt);}const fresh=document.createElement('option');fresh.value='';fresh.textContent='添加另一个 ChatGPT 账号';select.append(fresh);select.value=a.active||'';}
 const mk=JSON.stringify([a.models,a.model]);if(mk!==modelsKey){modelsKey=mk;const select=c$('#chat-model');select.replaceChildren();if(!a.models.length){const opt=document.createElement('option');opt.value='';opt.textContent='连接后刷新模型，API 也可手填模型';select.append(opt);}for(const model of a.models){const opt=document.createElement('option');opt.value=model.id;opt.textContent=model.label;select.append(opt);}select.value=a.model;select.disabled=!a.models.length||c.busy;}
 if(a.welcome&&welcomeShownFor!==a.active){welcomeShownFor=a.active;if(!c$('#chat-welcome').open)c$('#chat-welcome').showModal();}
 const hk=JSON.stringify([c.profile,c.history]);if(hk!==historyKey){historyKey=hk;const list=c$('#chat-messages'),nearBottom=list.scrollHeight-list.scrollTop-list.clientHeight<80;list.replaceChildren();
  if(!c.history.length){const p=document.createElement('p');p.className='empty';p.textContent='我在。今日有什么想说的？';list.append(p);}
  for(const h of c.history){const item=document.createElement('div'),label=document.createElement('span'),text=document.createElement('div');item.className='chat-message '+h.role;label.className='chat-speaker';label.textContent=h.role==='user'?'你':h.role==='local'?'已完成的操作':c.character.name;text.className='chat-text';renderReplyText(text,h);item.append(label,text);item.append(chatButton('从这里分支',()=>window.JieAmadeus?.branch(h.id)));if(h.role==='assistant'){const feedback=document.createElement('details'),sum=document.createElement('summary');feedback.className='message-feedback';sum.textContent='调整相伴';feedback.append(sum);for(const [kind,title] of [['like','喜欢这次语气'],['shorter','简短些'],['fewer','少主动些'],['quiet','在这个应用里安静些'],['hints','先给线索'],['direct','直接讲解']])feedback.append(chatButton(title,()=>window.JieAmadeus?.feedback(kind,h.id)));item.append(feedback);}for(const [i,m] of (h.memorySources||[]).entries())item.append(chatButton((m.citation||'记忆')+' · 查看原话',()=>window.JieAmadeus?.openMemorySource(m.kind,m.id)));if(h.memoryCorrections?.length){const corrected=document.createElement('small');corrected.textContent='已按你这次的更正更新长期记忆';item.append(corrected);}if(h.knowledgeSources?.length){const sources=document.createElement('small');sources.textContent='参考资料：'+h.knowledgeSources.map(s=>s.title).join(' · ');item.append(sources);}
   if(h.origin==='screen'){const source=document.createElement('small');source.textContent='一起看屏幕 · '+new Date(h.screen?.at||h.at).toLocaleTimeString('zh-CN');item.append(source);}
   if(h.origin==='project'){const origin=document.createElement('small');origin.textContent='共同项目 · 轻轻问一句';item.append(origin);}if(h.origin==='proactive'){const origin=document.createElement('small');origin.textContent='颉主动接话';item.append(origin);}
   if(h.search?.used&&h.search.showLinks===true){const box=document.createElement('div');box.className='chat-sources';const title=document.createElement('small');title.textContent='已联网搜索'+(!h.search.citations?.length?' · 未返回可显示的引用':' · 引用来源');box.append(title);for(const [kind,entries] of [['citations',h.search.citations||[]],['sources',h.search.sources||[]]]){if(!entries.length)continue;const details=document.createElement('details');if(kind==='citations')details.open=true;const summary=document.createElement('summary');summary.textContent=kind==='citations'?'引用来源':'搜索参考页面';details.append(summary);entries.forEach((s,index)=>{const link=document.createElement('a');link.href=s.url;link.textContent=(index+1)+'. '+s.title;link.title=s.url;link.onclick=e=>{e.preventDefault();void chatOperation('source-open',{id:h.id,index,kind});};details.append(link);});box.append(details);}item.append(box);}
   if(h.role==='assistant'&&h.emotionStatus){const status=document.createElement('small');status.textContent=h.emotionStatus;item.append(status);}
   if(h.role==='assistant'&&h.id===c.history.filter(v=>v.role==='assistant').at(-1)?.id){const retry=chatButton('重新配表情',()=>chatOperation('reanalyze'));retry.disabled=c.busy||!a.connected||!a.model;item.append(retry);}
   for(const a of h.attachments||[]){const box=document.createElement('div');box.className='chat-attachment';if(a.thumbnail){const img=document.createElement('img');img.src=a.thumbnail;img.alt=a.name;box.append(img);}const name=document.createElement('span');name.textContent=a.name+(a.missing?'（本机附件不可用）':'');box.append(name);item.append(box);}
   for(const action of h.actions||[]){const card=document.createElement('div'),title=document.createElement('strong'),description=document.createElement('p');card.className='chat-card';title.textContent=({note:'记下一页便签',todo:'添加待办',reminder:'安排提醒',memory:'让颉记住',open_link:'打开已有入口'})[action.type];
    description.textContent=action.type==='open_link'?'快捷入口：'+(action.title||'请确认此入口')+'\n'+action.text:action.type==='reminder'?action.text+'\n'+(action.repeat==='daily'?'每天 '+action.time:new Date(action.at).toLocaleString('zh-CN')):(action.title?action.title+'\n':'')+action.text;card.append(title,description);
    if(action.status==='pending')card.append(chatButton('确认'+({note:'记下',todo:'添加',reminder:'安排',memory:'保存',open_link:'打开'})[action.type],()=>chatOperation('confirm',{id:action.id})),chatButton('不必了',()=>chatOperation('dismiss',{id:action.id})));
    else{const done=document.createElement('small');done.textContent=action.status==='done'?(action.result||'已保存'):action.status==='running'?'正在处理……':'已取消';card.append(done);}item.append(card);
   }list.append(item);
  }if(nearBottom)list.scrollTop=list.scrollHeight;
 }
 const mm=JSON.stringify([c.profile,c.memories]);if(mm!==memoryKey){memoryKey=mm;c$('#memory-count').textContent=c.memories.length+' / 30';const list=c$('#memory-list');list.replaceChildren();for(const m of c.memories){const li=document.createElement('li'),p=document.createElement('p');p.textContent=m.text;li.append(p,chatButton('来源／更正',()=>window.JieAmadeus?.openMemorySource('memory',m.id)),chatButton('忘掉这件事',()=>chatOperation('memory-remove',{id:m.id})));list.append(li);}if(!c.memories.length){const li=document.createElement('li');li.className='empty';li.textContent='还没有记下长期的事。';list.append(li);}}
}

let characterDirty=false,characterKey='';
const characterFields=['name','version','text'];
function setCharacterEditor(card){for(const field of characterFields)c$('#character-'+field).value=card[field];characterDirty=false;characterKey=JSON.stringify(card);characterCount();}
function characterCount(){c$('#character-count').textContent=c$('#character-text').value.length+' / 30000 字'+(characterDirty?' · 有未保存修改':'');}
function renderCharacter(c){
 const card=c.character,key=JSON.stringify(card);c$('#character-active').textContent='当前生效：'+card.name+' · '+card.version;
 if(key!==characterKey&&!characterDirty)setCharacterEditor(card);
 for(const id of ['save','reset','import'])c$('#character-'+id).disabled=c.busy;
}
for(const field of characterFields)c$('#character-'+field).addEventListener('input',()=>{characterDirty=true;characterCount();c$('#character-status').textContent='修改尚未保存。';});
async function characterOperation(operation,input){try{const r=await window.jie.chat(operation,input);if(r?.error)c$('#character-status').textContent=r.error;return r||{};}catch{c$('#character-status').textContent='操作没有完成，请重试。';return {error:true};}}
c$('#character-form').onsubmit=async e=>{e.preventDefault();const card={format:'jie-character-card',format_version:1};for(const field of characterFields)card[field]=c$('#character-'+field).value;
 const r=await characterOperation('character-save',card);if(r.ok){setCharacterEditor(card);c$('#character-status').textContent='已保存，从下一条消息起使用此角色卡。';}
};
c$('#character-revert').onclick=()=>{if(characterDirty&&!confirm('放弃尚未保存的角色卡修改？'))return;setCharacterEditor(chatView.chat.character);c$('#character-status').textContent='已显示当前保存的角色卡。';};
c$('#character-import').onclick=async()=>{if(characterDirty&&!confirm('导入会替换编辑区尚未保存的内容，继续？'))return;const r=await characterOperation('character-import');if(r.ok){setCharacterEditor(r.character);characterDirty=true;characterCount();c$('#character-status').textContent='已载入编辑区；检查后点击“保存并使用”。';}};
c$('#character-export').onclick=async()=>{if(characterDirty&&!confirm('编辑区有未保存修改，本次将导出当前已保存的版本。继续？'))return;const r=await characterOperation('character-export');if(r.ok)c$('#character-status').textContent='已导出当前保存的角色卡。';};
c$('#character-reset').onclick=async()=>{if(!confirm('恢复你提供的颉角色卡 1.0？当前角色设定和未保存修改将被替换，个人记忆及聊天保留。'))return;const r=await characterOperation('character-reset');if(r.ok){setCharacterEditor(chatView.chat.character);c$('#character-status').textContent='已恢复颉角色卡 1.0。';}};

window.jie.onChat(renderChat);window.jie.chatState().then(renderChat);
