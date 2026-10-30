'use strict';
// LLBot waits for UID before it opens its account database. PMHQ hot attachment
// can miss the login packet containing that UID. Reuse ONLY this account's own
// previously stored mapping; the live QQ number and bound native PID must match.
const fs=require('node:fs'),path=require('node:path');
function supplement(health,binding,lookup){
 if(health.uid||!binding||String(health.uin)!==binding.expectedQQ||Number(health.qq_pid)!==binding.pid)return health;
 const uid=lookup(binding.expectedQQ);
 return /^u_[A-Za-z0-9_-]{10,80}$/.test(String(uid||''))?{...health,uid}:health;
}
function install(file){
 const original=globalThis.fetch;
 globalThis.fetch=async function(input,options){
  const response=await original(input,options);const url=typeof input==='string'?input:input instanceof URL?input.href:input?.url;
  if(url!=='http://127.0.0.1:13000/health'||!response.ok)return response;
  let binding;try{binding=JSON.parse(fs.readFileSync(file,'utf8'));}catch{return response;}
  const health=await response.clone().json();
  let patched;try{patched=supplement(health,binding,account=>{
   const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(path.join(path.dirname(file),'bin/llbot/data/database',account+'.v3.db'),{readOnly:true});
   try{return db.prepare('SELECT uid FROM uix WHERE uin = ?').get(Number(account))?.uid;}finally{db.close();}
  });}catch{return response;}
  if(patched===health)return response;
  // This supplies identity only. Read-only server API checks still decide readiness.
  return new Response(JSON.stringify(patched),{status:response.status,headers:{'Content-Type':'application/json'}});
 };
 fs.writeFileSync(path.join(path.dirname(file),'jie-identity-worker.json'),JSON.stringify({pid:process.pid,startedAt:Date.now()}));
}
if(process.env.JIE_QQ_IDENTITY_BINDING)install(process.env.JIE_QQ_IDENTITY_BINDING);
module.exports={supplement,install};
