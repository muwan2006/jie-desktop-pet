'use strict';
const clip=(v,n=200)=>typeof v==='string'?v.trim().slice(0,n):'';
const statuses=['active','completed','superseded'];
function restore(v={}){return {status:statuses.includes(v.status)?v.status:'active',expiresAt:Number.isFinite(v.expiresAt)&&v.expiresAt>0&&v.expiresAt<4102444800000?v.expiresAt:0,topic:clip(v.topic,80),replacedBy:clip(v.replacedBy,40),updatedAt:Number(v.updatedAt)||0,wrongLabels:(Array.isArray(v.wrongLabels)?v.wrongLabels:[]).map(v=>clip(v,60)).filter(Boolean).slice(0,8),differences:clip(v.differences,600),referenceCount:Math.max(0,Math.min(100000,Number(v.referenceCount)||0)),answerCount:Math.max(0,Math.min(100000,Number(v.answerCount)||0)),lastReferencedAt:Math.max(0,Number(v.lastReferencedAt)||0),lastReferenceId:clip(v.lastReferenceId,80),lastAnswerId:clip(v.lastAnswerId,80)};}
function status(v,now=Date.now()){return v.status&&v.status!=='active'?v.status:v.expiresAt&&v.expiresAt<=now?'expired':'active';}
function active(v,now=Date.now()){return status(v,now)==='active';}
function deadline(t,now=Date.now()){
 if(/长期|永久|一直记住|不要过期|不过期/.test(t))return 0;
 const d=new Date(now+28800000),start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-28800000;
 if(!/(?:有效|保留|到期|安排|考试|交稿|提交|开会|会议|茶会|预约|约好|提醒|要去|要做|截止)/.test(t))return 0;
 const absolute=t.match(/(20\d{2})[年/-](\d{1,2})[月/-](\d{1,2})日?/);if(absolute){const [y,m,day]=absolute.slice(1).map(Number),date=new Date(Date.UTC(y,m-1,day));if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==day)return 0;return date.getTime()-28800000+86400000;}
 if(/大后天/.test(t))return start+4*86400000;if(/后天/.test(t))return start+3*86400000;if(/明天/.test(t))return start+2*86400000;if(/今天|今晚/.test(t))return start+86400000;
 const week=t.match(/(下周|下星期|本周|这周|周|星期)([一二三四五六日天])/);if(week){const target='日一二三四五六'.indexOf(week[2].replace('天','日')),today=d.getUTCDay();let days=(target-today+7)%7;if(/下/.test(week[1]))days=7-(today||7)+(target||7);else if(/本|这/.test(week[1]))days=(target||7)-(today||7);return start+(days+1)*86400000;}
 const duration=t.match(/(?:有效|保留|记)(?:期)?(?:为)?\s*(\d{1,3})\s*天/);return duration?now+Math.min(365,Math.max(1,Number(duration[1])))*86400000:0;
}
function topic(t){const named=t.match(/(?:事项|安排|项目|偏好|称呼)[：:]\s*([^，。；\n]{1,40})/);if(named)return named[1];for(const [re,key]of [[/交(?:插画|画|文|初|终)?稿|稿[子件]?.{0,5}(?:交|提交)/,'交稿'],[/考试|考完/,'考试'],[/茶会/,'茶会'],[/开会|会议/,'会议'],[/喝.{0,8}茶|喜欢.{0,8}茶/,'饮茶偏好']])if(re.test(t))return key;return '';}
function complete(t){return /已经.{0,8}(?:交了|提交|完成|结束|取消|考完)|已(?:完成|交稿|结束|取消)|不用再.{0,6}(?:提醒|惦记)|交完稿|稿[子件]?交了/.test(t);}
function decorate(c,entry,value,owner){
 Object.assign(entry,restore(value));if(entry.sender!==owner)return;
 const t=entry.meaning,now=entry.at||Date.now();entry.topic=entry.kind==='fact'?topic(t):'';entry.expiresAt=entry.kind==='fact'?deadline(t,now):0;entry.updatedAt=now;
 if(entry.kind==='fact'&&entry.topic&&complete(t))entry.status='completed';
 const oldText=t.match(/(?:把|将|之前的?)[“"「]?(.{2,60}?)[”"」]?(?:改成|改为|换成)/)?.[1];
 for(const old of c.knowledge.entries){if(old.sender!==owner||old.kind!==entry.kind||old.id===entry.id||!active(old,now))continue;const same=old.label===entry.label||(entry.kind==='fact'&&entry.topic&&entry.topic===(old.topic||topic(old.meaning||'')))||(oldText&&(old.label===oldText||old.meaning.includes(oldText)))||(entry.kind==='identity'&&entry.hash&&entry.hash===old.hash);
  if(same){old.status=entry.status==='completed'?'completed':'superseded';old.replacedBy=entry.id;old.updatedAt=now;}
 }
 if(entry.kind==='identity'){
  const wrong=t.match(/(?:不是|误认成|误认作|错认成|之前认成)[“"「]?([^，。；、\s”"」]{1,30})/)?.[1];if(wrong&&wrong!==entry.label)entry.wrongLabels=[wrong];
  entry.differences=clip(t.match(/(?:区别|区分|辨认要点|特征)(?:在于|是|为)?[：:]?\s*([\s\S]+)/)?.[1],600);
 }
}
function blocked(c,now=Date.now()){const ids=new Set(),live=new Set((c.knowledge?.entries||[]).filter(e=>active(e,now)).flatMap(e=>[e.sourceId,e.confirmationId]).filter(Boolean));for(const e of c.knowledge?.entries||[])if(!active(e,now)){if(e.confirmationId)ids.add(e.confirmationId);if(e.sourceId)ids.add(e.sourceId);}for(const id of live)ids.delete(id);return ids;}
function context(c,now=Date.now()){return (c.knowledge?.entries||[]).filter(e=>!active(e,now)).slice(-20).map(e=>({label:e.label,status:status(e,now),expiresAt:e.expiresAt||0,replacedBy:e.replacedBy||''}));}
function provided(c,entries,id,now=Date.now()){const ids=new Set(entries.map(e=>e.id));for(const e of c.knowledge?.entries||[])if(ids.has(e.id)&&e.kind==='identity'&&active(e,now)&&e.lastReferenceId!==id){e.referenceCount=(e.referenceCount||0)+1;e.lastReferencedAt=now;e.lastReferenceId=id;}}
function answered(c,text,id){for(const e of c.knowledge?.entries||[])if(e.kind==='identity'&&e.lastReferenceId===id&&e.lastAnswerId!==id&&typeof text==='string'&&text.includes(e.label)){e.answerCount=(e.answerCount||0)+1;e.lastAnswerId=id;}}
module.exports={restore,status,active,deadline,topic,complete,decorate,blocked,context,provided,answered};
