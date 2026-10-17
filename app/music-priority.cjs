'use strict';
function lifeBlocked(s){
 const {engine:e,now,musicPriority:m}=s;
 return !!(s.drag||!s.background||s.chatBusy||s.preparingChat||s.performanceActive||s.voiceBusy||s.speechInput||s.tasksBusy||e.mode==='rest'||e.emotionHold||e.bodyMotion||e.emote&&!['automatic','ambient','daily','music'].includes(e.emote.source)||!m&&(e.focus||e.deskGesture||e.action.until>now)||e.messageUntil>now&&e.lastSpeechSource!=='game'&&(!m||!['ambient','reminder','notification','music-comment'].includes(e.lastSpeechSource)));
}
module.exports={lifeBlocked};
