'use strict';
const dns=require('node:dns').promises,net=require('node:net');
function publicIP(ip){
 if(net.isIP(ip)===4){const [a,b]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19));}
 if(net.isIP(ip)===6)return /^[23]/i.test(ip)&&!/^2001:(?:db8|0:)/i.test(ip);
 return false;
}
async function validate(raw,{lookup=dns.lookup,local=false}={}){
 const u=new URL(raw);if(u.username||u.password||u.hash||!['https:',...(local?['http:']:[])].includes(u.protocol)||u.port&&!['80','443'].includes(u.port)&&!local)throw Error('媒体地址格式不支持。');
 const host=u.hostname.replace(/^\[|\]$/g,'');
 if(local&&['localhost','127.0.0.1','::1'].includes(host))return u.href;
 if(!host.includes('.')&&!net.isIP(host)||/\.(?:local|localhost|internal)$/i.test(host)||host==='localhost')throw Error('不能读取本机或内网媒体地址。');
 const addresses=net.isIP(host)?[{address:host}]:await lookup(host,{all:true});
 if(!addresses.length||addresses.some(v=>!publicIP(v.address)))throw Error('不能读取本机或内网媒体地址。');return u.href;
}
async function get(raw,{fetch=globalThis.fetch,signal,limit=2*1024*1024,headers={},lookup,local=false}={}){
 const bounded=AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(30000)]);let url=raw;
 for(let i=0;i<5;i++){
  url=await validate(url,{lookup,local});bounded.throwIfAborted();
  const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',...headers},signal:bounded,redirect:'manual'});
  if([301,302,303,307,308].includes(r.status)){const to=r.headers.get('location');await r.body?.cancel().catch(()=>{});if(!to)throw Error('媒体跳转无效。');url=new URL(to,url).href;continue;}
  if(!r.ok||!r.body)throw Error('媒体服务返回 HTTP '+r.status+'，可能需要登录或链接已经失效。');
  if(Number(r.headers.get('content-length'))>limit){await r.body.cancel().catch(()=>{});throw Error('媒体超过允许大小。');}
  const reader=r.body.getReader(),chunks=[];let length=0;try{while(true){bounded.throwIfAborted();const {done,value}=await reader.read();if(done)break;if((length+=value.length)>limit)throw Error('媒体超过允许大小。');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
  return {bytes:Buffer.concat(chunks),url,type:r.headers.get('content-type')||''};
 }throw Error('媒体跳转次数过多。');
}
module.exports={publicIP,validate,get};
