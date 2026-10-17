'use strict';
const C=require('./qq-connections.cjs'),S=require('./qq-state.cjs');
function state(q){return q.connectionHealth??=( {phase:'unchecked',started:false,checkedAt:0,nextAt:0,failures:0,disconnects:0,checks:0,onlineChecks:0,version:'',backend:C.kind(q.settings.bridgeKind),lastAccount:'',busy:false} );}
function extend(Runtime){const p=Runtime.prototype,opened=p.opened,snapshot=p.snapshot,tick=p.tick,operation=p.operation,disconnected=p.disconnected;
 p.checkConnection=async function(){const h=state(this);if(h.busy)return {ok:true,check:'正在检查QQ连接。'};if(!this.transport.connected)return {ok:true,check:'本机桥接尚未连接。'};h.busy=true;const epoch=this.epoch,backend=this.settings.bridgeKind,expected=this.self||h.lastAccount;
  try{const [status,info]=await Promise.allSettled([this.transport.request('get_status',{},6000),this.transport.request('get_login_info',{},6000)]);if(epoch!==this.epoch||backend!==this.settings.bridgeKind)return {ok:true,check:'检查时连接已变化，请重试。'};h.checkedAt=this.now();h.checks++;const id=info.status==='fulfilled'?S.qq(info.value?.user_id):'',online=status.status==='fulfilled'?status.value?.online:undefined;
   if(id===this.settings.owner||expected&&id&&id!==expected){this.disconnected();h.phase='wrong-account';this.status='桥接返回了不同账号，请确认登录的是颉的QQ后重新连接。';this.error=this.status;this.transport.stop();this.emit();return {ok:true,check:this.status};}
   if(online===false||info.status==='fulfilled'&&!id){if(this.ready)this.disconnected();h.phase='offline';h.failures=0;this.status='桥接服务正常，QQ账号离线；请在管理页重新登录。';this.emit();return {ok:true,check:this.status};}
   if(info.status==='rejected'||status.status==='rejected'&&!/接口未开放|1404|404|不支持|unsupported|not supported/i.test(status.reason?.message||'')){h.failures++;h.phase='unknown';if(h.failures>=2&&this.ready)this.disconnected();this.status='QQ在线状态暂时无法确认，正在等待下一次检查。';this.emit();return {ok:true,check:this.status};}
   h.lastAccount=id;h.failures=0;h.phase=online===true?'online':'limited';if(online===true)h.onlineChecks++;if(!this.ready)await opened.call(this);this.status=h.phase==='online'?'桥接返回的QQ账号一致且在线，连接正常。':'账号一致；当前桥接未提供在线状态。';this.emit();return {ok:true,check:this.status};
  }finally{h.busy=false;h.nextAt=this.now()+30000;}
 };
 p.opened=async function(){const h=state(this);this.ready=false;h.started=true;h.phase='checking';h.lastAccount='';h.failures=0;await this.checkConnection();if(h.phase==='wrong-account')throw Error('当前登录的是你的账号或与已确认账号不一致，请换成专门给颉的账号。');if(this.ready){const epoch=this.epoch;try{const v=await this.transport.request('get_version_info',{},5000);if(epoch===this.epoch)h.version=[v?.app_name,v?.app_version].filter(x=>typeof x==='string').join(' ').slice(0,100);}catch{}this.emit();}};
 p.disconnected=function(...args){const h=state(this);if(this.ready)h.disconnects++;h.phase='disconnected';return disconnected.apply(this,args);};
 p.tick=function(now=this.now()){const h=state(this);if(h.started&&this.settings.enabled&&this.transport.connected&&!h.busy&&now>=h.nextAt){h.nextAt=now+30000;void this.checkConnection().catch(()=>{h.phase='unknown';this.emit();});}return tick.call(this,now);};
 p.snapshot=function(){const out=snapshot.call(this),h=state(this);out.connectionHealth={backend:this.settings.bridgeKind,phase:h.phase,checkedAt:h.checkedAt,disconnects:h.disconnects,checks:h.checks,onlineChecks:h.onlineChecks,version:h.version};return out;};
 p.operation=async function(op,v={}){if(op==='diagnose'){const r=await this.checkConnection();return {...r,diagnostics:this.snapshot().diagnostics,connectionHealth:this.snapshot().connectionHealth};}return operation.call(this,op,v);};
}
module.exports={extend};
