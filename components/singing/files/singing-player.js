'use strict';
const singingAudio=document.getElementById('singing-audio');let singingPlayId=null;
window.jie.onSingingAudio(async event=>{singingAudio.pause();singingAudio.removeAttribute('src');singingAudio.load();singingPlayId=event.id;if(event.type!=='play')return;singingAudio.src=event.url;singingAudio.volume=event.volume;try{await singingAudio.play();}catch{if(singingPlayId===event.id)window.jie.singingPlayback(event.id,'error');}});
singingAudio.onended=()=>window.jie.singingPlayback(singingPlayId,'ended');singingAudio.onerror=()=>window.jie.singingPlayback(singingPlayId,'error');
