'use strict';
const {QQTransport}=require('./qq-transport.cjs');
const cold=text=>/active send not ready|native (?:api|service).*not ready|发送通道.*未.*(?:就绪|初始化)/i.test(String(text));
function probe(url,token,expected,{Transport=QQTransport,timeout=25000}={}){
 return new Promise(resolve=>{let done=false,t;const finish=value=>{if(done)return;done=true;clearTimeout(timer);t?.stop();resolve(value);},timer=setTimeout(()=>finish({ok:false,kind:'timeout',message:'消息通道检查超时。'}),timeout);timer.unref?.();
  t=new Transport({state:v=>{if(v.error)finish({ok:false,kind:'unavailable',message:'消息端口尚未就绪。'});},open:async()=>{try{const info=await t.request('get_login_info',{},18000),account=String(info?.user_id||'');if(account!==expected){finish({ok:false,kind:account?'wrong-account':'offline',account,message:account?'桥接账号与颉的专用账号不一致。':'桥接尚未取得QQ登录状态。'});return;}const groups=await t.request('get_group_list',{},6000);finish({ok:true,kind:'ready',account,groups:Array.isArray(groups)?groups.length:0});}catch(e){finish({ok:false,kind:cold(e.message)?'cold':'unavailable',message:cold(e.message)?'QQ已在线，但消息通道尚未初始化。':'消息接口暂未通过检查。'});}}});try{t.start(url,token);}catch{finish({ok:false,kind:'unavailable',message:'本机桥接地址不可用。'});}
 });
}
class BridgeRecovery{
 constructor(h){this.h=h;this.running=null;this.nextAt=0;this.warmed=new Set();this.lastLaunch=0;this.generation=0;this.state={phase:'unchecked',message:'尚未检查消息通道。',checkedAt:0};}
 mark(phase,message){const now=this.h.now?.()||Date.now();this.state={phase,message,checkedAt:now};if(['starting','waiting'].includes(phase))this.nextAt=Math.min(this.nextAt||now+10000,now+10000);this.h.change?.();return {...this.state};}
 cancel(){this.generation++;this.running=null;this.nextAt=Date.now()+60000;}
 tick(now,token,url){if(now<this.nextAt||this.running||!this.h.allowed())return;this.nextAt=now+60000;void this.check(token,url).catch(()=>this.mark('error','连接自检未完成，可点“一键检查并恢复”。'));}
 check(token,url,{force=false}={}){if(this.running)return this.running;const task=this.run(token,url,force);this.running=task;task.finally(()=>{if(this.running===task)this.running=null;}).catch(()=>{});return task;}
 async run(token,url,force=false){
  const generation=this.generation,current=()=>generation===this.generation&&this.h.allowed(),canceled=()=>({phase:'disabled',message:'QQ连接已停用。'});
  if(!token||!current())return canceled();
  let binding=this.h.binding();const owner=String(this.h.owner()||'');
  if(!binding||!/^\d{5,15}$/.test(binding.expectedQQ)||binding.expectedQQ===owner)return this.mark('unbound','请先确认颉的专用QQ窗口；不会连接主人账号。');
  const expected=binding.expectedQQ;this.mark('starting','正在启动QQ消息服务……');
  try{if(this.h.ensure)await this.h.ensure(token,url);}catch(e){if(!current())return canceled();return this.mark('error',String(e.message||'QQ消息服务启动失败。').slice(0,200));}
  if(!current())return canceled();
  binding=this.h.binding()||binding;
  let health;try{health=await this.h.health();}catch{}
  if(!health&&!this.h.ensure){try{await this.h.launch(token,url);health=await this.h.health();}catch(e){if(!current())return canceled();return this.mark('starting',String(e.message||'正在等待桥接启动。').slice(0,200));}}
  if(!current())return canceled();
  if(!health)return this.mark('error','底层服务未启动成功，请再点“连接QQ”；无需退出QQ或重填令牌。');
  const key=[binding.pid,binding.creation,this.h.instance?.()||''].join(':');if(force)this.warmed.delete(key);
  const tries=this.h.ensure?12:1;let last;
  for(let i=0;i<tries;i++){
   if(!current())return canceled();
   if(i)try{health=await this.h.health();}catch{return this.mark('error','QQ底层服务已退出，请再点“连接QQ”重新启动。');}
   const uin=String(health.uin||'');
   if(uin&&uin!==expected)return this.mark('wrong-account','当前底层QQ与颉的专用账号不一致，未进行窗口操作。');
   this.mark('checking','正在确认QQ账号和消息接口……');last=await this.h.probe(url,token,expected);
   if(!current())return canceled();
   if(last.ok)return this.mark('ready','QQ已连接，账号与群列表接口检查通过。');
   if(last.kind==='wrong-account')return this.mark('wrong-account',last.message);
   const mayWarm=uin===expected&&Number(health.qq_pid)===binding.pid&&(last.kind==='cold'||!health.uid||last.kind==='unavailable'&&Number(health.uptime_secs)<180);
   if(mayWarm&&!this.warmed.has(key)){
    this.warmed.add(key);if(this.warmed.size>20)this.warmed.delete(this.warmed.values().next().value);
    this.mark('warming','正在初始化QQ消息接口……');
    try{await this.h.warm(health);}catch(e){if(!current())return canceled();return this.mark('manual',String(e.message||'QQ消息接口初始化失败。').slice(0,200));}
    if(!current())return canceled();await this.h.delay(700);
    last=await this.h.probe(url,token,expected);if(!current())return canceled();
    if(last.ok)return this.mark('ready','QQ已连接，消息接口初始化完成。');
   }
   if(i+1<tries)await this.h.delay(700);
  }
  return this.mark('error',String(health.uin||'')? 'QQ已登录，但消息接口未就绪。再次点击“连接QQ”会重新检查并初始化，不必操作其他按钮。':'QQ尚未登录颉的专用账号，请打开QQ完成登录后点“连接QQ”。');
 }

}
module.exports={BridgeRecovery,probe,cold};
