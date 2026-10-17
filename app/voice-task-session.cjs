'use strict';
class VoiceTaskSession{
 constructor(hooks={}){this.hooks=hooks;this.active=false;this.owner=null;this.timer=null;this.started=0;this.turns=0;this.processing=false;this.status='';this.idleAt=0;}
 snapshot(){return {active:this.active,status:this.status,turns:this.turns};}
 start(){if(this.active)throw Error('连续语音已经开启。');const speech=this.hooks.speech();if(speech.session||this.hooks.busy())throw Error('请先结束当前收音或任务。');if(!speech.command().local)throw Error('连续语音需要本地 Whisper；普通按键语音仍可使用 Windows 识别。');this.hooks.interrupt();this.active=true;this.owner={...this.hooks.owner()};this.started=Date.now();this.turns=0;this.processing=false;this.idleAt=0;this.status='连续语音已开启；停顿约1秒会提交，按快捷键或停止按钮结束。';this.listen();if(!this.active)return {error:this.status};this.timer=setInterval(()=>this.tick(),200);this.timer.unref?.();this.hooks.onChange?.();return {ok:true};}
 same(){const owner=this.hooks.owner();return owner.profile===this.owner?.profile&&owner.thread===this.owner?.thread;}
 listen(){if(!this.active||!this.same())return;const result=this.hooks.speech().start(this.owner.profile,{route:'desktop',endpoint:true});if(result?.error)this.stop(result.error);else this.idleAt=0;}
 accepted(){if(this.active){this.processing=true;this.turns++;this.hooks.onChange?.();}}
 handled(){this.processing=false;this.idleAt=Date.now();}
 tick(){if(!this.active)return;if(!this.same()||Date.now()-this.started>10*60000||this.turns>=30){this.stop('连续语音已结束，需要时可重新开启。');return;}const speech=this.hooks.speech();if(speech.session||this.processing||this.hooks.busy()||this.hooks.voiceBusy()){this.idleAt=0;return;}if(speech.error||!speech.text){this.stop(speech.error||'没有听到后续说话，已关闭麦克风。');return;}if(!this.idleAt)this.idleAt=Date.now();if(Date.now()-this.idleAt>=800)this.listen();}
 stop(message='连续语音已停止。'){this.active=false;clearInterval(this.timer);this.timer=null;this.processing=false;this.status=message;if(this.hooks.speech()?.session?.route==='desktop')this.hooks.speech().cancel();this.hooks.onChange?.();return {ok:true};}
}
module.exports={VoiceTaskSession};
