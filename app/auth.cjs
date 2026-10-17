'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {randomBytes,randomUUID,createHash,timingSafeEqual}=require('node:crypto');
const ISSUER='https://auth.openai.com',RESOURCE='https://api.openai.com/v1';
const TOKEN=ISSUER+'/api/accounts/oauth/token',AUTHORIZE=ISSUER+'/api/accounts/authorize';
const random=()=>randomBytes(32).toString('base64url');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const scopes=value=>typeof value==='string'?value.split(/\s+/).filter(Boolean):[];
function networkError(status){return status===401?'登录已失效，请重新登录。':status===403?'账号未允许此应用使用该能力，请检查授权。':status===429?'已达到使用限制，请到 ChatGPT 设置查看用量。':`连接服务没有完成（HTTP ${status}），请稍后重试。`;}
async function jsonResponse(response){if(!response.ok){const e=Error(networkError(response.status));e.status=response.status;throw e;}const text=await response.text();if(text.length>2000000)throw Error('服务响应过大。');try{return JSON.parse(text);}catch{throw Error('服务返回了无法读取的内容。');}}
function protectedWrite(file,bytes){const tmp=file+'.tmp';fs.writeFileSync(tmp,bytes,{mode:0o600});fs.chmodSync(tmp,0o600);fs.renameSync(tmp,file);}
function validateCallback(url,pending){
 if(!pending||pending.used||Date.now()>pending.expiresAt||url.pathname!=='/auth/callback'||!same(url.searchParams.get('state'),pending.state))throw Error('登录回调不匹配或已过期，请重新登录。');
 const client=url.searchParams.get('client_id');
 if(pending.clientId!=='dynamic_agent_client'&&client&&client!==pending.clientId)throw Error('登录注册不匹配。');
 if(url.searchParams.has('error'))throw Error('登录未完成或未授予 ChatGPT 套餐使用权限。');
 const issued=client||pending.clientId,code=url.searchParams.get('code');
 if(!code||code.length>4096||!issued||issued==='dynamic_agent_client'||issued.length>300)throw Error('登录没有返回完整注册信息。');
 return {clientId:issued,code};
}
async function validateIdentity(token,jwks,clientId,nonce){
 const {jwtVerify,createLocalJWKSet}=await import('jose');
 const {payload}=await jwtVerify(token,createLocalJWKSet(jwks),{issuer:ISSUER,audience:clientId,requiredClaims:['sub','exp','iat'],clockTolerance:5,algorithms:['RS256','ES256','PS256']});
 if(typeof payload.sub!=='string'||!payload.sub||!same(payload.nonce,nonce)||(Array.isArray(payload.aud)&&payload.aud.length>1&&payload.azp!==clientId))throw Error('登录身份验证未通过。');return payload;
}
class Auth {
 constructor({directory,storage,fetch,openExternal,onChange=()=>{}}){
  this.directory=directory;this.storage=storage;this.fetch=fetch;this.openExternal=openExternal;this.onChange=onChange;this.records=[];this.active=null;this.pending=null;this.server=null;this.timer=null;this.refreshing=null;this.status='';this.models=[];this.model='';this.version=0;
  fs.mkdirSync(directory,{recursive:true});const host=path.join(directory,'jie-ai-host.json');
  try{this.host=JSON.parse(fs.readFileSync(host,'utf8')).host;}catch{}
  if(typeof this.host!=='string'||!this.host.startsWith('urn:uuid:')){this.host='urn:uuid:'+randomUUID();protectedWrite(host,JSON.stringify({host:this.host}));}
  this.file=path.join(directory,'jie-ai-credentials.enc');
  try{if(this.storageReady()){const saved=JSON.parse(storage.decryptString(fs.readFileSync(this.file)));this.records=Array.isArray(saved.records)?saved.records:[];this.active=saved.active;}}
  catch{this.status='原有登录信息无法解密，请重新登录。';}
  this.loading=false;this.catalogTask=null;this.refreshes=new Map();this.restoreChoices();
 }
 restoreChoices(){const r=this.current();this.models=r?.access_token&&Array.isArray(r.catalog)?r.catalog.filter(m=>typeof m?.id==='string'&&typeof m?.label==='string'):[];this.model=this.models.some(m=>m.id===r?.model)?r.model:'';if(!this.model&&r?.access_token&&typeof r.model==='string'&&r.model){this.model=r.model;this.models=[{id:r.model,label:r.model}];}}
 async restore(){if(!this.current()?.access_token)return {ok:true};const id=this.active,version=this.version;try{return await this.loadModels();}catch(e){if(id!==this.active||version!==this.version)return {error:'账号已切换。'};this.emit(e.status===401||e.status===400?'登录已失效，请重新连接 ChatGPT。':this.model?'暂时无法更新模型，已保留上次选择；联网后可直接重试。':'暂时无法恢复连接，联网后点击刷新模型。');return {error:this.status};}}
 storageReady(){return this.storage.isEncryptionAvailable()&&this.storage.getSelectedStorageBackend?.()!=='basic_text';}
 persist(){if(!this.storageReady())throw Error('系统安全存储不可用，暂时无法保存登录。');protectedWrite(this.file,this.storage.encryptString(JSON.stringify({records:this.records,active:this.active})));}
 current(){return this.records.find(r=>r.id===this.active);}
 snapshot(){const r=this.current();return {accounts:this.records.map(a=>({id:a.id,label:(a.email||'ChatGPT 账号')+' · '+a.client_id.slice(-6),signedIn:!!a.access_token})),active:this.active,connected:!!r?.access_token,planEnabled:r?.scopes?.includes('chatgpt.tokens.use.direct')||false,pending:!!this.pending,loading:this.loading,status:this.status,models:this.models,model:this.model,welcome:r?.access_token&&!r.welcomed||false};}
 emit(status){if(status!==undefined)this.status=status;this.onChange(this.snapshot());}
 cancel(){this.version++;if(this.pending)this.pending.controller.abort();this.pending=null;clearTimeout(this.timer);if(this.server){this.server.close();this.server.closeAllConnections?.();this.server=null;}this.emit();}
 async begin(id){
  if(!this.storageReady())throw Error('系统安全存储不可用，暂时不能登录。');
  if(id&&!this.records.some(r=>r.id===id))throw Error('找不到这个账号。');
  this.cancel();const selected=id?this.records.find(r=>r.id===id):null;
  const p={state:random(),nonce:random(),verifier:random(),clientId:selected?.client_id||'dynamic_agent_client',selected,expiresAt:Date.now()+300000,used:false,controller:new AbortController()};this.pending=p;
  const server=http.createServer((req,res)=>this.callback(req,res,p));this.server=server;p.server=server;server.maxHeadersCount=20;server.headersTimeout=10000;server.requestTimeout=10000;
  try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});}catch{this.cancel();throw Error('无法开启本机登录回调，请稍后重试。');}
  if(this.pending!==p){server.close();throw Error('登录已取消。');}
  p.redirect='http://127.0.0.1:'+server.address().port+'/auth/callback';
  const query=new URLSearchParams({client_id:p.clientId,ext_agent_host_id:this.host,response_type:'code',redirect_uri:p.redirect,scope:'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',resource:RESOURCE,state:p.state,nonce:p.nonce,code_challenge_method:'S256',code_challenge:createHash('sha256').update(p.verifier).digest('base64url')});
  if(!selected)query.set('agent_name_hint','Jie Desktop Pet');else{if(selected.id_token)query.set('id_token_hint',selected.id_token);if(selected.email)query.set('login_hint',selected.email);}
  this.timer=setTimeout(()=>{if(this.pending===p){this.cancel();this.emit('登录等待已结束，请再试一次。');}},300000);this.timer.unref();
  this.emit('请在浏览器中完成 ChatGPT 登录与授权。');
  try{await this.openExternal(AUTHORIZE+'?'+query.toString());}catch{this.cancel();throw Error('无法打开登录浏览器，请稍后重试。');}return {ok:true};
 }
 async callback(req,res,p){
  res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");res.setHeader('Referrer-Policy','no-referrer');
  let u;try{if(req.method!=='GET'||req.url.length>12000)throw Error();u=new URL(req.url,p.redirect);if(u.pathname!=='/auth/callback'){res.writeHead(404);res.end('Not found');return;}if(!same(u.searchParams.get('state'),p.state)){res.writeHead(400);res.end('Invalid state');return;}}catch{res.writeHead(400);res.end('Invalid request');return;}
  try{
   if(this.pending!==p)throw Error('登录已取消。');const result=validateCallback(u,p);p.used=true;
   const t=await this.token({grant_type:'authorization_code',client_id:result.clientId,code:result.code,code_verifier:p.verifier,redirect_uri:p.redirect,resource:RESOURCE},p.controller.signal);
   const jwks=await jsonResponse(await this.fetch(ISSUER+'/.well-known/jwks.json',{signal:AbortSignal.any([p.controller.signal,AbortSignal.timeout(20000)]),redirect:'error'}));
   const identity=await validateIdentity(t.id_token,jwks,result.clientId,p.nonce);
   if(p.selected&&identity.sub!==p.selected.subject)throw Error('此次登录与所选账号不一致，请添加为新账号。');
   if(this.pending!==p)throw Error('登录已取消。');
   const scope=scopes(t.scope);if(!t.access_token||!scope.includes('chatgpt.tokens.use.direct'))throw Error('未授予 ChatGPT 套餐使用权限，请重新授权。');
   const old=this.records.find(r=>r.client_id===result.clientId&&r.subject===identity.sub);
   const record={...old,id:old?.id||randomUUID(),client_id:result.clientId,subject:identity.sub,email:typeof identity.email==='string'?identity.email:'',id_token:t.id_token,access_token:t.access_token,refresh_token:t.refresh_token,scopes:scope,expiresAt:Date.now()+Number(t.expires_in||3600)*1000,earliestRefreshAt:t.earliest_refresh_at};
   const previousRecords=this.records,previousActive=this.active;this.records=this.records.filter(r=>r.id!==record.id);this.records.push(record);this.active=record.id;
   try{this.persist();}catch(e){this.records=previousRecords;this.active=previousActive;throw e;}
   this.restoreChoices();this.pending=null;clearTimeout(this.timer);this.version++;this.emit('登录成功，正在恢复模型。');
   res.end('<!doctype html><title>颉 · 登录完成</title><p>登录完成。请回到颉桌宠继续聊天，此页面可以关闭。</p>');this.closeListener(p.server);
   const active=this.active;this.loadModels().catch(()=>{if(this.active===active)this.emit('登录成功，但模型列表未获取。请检查网络后点击刷新模型。');});
  }catch{if(!res.writableEnded){res.writeHead(400);res.end('<!doctype html><title>颉 · 登录未完成</title><p>登录未完成。请回到颉桌宠检查授权和网络，再试一次。</p>');}if(this.pending===p){this.pending=null;clearTimeout(this.timer);this.emit('登录未完成，请检查授权、网络，或尝试重新登录。');}this.closeListener(p.server);}
 }
 closeListener(server){if(server){if(this.server===server)this.server=null;server.close();setTimeout(()=>server.closeAllConnections?.(),1000).unref();}}
 async token(form,signal){return jsonResponse(await this.fetch(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(form).toString(),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000),redirect:'error'}));}
 async access(force=false){
  const r=this.current();if(!r?.access_token||!r.scopes?.includes('chatgpt.tokens.use.direct'))throw Error('请先登录 ChatGPT，并允许套餐使用。');
  if(!force&&Date.now()<r.expiresAt-60000)return r.access_token;
  const earliest=typeof r.earliestRefreshAt==='number'?(r.earliestRefreshAt<100000000000?r.earliestRefreshAt*1000:r.earliestRefreshAt):Date.parse(r.earliestRefreshAt);
  if(Number.isFinite(earliest)&&Date.now()<earliest){if(Date.now()<r.expiresAt)return r.access_token;throw Error('登录暂时无法续期，请稍后重试或重新登录。');}
  if(!r.refresh_token)throw Error('登录已到期，请重新登录。');
  if(!this.refreshes.has(r.id)){const refresh=r.refresh_token,task={record:r};this.refreshes.set(r.id,task);task.promise=(async()=>{
   const t=await this.token({grant_type:'refresh_token',client_id:r.client_id,refresh_token:r.refresh_token,resource:RESOURCE});
   if(r.refresh_token!==refresh)throw Error('登录状态已改变，请重试。');
   const granted=t.scope?scopes(t.scope):r.scopes;if(!t.access_token||!t.refresh_token||!granted.includes('chatgpt.tokens.use.direct'))throw Error('续期未完成，请重新登录。');
   Object.assign(r,{access_token:t.access_token,refresh_token:t.refresh_token,expiresAt:Date.now()+Number(t.expires_in||3600)*1000,scopes:granted,earliestRefreshAt:t.earliest_refresh_at});this.persist();return r.access_token;
  })().finally(()=>{if(this.refreshes.get(r.id)===task)this.refreshes.delete(r.id);});}return this.refreshes.get(r.id).promise;
 }
 async loadModels(){const id=this.active,version=this.version;if(this.catalogTask?.id===id&&this.catalogTask.version===version)return this.catalogTask.promise;
  this.loading=true;this.emit('正在自动更新账号可用的模型……');const task={id,version};this.catalogTask=task;
  task.promise=(async()=>{let token=await this.access();let response=await this.fetch(RESOURCE+'/models',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000),redirect:'error'});
   if(response.status===401){token=await this.access(true);response=await this.fetch(RESOURCE+'/models',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000),redirect:'error'});}
   const data=await jsonResponse(response);if(id!==this.active||version!==this.version)throw Error('账号已切换。');
   if(!Array.isArray(data.models))throw Error('模型目录格式不匹配，请稍后重试。');
   const seen=new Set();this.models=data.models.filter(m=>m.visibility==='list'&&typeof m.slug==='string'&&!seen.has(m.slug)&&seen.add(m.slug)).map(m=>({id:m.slug,label:typeof m.display_name==='string'?m.display_name:m.slug}));const r=this.current(),saved=r.model;
   this.model=this.models.some(m=>m.id===saved)?saved:this.models[0]?.id||'';r.model=this.model;r.catalog=this.models;this.persist();this.emit(this.models.length?'已连接，模型已自动恢复。':'账号未返回可选模型，请检查套餐权限。');return {ok:true};
  })().finally(()=>{if(this.catalogTask===task){this.catalogTask=null;this.loading=false;this.emit();}});return task.promise;
 }
 selectModel(model){if(!this.models.some(m=>m.id===model))throw Error('请选择当前账号允许的模型。');this.model=model;this.current().model=model;this.persist();this.emit();}
 selectAccount(id){if(!this.records.some(r=>r.id===id))throw Error('找不到这个账号。');this.cancel();this.active=id;this.restoreChoices();this.persist();this.emit('账号已切换，正在恢复连接。');void this.restore();}
 welcome(){const r=this.current();if(r){r.welcomed=true;this.persist();this.emit();}}
 async signOut(){
  this.cancel();const r=this.current();if(!r)return {ok:true};const refresh=r.refresh_token,client=r.client_id;delete r.access_token;delete r.refresh_token;delete r.id_token;this.models=[];this.model='';this.persist();this.emit('已在此电脑退出。');let revoked=!refresh;
  if(refresh)try{
   const d=await jsonResponse(await this.fetch(ISSUER+'/.well-known/openid-configuration',{signal:AbortSignal.timeout(10000),redirect:'error'}));const endpoint=new URL(d.revocation_endpoint);if(endpoint.origin!==ISSUER)throw Error();
   for(let attempt=0;attempt<2;attempt++){const response=await this.fetch(endpoint.href,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:refresh,token_type_hint:'refresh_token',client_id:client}).toString(),signal:AbortSignal.timeout(10000),redirect:'error'});if(response.status===200){revoked=true;break;}if(response.status<500)break;await new Promise(r=>setTimeout(r,500));}
  }catch{}
  if(!revoked)this.emit('本机已退出；未确认远端撤销，可到 ChatGPT 设置断开此应用。');return {ok:true,revoked};
 }
 shutdown(){this.cancel();}
}
module.exports={Auth,validateCallback,validateIdentity,jsonResponse,networkError};
