'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomBytes}=require('node:crypto'),{pathToFileURL}=require('node:url');
const Provider=require('./singing-provider.cjs'),Audio=require('./singing-qq-file.cjs'),S=require('./qq-state.cjs');
const LIVE=new Set(['running','ready','sending']),STATES=new Set([...LIVE,'sent','failed','canceled','uncertain']);
const clip=(v,n=200)=>String(v||'').trim().slice(0,n),digits=v=>/^\d{5,15}$/.test(String(v||''));
function command(raw){
 const text=clip(raw,1000).replace(/^(?:小小颉|小颉|颉)[，,：:\s]*/,'').replace(/[。！!]+$/,'');
 let m=text.match(/^(?:唱歌进度|点歌进度|翻唱进度|查询点歌)(?:\s+([a-f0-9]{8}))?$/i);if(m)return {op:'status',id:m[1]?.toLowerCase()};
 m=text.match(/^(?:取消点歌|停止唱歌|停止翻唱|取消翻唱|别唱了)(?:\s+([a-f0-9]{8}))?$/i);if(m)return {op:'stop',id:m[1]?.toLowerCase()};
 m=text.match(/^(?:重发歌曲|重发翻唱|发送翻唱)(?:\s+([a-f0-9]{8}))?$/i);if(m)return {op:'resend',id:m[1]?.toLowerCase()};
 m=text.match(/^(?:点歌|点一首|来一首|来首)\s*[《「“]?(.+?)[》」”]?$/);if(m)return {op:'search',query:m[1].replace(/[》」”]$/,'').trim()};
 const parsed=Provider.intent(text);return parsed&&['search','choose','stop'].includes(parsed.op)?parsed:null;
}
function restore(rows){return (Array.isArray(rows)?rows:[]).slice(-50).filter(v=>v&&/^[a-f0-9]{8}$/.test(v.id)&&/^[\w-]{1,160}$/.test(v.scope)&&digits(v.target)&&digits(v.sender)&&['private','group'].includes(v.type)&&STATES.has(v.status)&&(!v.key||/^[a-f0-9]{24}$/.test(v.key))).map(v=>({id:v.id,scope:v.scope,type:v.type,target:v.target,sender:v.sender,sourceId:clip(v.sourceId,80),key:v.key||'',title:clip(v.title),artist:clip(v.artist),status:LIVE.has(v.status)&&v.status!=='ready'?(v.status==='sending'?'uncertain':'canceled'):v.status,error:clip(v.error),notified:LIVE.has(v.status)&&v.status!=='ready'?true:v.notified===true,updated:Number(v.updated)||0,sentParts:Math.max(0,Math.min(20,Math.floor(Number(v.sentParts)||0))),announced:v.announced===true,fileFallback:v.fileFallback===true}));}
class QQSinging{
 constructor(q){this.q=q;this.file=path.join(q.h.directory,'qq-singing-jobs.json');this.pending=new Map();this.queued=new Set();this.jobs=[];try{if(fs.statSync(this.file).size<1000000)this.jobs=restore(JSON.parse(fs.readFileSync(this.file,'utf8')));}catch{} }
 singer(){return this.q.h.singing.get();}
 save(){this.jobs=this.jobs.slice(-50);fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.jobs));fs.renameSync(this.file+'.tmp',this.file);}
 own(m,j){return j.scope===this.q.key(m)&&(j.sender===m.sender||m.sender===this.q.settings.owner);}
 find(m,id){return this.jobs.filter(j=>this.own(m,j)&&(!id||j.id===id)).at(-1);}
 message(j){return {type:j.type,target:j.target,sender:j.sender,id:'singing-delivery-'+j.id,text:'',images:[],mention:j.type==='group',proactive:false,singingDelivery:j.id};}
 summary(j){const states={running:'正在制作',ready:'已做好，等待发送',sending:'正在发送',sent:j.fileFallback?'备用音频文件已发送':'歌曲语音已发送',failed:'没有完成',canceled:'已取消／退出时中断',uncertain:'发送结果不确定，不会自动重复发送'};return `点歌 ${j.id} · ${j.title} · ${states[j.status]}`+(j.sentParts?' · 已确认'+j.sentParts+'段语音':'')+(j.status==='running'?' · '+this.singer().snapshot().status:'')+(j.error?'\n'+j.error:'');}
 async reply(m,c,text,signal,current){await this.q.localReply(m,c,text,signal,current);}
 async handle(m,signal,current){
  if(m.singingDelivery){await this.deliver(m,signal,current);return true;}
  const cmd=command(m.text);if(!cmd||m.proactive||m.poke||m.upload||!S.called(this.q.settings,m))return false;
  const c=this.q.session(m),singer=this.singer();
  try{
   if(['status','stop','resend'].includes(cmd.op)){
    const j=this.find(m,cmd.id);if(!j){await this.reply(m,c,'这个会话里还没有你的点歌任务。可以说“颉，唱一下《歌名》”。',signal,current);return true;}
    if(cmd.op==='stop'){
     if(LIVE.has(j.status)){j.status='canceled';j.notified=true;if(singer.active?.key===j.key&&singer.busy())singer.stop();this.save();}
     await this.reply(m,c,this.summary(j),signal,current);return true;
    }
    if(cmd.op==='resend'){
     const item=singer.items.find(v=>v.key===j.key);if(!item||!singer.ready(item)){await this.reply(m,c,'这首还没有制作完成的音频，请重新点歌。',signal,current);return true;}
     if(j.status==='sent'){j.sentParts=0;j.announced=false;}j.fileFallback=false;j.status='ready';j.notified=false;j.error='';this.save();await this.reply(m,c,'已安排把这首翻唱作为QQ语音发到当前会话；已确认发送的分段不会重复发。',signal,current);this.tick();return true;
    }
    await this.reply(m,c,this.summary(j),signal,current);return true;
   }
   if(!singer.configured()){await this.reply(m,c,'电脑上的 SoulX 歌声组件还没准备好，请先在桌宠里连接组件。',signal,current);return true;}
   const scope=this.q.key(m),actor=scope+'-'+m.sender;
   if(cmd.op==='search'){
    const query=clip(cmd.query,180);
    const cached=singer.items.filter(v=>singer.ready(v)&&(v.title===query||v.title+' '+v.artist===query));
    if(cached.length===1){await this.start(m,c,cached[0],signal,current);return true;}
    const hits=await Provider.search(query,{fetch:this.q.h.singing.fetch,signal:AbortSignal.any([signal,AbortSignal.timeout(20000)])});
    if(!current())return true;
    this.pending.set(actor,{at:this.q.now(),hits});while(this.pending.size>100)this.pending.delete(this.pending.keys().next().value);
    await this.reply(m,c,hits.length?'找到了这些版本：\n'+hits.map((v,i)=>`${i+1}. ${v.title} — ${v.artist}`).join('\n')+'\n回复“唱第一个”选择；群里请再@我。做好后会用QQ语音唱给你听。':'没有找到这首歌，试试加上歌手名。',signal,current);return true;
   }
   if(cmd.op==='choose'){
    const pending=this.pending.get(actor);if(!pending||this.q.now()-pending.at>600000||!pending.hits[cmd.index]){await this.reply(m,c,'你在这个会话里还没有可选的点歌结果，请先告诉我歌名。',signal,current);return true;}
    await this.start(m,c,pending.hits[cmd.index],signal,current);return true;
   }
  }catch(e){if(current())await this.reply(m,c,clip(e.message,300)||'这次点歌没有完成，请重试。',signal,current);}
  return true;
 }
 async start(m,c,song,signal,current){
  const scope=this.q.key(m),singer=this.singer();
  const prior=this.jobs.find(j=>LIVE.has(j.status)&&j.scope===scope&&j.sender===m.sender&&j.title===song.title);
  if(prior){await this.reply(m,c,this.summary(prior),signal,current);return;}
  const prepared=await singer.prepare(song,{playCached:false});
  if(!current()){if(!prepared.cached&&singer.active?.key===prepared.key)singer.stop();return;}
  const j={id:randomBytes(4).toString('hex'),scope,type:m.type,target:m.target,sender:m.sender,sourceId:m.id,key:prepared.key,title:song.title,artist:song.artist||'',status:'running',notified:false,error:'',updated:this.q.now(),sentParts:0,announced:false};
  this.jobs.push(j);this.save();
  // Background completion never holds the QQ conversation queue or captures
  // the short-lived recognition/reply controller for the whole song.
  Promise.resolve(prepared.completion).then(result=>{
   if(j.status!=='running')return;
   j.updated=this.q.now();
   if(result?.ok){j.status='ready';}else if(result?.canceled){j.status='canceled';j.notified=true;}else{j.status='failed';j.error=clip(result?.error||'制作被中断，请重新点歌。');}
   this.save();this.tick();
  }).catch(e=>{if(j.status==='running'){j.status='failed';j.error=clip(e.message);this.save();this.tick();}});
  await this.reply(m,c,prepared.cached?`《${song.title}》歌库里已有，我会用QQ语音发到这里。`:`收到《${song.title}》。点歌编号 ${j.id}，制作完成后用QQ语音发到这里。可说“点歌进度”或“取消点歌”。`,signal,current);
 }
 tick(){
  const q=this.q;if(!q.ready||!q.transport.connected||!q.settings.enabled)return;
  for(const j of this.jobs){
   if(!['ready','failed'].includes(j.status)||j.notified||this.queued.has(j.id))continue;
   const m=this.message(j);if(j.scope!==q.key(m)||!q.valid(m))continue;
   this.queued.add(j.id);if(!q.enqueue(m))this.queued.delete(j.id);
  }
 }
 async deliver(m,signal,current){
  const j=this.jobs.find(v=>v.id===m.singingDelivery);this.queued.delete(m.singingDelivery);
  if(!j||j.scope!==this.q.key(m)||!this.own(m,j)||!['ready','failed'].includes(j.status)||j.notified||!current())return;
  const q=this.q,c=q.session(m),singer=this.singer();
  if(j.status==='failed'){j.notified=true;this.save();await this.reply(m,c,'《'+j.title+'》这次没制作好：'+j.error,signal,current);return;}
  let attempted=false;
  try{
   const item=singer.items.find(v=>v.key===j.key);if(!item||!singer.ready(item))throw Error('歌库里没有找到实际完成的翻唱文件。');
   j.status='sending';this.save();
   const audio=await (q.h.singing.voices||Audio.voices)(singer.file(j.key),{runtime:singer.settings.runtime,signal});
   if(!current()){j.status='ready';this.save();return;}
   if(!Array.isArray(audio.parts)||audio.parts.length<1||audio.parts.length>20)throw Error('歌曲语音分段异常。');
   const part=audio.parts[j.sentParts||0];if(!part)throw Error('歌曲语音分段进度异常。');
   const expected=path.join(path.dirname(singer.file(j.key)),'qq-voice-v1');
   if(path.resolve(path.dirname(part.file))!==path.resolve(expected)||!/^voice-\d{2}\.wav$/.test(path.basename(part.file))||fs.statSync(part.file).size>16000000)throw Error('歌曲语音文件异常。');
   m.correctionReply=/^-?\d{1,30}$/.test(j.sourceId)?j.sourceId:'';
   if(!j.announced){await this.reply(m,c,'《'+j.title+'》唱好了。'+(audio.parts.length>1?'整首分成'+audio.parts.length+'条语音，按顺序听就好。':'现在用语音发给你。'),signal,current);if(current()){j.announced=true;this.save();}}
   if(!current()){j.status='ready';this.save();return;}
   attempted=true;
   await q.send(m,[{type:'record',data:{file:'base64://'+fs.readFileSync(part.file).toString('base64')}}]);
   j.sentParts=(j.sentParts||0)+1;j.status=j.sentParts>=audio.parts.length?'sent':'ready';j.notified=j.status==='sent';j.error='';j.updated=q.now();this.save();
   if(j.status==='sent')q.log('singing','歌曲语音已发送到'+(m.type==='group'?'原群聊':'原私聊')+'：'+j.title);
   // One voice per queue turn lets cancellation and normal chat run between
   // parts. Confirmed parts are persisted before the next one is scheduled.
   this.tick();
  }catch(e){
   if(attempted&&current()&&q.preferences(m).fileReplies&&/QQ 接口 (?:send_private_msg|send_group_msg) 未完成/.test(e.message)){
    try{const audio=await (q.h.singing.encode||Audio.encode)(singer.file(j.key),{runtime:singer.settings.runtime,signal});if(!current())throw Error('连接已变化。');const name=(j.title+'-颉翻唱').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,140)+'.mp3';await this.reply(m,c,'QQ这次没有接受歌曲语音，我改发完整MP3文件给你。',signal,current);if(!current())throw Error('连接已变化。');await q.transport.request(m.type==='group'?'upload_group_file':'upload_private_file',{...(m.type==='group'?{group_id:m.target}:{user_id:m.target}),file:pathToFileURL(audio.file).href,name},90000);j.status='sent';j.notified=true;j.fileFallback=true;j.error='';this.save();return;}catch(fallback){e=fallback;}
   }
   j.status=attempted?'uncertain':signal.aborted||!current()?'ready':'failed';j.error=clip(e.message);j.notified=j.status!=='ready';this.save();
   if(current())await this.reply(m,c,attempted?'歌曲语音发送结果不确定，我不会自动重复发。可确认后说“重发歌曲”，从尚未确认的分段继续。':'歌曲语音暂未发出：'+j.error+'。可说“重发歌曲”再试。',signal,current);
  }
 }
}
function ensure(q){if(!q.h.singing)return null;return q.singingTasks??=new QQSinging(q);}
function extend(Runtime){const p=Runtime.prototype,previous=p.handleCodex,tick=p.tick,stop=p.stop,disconnected=p.disconnected;
 p.handleCodex=async function(m,signal,current){if(await ensure(this)?.handle(m,signal,current))return true;return previous?.call(this,m,signal,current)||false;};
 p.tick=function(...args){const result=tick.apply(this,args);ensure(this)?.tick();return result;};
 p.stop=function(...args){this.singingTasks?.queued.clear();return stop.apply(this,args);};
 p.disconnected=function(...args){this.singingTasks?.queued.clear();return disconnected.apply(this,args);};
}
module.exports={QQSinging,command,restore,extend};
