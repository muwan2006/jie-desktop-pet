'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
class LLBotProbe{
 constructor({root,fetch,account}){this.root=root;this.fetch=fetch;this.account=account;this.denied=new Set();this.blocked=false;this.pending=null;this.lastURL='';}
 ports(){const ports=new Set();if(this.lastURL)ports.add(Number(new URL(this.lastURL).port));
  for(const f of ['default_config.json',`data/config_${String(this.account?.()||'').replace(/\D/g,'')}.json`])try{const p=JSON.parse(fs.readFileSync(path.join(this.root,'bin/llbot',f),'utf8')).webui?.port;if(Number.isInteger(p)&&p>=1024&&p<=65535)ports.add(p);}catch{}
  for(let p=3080;p<3090;p++)ports.add(p);return [...ports];
 }
 async get(base,headers){try{const r=await this.fetch(base+'api/login-info',{headers,redirect:'error',signal:AbortSignal.timeout(1200)}),s=await r.text();if(Buffer.byteLength(s)>16384)return null;return {status:r.status,value:JSON.parse(s)};}catch{return null;}}
 ready(){if(this.pending)return this.pending;const p=this.find();this.pending=p;p.finally(()=>{if(this.pending===p)this.pending=null;}).catch(()=>{});return p;}
 async find(){this.blocked=false;let key='';try{key=fs.readFileSync(path.join(this.root,'bin/llbot/data/webui_token.txt'),'utf8').trim();if(key.length>4096)key='';}catch{}
  const digest=key?createHash('sha256').update(key).digest('hex'):'';
  const results=await Promise.all(this.ports().map(async port=>{const base=`http://127.0.0.1:${port}/`,publicInfo=await this.get(base,{});if(!publicInfo)return null;
   const v=publicInfo.value,protectedService=[401,403].includes(publicInfo.status)&&v.success===false&&/密码|Token|WebUI/i.test(String(v.message||''));
   if(!protectedService)return null;
   const attempt=base+digest;
   if(!key||v.locked||this.denied.has(attempt)){this.blocked=true;return null;}
   const auth=await this.get(base,{'X-Webui-Token':digest});
   if(auth?.status===200&&auth.value.success===true&&typeof auth.value.data?.online==='boolean')return {url:base,...auth.value.data};
   if(auth&&[401,403].includes(auth.status)){this.denied.add(attempt);this.blocked=true;}
   return null;
  }));
  const available=results.filter(Boolean),expected=String(this.account?.()||'');
  const chosen=available.find(x=>x.online&&String(x.uin)===expected)||available.find(x=>x.online)||available[0];
  if(chosen){this.lastURL=chosen.url;return chosen.url;}return null;
 }
}
module.exports={LLBotProbe};
