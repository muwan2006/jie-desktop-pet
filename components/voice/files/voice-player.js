'use strict';
let currentVoice=null;
function stopVoicePlayer(){if(currentVoice){currentVoice.pause();currentVoice.src='';currentVoice.load();currentVoice=null;}document.body.classList.remove('speaking');}
window.jie.onVoiceAudio(async event=>{
 if(event.type==='stop'){stopVoicePlayer();return;}
 if(event.type!=='play'||typeof event.data!=='string'||event.data.length>24000000)return;
 stopVoicePlayer();const player=new Audio('data:audio/wav;base64,'+event.data);currentVoice=player;player.volume=Math.min(1,Math.max(0,event.volume||0));
 player.playbackRate=Number.isFinite(event.rate)?Math.min(1.3,Math.max(.7,event.rate)):1;
 const done=(type,error)=>{if(currentVoice!==player)return;stopVoicePlayer();window.jie.voicePlayback(event.id,type,error);};
 player.onplaying=()=>{if(currentVoice===player)window.jie.voicePlayback(event.id,'started');};
 player.onended=()=>done('ended');player.onerror=()=>done('error','声音播放失败。请检查输出设备。');
 try{await player.play();if(currentVoice===player)document.body.classList.add('speaking');else player.pause();}catch{done('error','声音未能播放，请检查输出设备。');}
});
function layoutVoiceBadge(){
 const badge=document.querySelector('#voice-badge'),bubble=document.querySelector('#bubble');
 if(!bubble||badge.hidden||typeof bubble.getBoundingClientRect!=='function')return;
 const rect=bubble.getBoundingClientRect();badge.style.top=(bubble.hidden?6:Math.ceil(rect.bottom+8))+'px';
}
if(typeof ResizeObserver==='function'){const bubble=document.querySelector('#bubble');if(bubble){new ResizeObserver(layoutVoiceBadge).observe(bubble);new MutationObserver(layoutVoiceBadge).observe(bubble,{attributes:true,childList:true,characterData:true,subtree:true});}}
if(typeof window.addEventListener==='function')window.addEventListener('resize',layoutVoiceBadge);
function voiceBadge(state){const badge=document.querySelector('#voice-badge');badge.hidden=state.state==='idle';badge.textContent=state.state==='generating'?'生成声音中 · 点击停止':'正在说话'+(state.sequence?' '+state.sequence.index+'/'+state.sequence.total:'')+' · 点击停止';layoutVoiceBadge();}
window.jie.onVoiceState(voiceBadge);window.jie.voiceState().then(voiceBadge);
document.querySelector('#voice-badge').onclick=()=>window.jie.voice('stop');
