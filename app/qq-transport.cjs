'use strict';
const {randomUUID}=require('node:crypto');
function endpoint(value){let u;try{u=new URL(value);}catch{throw Error('请填写本机 QQ 桥接地址。');}if(u.protocol!=='ws:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password||u.search||u.hash)throw Error('QQ 桥接使用本机 ws://127.0.0.1:端口，不在地址中填写密钥。');return u.href;}
const ACTIONS=new Set(['get_status','get_version_info','get_group_msg_history','set_msg_emoji_like','delete_msg','get_login_info','get_group_list','get_friend_list','send_private_msg','upload_group_file','upload_private_file','send_group_msg','get_record','get_image','get_msg','get_forward_msg','get_file','group_poke','friend_poke']);
class QQTransport{
 constructor(h={}){this.h=h;this.socket=null;this.pending=new Map();this.generation=0;this.timer=null;this.retry=0;this.enabled=false;this.status='未连接';this.error='';}
 emit(){this.h.state?.({connected:this.connected,status:this.status,error:this.error});}
 get connected(){return this.socket?.readyState===1;}
 start(url,token){this.stop();this.enabled=true;this.url=endpoint(url);this.token=token;this.open();}
 open(){if(!this.enabled)return;const generation=++this.generation;let socket;
  try{const u=new URL(this.url);if(this.token)u.searchParams.set('access_token',this.token);socket=this.h.socket?this.h.socket(u.href):new WebSocket(u.href);this.socket=socket;}catch{this.error='QQ 桥接无法启动，请检查本机地址。';this.reconnect(generation);return;}
  this.status='正在连接 QQ 桥接…';this.error='';this.emit();
  const opening=setTimeout(()=>{if(this.socket===socket&&!this.connected)socket.close();},12000);opening.unref?.();
  socket.addEventListener('open',()=>{clearTimeout(opening);if(generation!==this.generation)return;this.retry=0;this.status='桥接已连接，正在确认账号…';this.emit();Promise.resolve(this.h.open?.()).catch(e=>{this.error=this.clean(e.message);this.emit();socket.close();});});
  socket.addEventListener('message',event=>{if(generation!==this.generation)return;const raw=event.data;if(typeof raw!=='string')return;const size=Buffer.byteLength(raw);if(size>24000000||size>300000&&![...this.pending.values()].some(p=>['get_record','get_image','get_msg','get_forward_msg','get_file'].includes(p.action)))return;let v;try{v=JSON.parse(raw);}catch{return;}if(v.echo&&this.pending.has(v.echo)){const p=this.pending.get(v.echo);if(size>300000&&!['get_record','get_image','get_msg','get_forward_msg','get_file'].includes(p.action))return;this.pending.delete(v.echo);clearTimeout(p.timer);if(v.status==='ok'&&v.retcode===0)p.resolve(v.data);else p.reject(Error('QQ 接口 '+p.action+' 未完成（'+String(v.retcode||v.status||'未知').slice(0,60)+'）'+(v.message?'：'+this.clean(v.message):'')));return;}if(size>300000)return;Promise.resolve(this.h.event?.(v)).catch(e=>{this.error=this.clean(e.message);this.emit();});});
  socket.addEventListener('error',()=>{if(generation===this.generation){this.error='无法连接 QQ 桥接，请先启动并登录颉的账号，检查端口和密钥。';this.emit();}});
  socket.addEventListener('close',()=>{clearTimeout(opening);if(generation!==this.generation)return;this.socket=null;this.failPending();this.h.closed?.();this.status='QQ 已断开，稍后自动重连';this.emit();this.reconnect(generation);});
 }
 clean(v){return String(v||'操作未完成').split(this.token||'\u0000').join('[密钥已隐藏]').replace(/access_token=[^\s&]+/g,'access_token=[已隐藏]').slice(0,240);}
 reconnect(g){if(!this.enabled||g!==this.generation)return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.open(),Math.min(30000,1000*2**Math.min(5,this.retry++)));this.timer.unref?.();}
 request(action,params={},timeout=20000){if(!ACTIONS.has(action))return Promise.reject(Error('QQ 接口未开放。'));if(!this.connected)return Promise.reject(Error('QQ 桥接尚未连接。'));const echo=randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(echo);reject(Error('QQ '+action+' 等待超时；发送结果不确定，不自动重发。'));},timeout);timer.unref?.();this.pending.set(echo,{action,resolve,reject,timer});try{this.socket.send(JSON.stringify({action,params,echo}));}catch{clearTimeout(timer);this.pending.delete(echo);reject(Error('QQ 连接已断开，消息没有提交。'));}});}
 failPending(){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('QQ 连接已断开，操作结果不确定。'));}this.pending.clear();}
 stop(){this.enabled=false;this.generation++;clearTimeout(this.timer);this.timer=null;const socket=this.socket;this.socket=null;try{socket?.close();}catch{}this.failPending();this.h.closed?.();this.status='未连接';this.error='';this.emit();}
}
module.exports={QQTransport,endpoint};
