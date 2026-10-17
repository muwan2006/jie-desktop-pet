'use strict';
(()=>{
 const controls=[];
 function element(tag,text){const e=document.createElement(tag);if(text)e.textContent=text;return e;}
 for(const host of document.querySelectorAll('[data-speech-controls]')){
  const callSpeed=element('select');callSpeed.setAttribute('aria-label','通话识别偏好');for(const [value,label] of [['fast','速度优先'],['accurate','准确优先']]){const o=element('option',label);o.value=value;callSpeed.append(o);}const speedLabel=element('label','通话识别偏好');speedLabel.className='voice-field';speedLabel.append(callSpeed);
  const engine=element('select'),device=element('select'),refresh=element('button','刷新收音设备'),meter=element('progress'),info=element('p'),error=element('p');
  engine.setAttribute('aria-label','语音识别方式');device.setAttribute('aria-label','收音设备');meter.setAttribute('aria-label','麦克风输入音量');meter.max=100;meter.value=0;info.className='hint';error.className='error';refresh.type='button';
  for(const [value,label] of [['auto','自动（优先本地 Whisper）'],['local','本地 Whisper'],['windows','Windows 系统听写']]){const o=element('option',label);o.value=value;engine.append(o);}
  for(const [label,input] of [['语音识别',engine],['收音设备',device]]){const l=element('label',label);l.className='voice-field';l.append(input);host.append(l);}
  host.append(speedLabel);
  const automatic=element('input');automatic.type='checkbox';const autoLabel=element('label','语音办事结束后自动理解并执行');autoLabel.append(automatic);host.append(autoLabel,refresh,meter,info,error);automatic.onchange=()=>call('speech-settings',{desktopAutoSend:automatic.checked});
  let working=false;
  async function call(op,input){working=true;refresh.disabled=true;try{const r=await window.jie.assistant(op,input);error.textContent=r?.error||'';return r||{};}catch{error.textContent='收音设置没有完成，请重试。';return {};}finally{working=false;refresh.disabled=false;}}
  refresh.onclick=()=>call('speech-probe');engine.onchange=async()=>{const r=await call('speech-settings',{engine:engine.value,...(engine.value==='windows'?{device:''}:{})});if(r.ok)await call('speech-probe');};device.onchange=()=>call('speech-settings',{device:device.value});
  callSpeed.onchange=()=>call('speech-settings',{callSpeed:callSpeed.value});controls.push({callSpeed,automatic,engine,device,refresh,meter,info,error,key:'',working:()=>working});
 }
 function render(state){const s=state.speechInput||state.speech;if(!s)return;for(const c of controls){c.callSpeed.value=s.settings.callSpeed||'fast';c.callSpeed.disabled=!!s.active;c.automatic.checked=s.settings.desktopAutoSend!==false;c.automatic.disabled=!!s.active;c.engine.value=s.settings.engine||'auto';c.engine.disabled=!!s.active;c.device.disabled=!!s.active||s.engine==='windows';c.refresh.disabled=!!s.active||c.working();c.meter.value=s.level||0;
   const key=JSON.stringify([s.devices,s.settings.device]);if(key!==c.key){c.key=key;c.device.replaceChildren();const automatic=element('option','自动收音（通话优先单一 USB 麦克风）');automatic.value='';c.device.append(automatic);for(const d of s.devices||[]){const o=element('option',d.name+(d.default?'（系统默认）':'')+' · '+d.host);o.value=d.id;c.device.append(o);}const selected=s.settings.device||'';if(selected&&![...c.device.options].some(o=>o.value===selected)){const missing=element('option','已选设备未连接，请刷新');missing.value=selected;c.device.append(missing);}c.device.value=selected;}
   c.info.textContent=(s.engine==='local'?'本地识别 · 录音不上传':'Windows 听写 · 录音不上传')+(s.deviceName?' · '+s.deviceName:'')+(s.active?' · 输入音量 '+(s.level||0)+'%':'');if(s.probeError)c.error.textContent=s.probeError;
  }}
 window.jie.onChat?.(render);window.jie.onAssistant?.(render);window.jie.assistant('state').then(render);
})();
