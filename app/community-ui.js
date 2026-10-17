'use strict';
(()=>{
 const env=window.JieCommunity,installed=new Set(env.installed),selected=new Set();
 const allows=ids=>Array.isArray(ids)?ids.some(id=>installed.has(id)):installed.has(ids);
 const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const button=(text,fn)=>{const e=el('button',text);e.type='button';e.onclick=fn;return e;};
 const actions=(...nodes)=>{const row=el('div');row.className='community-actions';row.append(...nodes);return row;};
 const bytes=n=>n<1024*1024?(n/1024).toFixed(0)+' KB':(n/1024/1024).toFixed(1)+' MB';
 for(const id of Object.keys(env.pages))if(!allows(env.pages[id])){
  document.querySelector('[data-page="'+id+'"]')?.classList.add('community-hidden');
  document.getElementById('page-'+id)?.classList.add('community-hidden');
 }
 for(const id of ['speech','assistant','desktop-life','voice','productivity'])if(!installed.has(id))document.body.classList.add('community-no-'+id);
 const article=el('article');article.id='page-community';article.hidden=true;
 const entry=button('功能中心',show);entry.dataset.page='community';entry.setAttribute('aria-controls',article.id);entry.prepend(el('span','＋ '));
 document.querySelector('.tabs').prepend(entry);(document.querySelector('.work-canvas')||document.querySelector('main')).append(article);
 let state;
 const lead=el('section');lead.className='community-card';
 lead.append(el('h2','按需安装，让颉陪你做想做的事'),el('p','基础版保留两种形态、鼠标摆头、身体互动、书案键盘跟随、完整角色卡、文字聊天和记忆。勾选需要的功能后一次安装，全部校验完成后只重启一次。个人资料会保留。'));
 const status=el('p');status.className='community-status';status.role='status';
 const progress=el('progress');progress.id='community-progress';progress.hidden=true;
 const resume=button('继续上次未完成的安装',()=>state?.pending?.[0]&&call('resume',{id:state.pending[0].id}));resume.id='community-resume';resume.hidden=true;
 const overview=el('p');overview.id='community-installed-summary';overview.role='status';
 const missing=el('p');missing.id='community-missing-summary';
 const selection=el('p');selection.id='community-selection-summary';
 const selectAll=button('选择全部未安装功能',()=>{for(const c of state?.components||[])if(!c.installed)selected.add(c.id);render(state);});selectAll.id='community-select-all';
 const clear=button('清空选择',()=>{selected.clear();render(state);});
 const installSelected=button('安装所选功能',()=>call('install-many',{ids:[...selected]}));installSelected.id='community-install-selected';
 const grid=el('div');grid.className='community-grid';
 lead.append(el('p','当前基础版 '+env.version),overview,missing,actions(selectAll,clear,installSelected),selection,actions(button('刷新功能目录',()=>call('refresh')),button('从文件安装功能包',()=>call('import')),button('完整使用说明',()=>call('manual')),button('打开官网下载页',()=>call('releases')),button('打开个人资料目录',()=>call('data'))));
 article.append(lead,status,progress,resume,grid);
 async function call(op,v={}){try{const r=await window.jie.community(op,v);if(r?.error)status.textContent=r.error;else if(r?.result)status.textContent=r.result;return r;}catch{status.textContent='操作没有完成，请稍后重试。';return {error:status.textContent};}}
 function show(){
  document.querySelectorAll('main article').forEach(a=>a.hidden=a!==article);
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('selected',b===entry));
  document.querySelector('main').classList.remove('chat-mode');
  const title=document.getElementById('work-title'),subtitle=document.getElementById('work-subtitle');
  if(title)title.textContent='功能中心';if(subtitle)subtitle.textContent='已安装多少、还缺什么，在这里一次看清。';
  const drawer=document.getElementById('chat-drawer-toggle');if(drawer)drawer.hidden=true;
  void call('state').then(render);
 }
 function selectionPlan(s){const result=new Set(),visit=id=>{if(result.has(id))return;const c=s.components.find(c=>c.id===id);if(!c||c.installed)return;result.add(id);c.dependencies.forEach(visit);};selected.forEach(visit);return s.components.filter(c=>result.has(c.id));}
 function render(s){
  if(!s||!Array.isArray(s.components))return;state=s;
  for(const id of selected)if(!s.components.some(c=>c.id===id&&!c.installed))selected.delete(id);
  const absent=s.components.filter(c=>!c.installed),plan=selectionPlan(s);
  overview.textContent='已安装 '+(s.components.length-absent.length)+' / '+s.components.length+' 项'+(absent.length?' · 其余功能尚不可用':' · 全部可选功能已安装');
  missing.textContent=absent.length?'尚未安装：'+absent.map(c=>c.name).join('、')+'。安装“声音”或“表情素材”不会同时安装其他功能。':'功能已装齐；聊天、QQ、云语音及本机 TTS 仍需配置自己的账号或服务。';
  selection.textContent=plan.length?'所选及依赖共 '+plan.length+' 项，下载约 '+bytes(plan.reduce((n,c)=>n+c.bytes,0))+'；处理完成后统一重启。':'可多选功能；依赖自动补齐，已安装的依赖不会重复下载。';
  selectAll.disabled=clear.disabled=s.busy;installSelected.disabled=s.busy||!plan.length;
  installSelected.textContent=plan.length?'下载并安装所选（'+plan.length+'项）':'安装所选功能';
  resume.hidden=!s.pending?.length;resume.disabled=s.busy;
  if(s.pending?.length)resume.textContent='继续上次安装：'+s.pending[0].title;
  progress.hidden=!s.progress;
  if(s.progress){progress.max=s.progress.total||1;progress.value=s.progress.received||0;status.textContent=(s.progress.phase==='checking'?'正在校验 ':'正在下载 ')+s.progress.name+' · '+Math.round((s.progress.received||0)/Math.max(1,s.progress.total)*100)+'%';}
  else if(s.error)status.textContent=s.error;
  else if(s.lastResult&&!status.textContent)status.textContent=s.lastResult.message+(s.lastResult.ok?'':' 请查看个人资料目录的 community-last-result.json。');
  grid.replaceChildren();
  for(const item of s.components){
   const card=el('section');card.className='community-card';card.dataset.component=item.id;
   const title=el('h3',item.name),tag=el('span',item.installed?'已安装':item.present?'需要更新或修复':'尚未安装');tag.className='community-tag';
   card.append(title,tag,el('p',item.description),el('p','下载约 '+bytes(item.bytes)+' · '+item.version));
   if(item.dependencies.length)card.append(el('p','依赖：'+item.dependencies.map(id=>s.components.find(x=>x.id===id)?.name||id).join('、')+'（会一起安装）'));
   const label=el('label','加入本次安装 ');label.className='community-pick';const pick=el('input');pick.type='checkbox';pick.checked=selected.has(item.id);pick.disabled=s.busy||item.installed;pick.setAttribute('aria-label','选择'+item.name);pick.onchange=()=>{pick.checked?selected.add(item.id):selected.delete(item.id);render(state);};label.prepend(pick);if(!item.installed)card.append(label);
   const install=button(item.installed?'重新安装／修复':item.present?'更新／修复':'单独下载安装',()=>call('install',{id:item.id}));
   const remove=button('卸载功能',async()=>{if(confirm('卸载“'+item.name+'”会重启基础版，个人设置和历史记录保留。继续吗？'))await call('uninstall',{id:item.id});});
   install.disabled=remove.disabled=s.busy;remove.hidden=!item.present;card.append(actions(install,remove));grid.append(card);
  }
 }
 // Read-only resource accounting remains available in the modular edition.
 // Legacy component/update controls use another receipt format, so direct them to this center.
 const resources=el('details');resources.id='community-resources-panel';resources.append(el('summary','资源占用、组件与更新'));
 const usage=el('div');resources.append(usage,actions(button('检查实际资源占用',async()=>{usage.textContent='正在检查…';const r=await call('resources');if(r?.items){usage.replaceChildren(...r.items.map(item=>el('p',item.name+'：'+bytes(item.bytes))));}else usage.textContent=r?.error||'检查未完成。';}),button('安装、卸载或修复功能包',show),button('打开基础版更新下载页',()=>call('releases')),button('打开 TTS 安装向导',()=>call('tts-setup'))),el('p','功能包统一由功能中心管理；卸载保留个人资料。独立 TTS 及训练资料另行配置，不随基础版发布。'));
 document.getElementById('page-settings')?.prepend(resources);
 const oldResources=document.getElementById('resource-manager-panel');if(oldResources)oldResources.classList.add('community-hidden');
 document.addEventListener('click',e=>{const link=e.target.closest('[data-page]');if(!link||link===entry)return;const need=env.pages[link.dataset.page];if(need&&!allows(need)){e.preventDefault();e.stopImmediatePropagation();show();status.textContent='请先安装对应功能包。';}},true);
 window.jie.onCommunity(render);window.jie.community('state').then(render).catch(()=>{});
 for(const [selector,need]of [['#leisure-go','games'],['#leisure-story','games'],['#leisure-ambient','games'],['#leisure-plant','desktop-life'],['#interaction-drop','assistant'],['#interaction-gomoku','games'],['#interaction-wake','speech']]){const node=document.querySelector(selector);if(node&&!installed.has(need))node.classList.add('community-hidden');}
 const current=document.querySelector('[data-page].selected');if(current?.classList.contains('community-hidden'))document.querySelector('[data-page=chat]')?.click();
})();
