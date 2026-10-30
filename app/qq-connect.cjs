'use strict';
// One lifecycle for startup, the Connect button, and reconnection. No chat sends.
class QQConnect {
 constructor(runtime,bridge,{delay=ms=>new Promise(r=>setTimeout(r,ms))}={}){this.q=runtime;this.bridge=bridge;this.delay=delay;this.pending=null;this.generation=0;}
 cancel(){this.generation++;this.bridge.recovery.cancel();this.pending=null;}
 connect(){if(this.pending)return this.pending;const generation=this.generation,task=this.run(generation);this.pending=task;task.finally(()=>{if(this.pending===task)this.pending=null;}).catch(()=>{});return task;}
 async run(generation){const q=this.q,current=()=>generation===this.generation&&q.settings.enabled;
  if(!current())return {ok:false,canceled:true};
  q.error='';q.status='正在启动并连接QQ……';q.emit();
  try{
   if(!q.token)throw Error('请先保存QQ连接密钥。');
   if(this.bridge.selected==='llbot'){
    const result=await this.bridge.recovery.check(q.token,q.settings.url,{force:true});
    if(!current())return {ok:false,canceled:true};
    if(result.phase!=='ready')throw Error(result.message);
   }else await this.bridge.launch(q.token,q.settings.url);
   if(!current())return {ok:false,canceled:true};
   q.transport.start(q.settings.url,q.token);
   for(let i=0;i<120;i++){
    if(!current())return {ok:false,canceled:true};
    if(q.ready&&q.transport.connected){q.error='';q.emit();return {ok:true,result:'QQ已连接，可以收发消息。'};}
    await this.delay(250);
   }
   throw Error('桥接已就绪，但桌宠连接尚未确认；请再点“连接QQ”，无需退出或重填令牌。');
  }catch(e){if(!current())return {ok:false,canceled:true};q.transport.stop();q.error=String(e.message||'QQ连接未完成。');q.status='QQ连接未完成';q.emit();return {ok:false,error:q.error};}
 }
}
module.exports={QQConnect};
