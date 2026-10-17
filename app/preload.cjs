'use strict';
const {contextBridge,ipcRenderer,webUtils}=require('electron');
const subscribe=(channel,callback)=>{const handler=(_event,value)=>callback(value);ipcRenderer.on(channel,handler);return()=>ipcRenderer.removeListener(channel,handler);};
contextBridge.exposeInMainWorld('jie',{
 atelier:(op,v)=>ipcRenderer.invoke('atelier',op,v),onAtelier:cb=>subscribe('atelier-state',cb),
 community:(op,v)=>ipcRenderer.invoke('community-components',op,v),onCommunity:cb=>subscribe('community-state',cb),
 musicTrack:(op,v)=>ipcRenderer.invoke('music-track',op,v),onMusicTrack:cb=>subscribe('music-track-state',cb),
 qq:(op,v)=>ipcRenderer.invoke('qq',op,v),onQQ:cb=>subscribe('qq-state',cb),
 weather:(op,v)=>ipcRenderer.invoke('weather',op,v),onWeather:cb=>subscribe('weather-state',cb),
 leisure:(operation,input)=>ipcRenderer.invoke('leisure',operation,input),onLeisure:callback=>subscribe('leisure-state',callback),onAmbient:callback=>subscribe('ambient-state',callback),
 interaction:(operation,input)=>ipcRenderer.invoke('interaction',operation,input),onInteraction:callback=>subscribe('interaction-state',callback),dropFiles:files=>ipcRenderer.invoke('pet-drop-files',Array.from(files).map(file=>webUtils.getPathForFile(file))),
 companionTools:(operation,input)=>ipcRenderer.invoke('companion-tools',operation,input),onCompanionTools:callback=>subscribe('companion-tools-state',callback),onReviewSource:callback=>subscribe('review-source',callback),
 lifeGame:(operation,input)=>ipcRenderer.invoke('life-game',operation,input),onLifeGame:callback=>subscribe('life-game-state',callback),
 growth:(operation,input)=>ipcRenderer.invoke('growth',operation,input),onGrowth:callback=>subscribe('growth-state',callback),inspiration:(operation,input)=>ipcRenderer.invoke('inspiration-card',operation,input),onInspiration:callback=>subscribe('inspiration-card',callback),life:(operation,input)=>ipcRenderer.invoke('life',operation,input),onLife:callback=>subscribe('life-state',callback),lifeProp:operation=>ipcRenderer.invoke('life-prop',operation),onLifeProp:callback=>subscribe('life-prop-state',callback),
 assistant:(operation,input)=>ipcRenderer.invoke('assistant',operation,input),onAssistant:callback=>subscribe('assistant-state',callback),onScreenMarks:callback=>subscribe('screen-marks',callback),extension:(operation,input)=>ipcRenderer.invoke('extension',operation,input),onExtensionDraft:callback=>subscribe('extension-draft',callback),snapshot:()=>ipcRenderer.invoke('get-snapshot'),command:name=>ipcRenderer.send('command',name),
 touch:part=>ipcRenderer.send('body-touch',part),shortcuts:(operation,input)=>ipcRenderer.invoke('shortcuts',operation,input),settings:value=>ipcRenderer.send('settings',value),petPointer:pressed=>ipcRenderer.send('pet-pointer',pressed),hit:value=>ipcRenderer.send('hit',value),
 todo:(operation,value)=>ipcRenderer.send('todo',operation,value),
 utility:(operation,input)=>ipcRenderer.invoke('utility',operation,input),note:()=>ipcRenderer.invoke('get-note'),
 voiceState:()=>ipcRenderer.invoke('get-voice'),voice:(operation,input)=>ipcRenderer.invoke('voice',operation,input),onVoiceState:callback=>subscribe('voice-state',callback),onVoiceAudio:callback=>subscribe('voice-audio',callback),voicePlayback:(id,type,error)=>ipcRenderer.send('voice-playback',id,type,error),
 chatState:()=>ipcRenderer.invoke('get-chat'),chat:(operation,input)=>ipcRenderer.invoke('chat',operation,input),onWatch:callback=>subscribe('watch-state',callback),onChat:callback=>subscribe('chat-state',callback),onSpeechText:callback=>subscribe('speech-text',callback),onPage:callback=>subscribe('show-page',callback),
 editNote:value=>ipcRenderer.send('note-edit',value),onNote:callback=>subscribe('note-update',callback),
 menu:()=>ipcRenderer.send('context-menu'),dragStart:packet=>ipcRenderer.send('drag-start',packet),dragAnchor:packet=>ipcRenderer.send('drag-anchor',packet),dragEnd:()=>ipcRenderer.send('drag-end'),
 onTyping:callback=>subscribe('typing-activity',callback),
 onSnapshot:callback=>subscribe('snapshot',callback),onCursor:callback=>subscribe('cursor',callback)
});
