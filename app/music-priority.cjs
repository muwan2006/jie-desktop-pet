'use strict';
function recordingMusic(s){
 // Only the passive music animation may continue through the Windows
 // recording selector. The caller's background/notification gate stays closed.
 return s.musicPriority&&s.desktopFullscreen===true&&!s.quietApp&&s.backgroundReason==='前台应用正在全屏'&&/^(?:SnippingTool|ScreenClippingHost)(?:\.exe)?$/i.test(s.desktopProcess||'');
}
function lifeBlocked(s){
 const {engine:e,now,musicPriority:m}=s;
 return !!(s.drag||!s.background&&!recordingMusic(s)||s.chatBusy||s.preparingChat||s.performanceActive||s.voiceBusy||s.speechInput||s.tasksBusy||e.mode==='rest'||e.emotionHold||e.bodyMotion||e.emote&&!['automatic','ambient','daily','music'].includes(e.emote.source)||!m&&(e.focus||e.deskGesture||e.action.until>now)||e.messageUntil>now&&e.lastSpeechSource!=='game'&&(!m||!['ambient','reminder','notification','music-comment'].includes(e.lastSpeechSource)));
}
module.exports={lifeBlocked};
