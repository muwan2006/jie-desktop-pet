'use strict';
const {eligibleTopics}=require('./companionship.cjs');
function followupSettings(value={}){return {enabled:value.enabled!==false,minutes:[30,60,120,240].includes(value.minutes)?value.minutes:60,start:/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.start)?value.start:'09:00',end:/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.end)?value.end:'22:00'};}
function timeMinutes(time){return Number(time.slice(0,2))*60+Number(time.slice(3));}
class FollowUp{
 constructor(saved={},onChange=()=>{}){this.settings=followupSettings(saved.settings);this.profiles=Object.create(null);for(const [id,p] of Object.entries(saved.profiles||{}).filter(([id])=>/^[\w-]{1,100}$/.test(id)).slice(0,30))this.profiles[id]={lastAttempt:Number(p.lastAttempt)||0,day:typeof p.day==='string'?p.day:'',count:Number(p.count)||0,lastUserId:typeof p.lastUserId==='string'?p.lastUserId:'',waitingTopic:p.waitingTopic===true};this.onChange=onChange;this.busy=false;this.status='';this.generation=0;}
 save(){return {settings:{...this.settings},profiles:this.profiles};}
 snapshot(){return {settings:{...this.settings},busy:this.busy,status:this.status};}
 emit(){this.onChange();}
 configure(input){this.settings=followupSettings({...this.settings,...input});this.status=this.settings.enabled?'已开启，有合适的话题时轻轻接话。':'已关闭主动接话。';this.emit();return {ok:true};}
 cancel(){this.generation++;this.busy=false;this.status='';this.emit();}
 data(profile){return this.profiles[profile]||(this.profiles[profile]={lastAttempt:0,day:'',count:0,lastUserId:'',waitingTopic:false});}
 async tick({chat,auth,quiet,send,now=Date.now()}){
  if(!this.settings.enabled||this.busy||!quiet||chat.busy||!auth.snapshot().connected||!auth.model)return {skipped:true};
  const d=new Date(now),minute=d.getHours()*60+d.getMinutes(),start=timeMinutes(this.settings.start),end=timeMinutes(this.settings.end);if(start===end||!(start<end?minute>=start&&minute<end:minute>=start||minute<end))return {skipped:true};
  const profile=chat.profile,p=this.data(profile),history=chat.data().history,last=history.filter(h=>h.role==='user').at(-1),previous=history.filter(h=>h.origin==='proactive').at(-1),day=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
  if(p.day!==day){p.day=day;p.count=0;}
  const topics=eligibleTopics(chat.data().life||{topics:[]},now);if(!last||!Number.isFinite(last.at)||now-last.at<this.settings.minutes*60000||(!topics.length&&now-last.at>3*86400000)||last.at>now||p.count>=3||now-p.lastAttempt<this.settings.minutes*60000||previous&&previous.at>=last.at||last.id===p.lastUserId&&(!topics.length||p.waitingTopic))return {skipped:true};
  p.lastAttempt=now;p.lastUserId=last.id;p.waitingTopic=!!topics.length;p.count++;this.busy=true;const generation=++this.generation;this.status='正在想起你们聊过的事……';this.emit();
  try{const result=await send({proactive:true,now});if(generation!==this.generation||profile!==chat.profile)return {canceled:true};this.status=result.error?'主动接话暂时没完成；你发来消息后会再找合适的话题。':result.skipped?'这次没有合适的话题，先安静陪着你。':'颉想起了一件你们聊过的事。';return result;}
  catch{if(generation===this.generation)this.status='主动接话暂时没完成。';return {error:this.status};}
  finally{if(generation===this.generation){this.busy=false;this.emit();}}
 }
}
module.exports={FollowUp,followupSettings};
