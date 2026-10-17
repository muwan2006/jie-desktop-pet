(function(root){
 'use strict';
 const definitions=[
  {id:'reveal',scope:'global',label:'把她叫回来',key:'Control+Alt+J'},
  {id:'chat',scope:'global',label:'打开聊天',key:'Control+Alt+C'},
  {id:'voiceCall',scope:'global',label:'持续语音通话（接通／挂断）',key:'Control+Alt+V'},
  {id:'desktopVoice',scope:'global',label:'语音办事（开始／结束）',key:'Control+Alt+Space'},
  {id:'stopVoice',scope:'global',label:'停止声音和回复',key:'Control+Alt+X'},
  {id:'switchForm',scope:'global',label:'切换形态',key:'Control+Alt+F'},
  {id:'fade',scope:'global',label:'临时半透明并穿透（20秒／恢复）',key:'Control+Alt+H'},
  {id:'toggleVisible',scope:'global',label:'显示／隐藏桌宠',key:''},
  {id:'screenShare',scope:'global',label:'给她看看屏幕',key:''},
  {id:'selection',scope:'global',label:'选中文字交给她',key:''},
  {id:'quiet',scope:'global',label:'安静陪伴30分钟',key:''},
  {id:'mute',scope:'global',label:'开关声音',key:''},
  {id:'send',scope:'chat',label:'发送消息',key:'Enter'},
  {id:'newline',scope:'chat',label:'输入框换行',key:'Shift+Enter'},
  {id:'stopReply',scope:'chat',label:'停止回复或语音输入',key:'Escape'},
  {id:'focusChat',scope:'chat',label:'聚焦聊天输入框',key:'Control+L'},
  {id:'replay',scope:'chat',label:'重播上一条回复',key:'Control+Shift+P'}
 ];
 const defaults=Object.fromEntries(definitions.map(d=>[d.id,d.key]));
 const modifiers=['Control','Alt','Shift','Super'];
 function normalize(value,scope='chat'){
  if(value==='')return '';if(typeof value!=='string'||value.length>100)return null;
  const chunks=value.split('+'),key=chunks.pop();if(new Set(chunks).size!==chunks.length||chunks.some(c=>!modifiers.includes(c)))return null;
  if(!/^[A-Z0-9]$|^F(?:[1-9]|1[0-9]|2[0-4])$|^(Enter|Escape|Space|Tab|Up|Down|Left|Right|Home|End|PageUp|PageDown|Insert|Delete|Backspace)$/.test(key))return null;
  if(scope==='global'&&!chunks.some(c=>['Control','Alt','Super'].includes(c))&&!/^F\d+$/.test(key))return null;
  if(scope==='chat'&&!chunks.some(c=>['Control','Alt','Super'].includes(c))&&!['Enter','Escape'].includes(key)&&!/^F\d+$/.test(key))return null;
  return [...modifiers.filter(m=>chunks.includes(m)),key].join('+');
 }
 function fromEvent(event){
  if(event.isComposing||event.keyCode===229)return null;
  let key=/^Key[A-Z]$/.test(event.code)?event.code.slice(3):/^Digit\d$/.test(event.code)?event.code.slice(5):({ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right',' ':'Space',NumpadEnter:'Enter'})[event.code]||event.key;
  if(key?.length===1)key=key.toUpperCase();if(['Control','Alt','Shift','Meta','AltGraph','Process','Dead'].includes(key))return null;
  return [...[event.ctrlKey&&'Control',event.altKey&&'Alt',event.shiftKey&&'Shift',event.metaKey&&'Super'].filter(Boolean),key].join('+');
 }
 function matches(event,key){return !!key&&fromEvent(event)===key;}
 function label(key){return key?key.replace(/Control/g,'Ctrl').replace(/Super/g,'Win').replace(/Enter/g,'回车').replace(/Escape/g,'Esc').replace(/\+/g,' + '):'未设置';}
 function validate(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return {error:'快捷键设置无效。'};
  const result={},used=new Map();
  for(const d of definitions){const key=normalize(input[d.id]??defaults[d.id],d.scope);if(key===null)return {error:d.label+'：请使用有效组合键。'};if(key&&used.has(key))return {error:d.label+' 与 '+used.get(key)+' 的快捷键重复。'};if(key)used.set(key,d.label);result[d.id]=key;}
  return {keys:result};
 }
 const api={definitions,defaults,normalize,fromEvent,matches,label,validate};if(typeof module==='object'&&module.exports)module.exports=api;else root.JieKeys=api;
})(typeof globalThis==='object'?globalThis:this);
