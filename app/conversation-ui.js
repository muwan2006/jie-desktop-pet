'use strict';
(()=>{
 const $=s=>document.querySelector(s);let state=null,held=false,request=0,sessionId=null,closing=false;const button=$('#chat-talk');
 const call=async(op,input)=>{try{const r=await window.jie.chat(op,input);if(r?.error)$('#speech-status').textContent=r.error;return r||{};}catch{return {error:'语音输入没有完成。'};}};
 async function begin(){if(held||closing||!state?.auth.connected||!state.auth.model)return;held=true;const sequence=++request;button.setAttribute('aria-pressed','true');$('#speech-status').textContent='正在打开麦克风……';const r=await call('speech-start');if(sequence!==request){if(r.id)void call('speech-cancel');return;}if(r.error){held=false;button.setAttribute('aria-pressed','false');return;}sessionId=r.id;if(!held)await call('speech-stop',{id:sessionId});}
 function release(){held=false;button.setAttribute('aria-pressed','false');if(sessionId)void call('speech-stop',{id:sessionId});}
 function cancel(){held=false;sessionId=null;request++;button.setAttribute('aria-pressed','false');void call('speech-cancel');}
 button.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();button.focus();button.setPointerCapture(e.pointerId);void begin();});button.addEventListener('pointerup',e=>{e.preventDefault();release();});button.addEventListener('pointercancel',cancel);button.addEventListener('lostpointercapture',()=>{if(held)release();});
 button.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat){e.preventDefault();void begin();}});button.addEventListener('keyup',e=>{if(e.code==='Space'){e.preventDefault();release();}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(held||state?.speechInput?.active)){e.preventDefault();cancel();}});window.addEventListener('blur',()=>{if(held)cancel();});window.addEventListener('beforeunload',()=>{closing=true;if(held||state?.speechInput?.active)cancel();});
 $('#speech-language').onchange=()=>call('speech-settings',{language:$('#speech-language').value});$('#speech-auto').onchange=()=>call('speech-settings',{autoSend:$('#speech-auto').checked});
 $('#followup-save').onclick=async()=>{const r=await window.jie.chat('followup-settings',{enabled:$('#followup-enabled').checked,minutes:Number($('#followup-minutes').value),start:$('#followup-start').value,end:$('#followup-end').value});if(r?.error)$('#followup-status').textContent=r.error;};
 let settingsKey='',speechSettingsKey='',profile='';
 function render(s){state=s;const mic=s.speechInput||{settings:{language:'zh-CN',autoSend:true}},follow=s.followup||{settings:{enabled:true,minutes:60,start:'09:00',end:'22:00'}};
  if(profile&&profile!==s.chat.profile){held=false;sessionId=null;request++;}profile=s.chat.profile;
  button.disabled=!s.auth.connected||!s.auth.model||!!mic.stopping;button.textContent=mic.active?(mic.stopping?'正在识别……':!mic.ready?'正在打开麦克风……':'松开结束'):'按住说话';button.setAttribute('aria-pressed',String(held&&mic.active));
  $('#speech-status').textContent=mic.error||mic.status||'';$('#speech-live').textContent=mic.active?([mic.text,mic.partial].filter(Boolean).join('，')):'';
  if(!mic.active&&sessionId){sessionId=null;held=false;}
  const sk=JSON.stringify(mic.settings);if(sk!==speechSettingsKey){speechSettingsKey=sk;$('#speech-language').value=mic.settings.language;$('#speech-auto').checked=mic.settings.autoSend;}
  $('#speech-language').disabled=mic.active;$('#speech-auto').disabled=mic.active;
  const key=JSON.stringify(follow.settings);if(key!==settingsKey){settingsKey=key;$('#followup-enabled').checked=follow.settings.enabled;$('#followup-minutes').value=String(follow.settings.minutes);$('#followup-start').value=follow.settings.start;$('#followup-end').value=follow.settings.end;}
  $('#followup-status').textContent=follow.status||'';
 }
 window.jie.onSpeechText?.(result=>{if(result.profile!==state?.chat.profile)return;if(!result.autoSend){const input=$('#chat-input');input.value=(input.value?input.value+'\n':'')+result.text;input.focus();}else $('#speech-status').textContent='已识别，正在发送……';});
 window.jie.onChat(render);window.jie.chatState().then(render);
})();
