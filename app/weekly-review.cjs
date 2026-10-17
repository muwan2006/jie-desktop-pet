'use strict';
const {day,week,shift,validDay,validID,text}=require('./companion-growth.cjs'),{createHash}=require('node:crypto');
function collect(date,source,now=Date.now()){
 if(!validDay(date)||date>day(now))throw Error('请选择今天或之前的日期。');const start=week(date),end=shift(start,6),until=end<day(now)?end:day(now),rows=[];
 const inRange=d=>validDay(d)&&d>=start&&d<=until;
 for(const e of Object.values(source.diary||{}))if(inRange(e.date)&&!(source.excludedDiaryDates||[]).includes(e.date))rows.push({id:'diary:'+e.date,kind:'diary',date:e.date,title:e.title,text:text(e.text,2400),sourceId:e.date});
 for(const h of source.growth?.habits||[])for(const d of h.checks||[])if(inRange(d))rows.push({id:'habit:'+h.id+':'+d,kind:'habit',date:d,title:h.title,text:'用户已确认打卡',sourceId:h.id});
 for(const g of source.growth?.gifts||[])if(inRange(day(g.at))&&g.at<=now)rows.push({id:'gift:'+g.id,kind:'gift',date:day(g.at),title:'送给颉：'+g.kind,text:'已递出的礼物',sourceId:g.id});
 let count=0,minutes=0;for(const [d,v]of Object.entries(source.daily||{}))if(inRange(d)){count+=Math.max(0,Number(v.count)||0);minutes+=Math.max(0,Number(v.minutes)||0);if(v.count)rows.push({id:'focus:'+d,kind:'focus',date:d,title:'完成 '+v.count+' 段专注',text:'累计 '+(Number(v.minutes)||0)+' 分钟',sourceId:d});}
 for(const p of source.projects||[])if(p.status==='done'&&Number.isFinite(p.doneAt)&&p.doneAt>0&&inRange(day(p.doneAt))&&p.doneAt<=now)rows.push({id:'project:'+p.id,kind:'project',date:day(p.doneAt),title:p.title,text:'用户已确认完成',sourceId:p.id});
 const summary={diaries:rows.filter(r=>r.kind==='diary').length,checkins:rows.filter(r=>r.kind==='habit').length,habits:new Set(rows.filter(r=>r.kind==='habit').map(r=>r.sourceId)).size,focus:count,minutes,gifts:rows.filter(r=>r.kind==='gift').length,projects:rows.filter(r=>r.kind==='project').length};
 rows.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));const data={start,end,until,partial:until<end,summary,rows:rows.slice(0,350),limited:rows.length>350};return {...data,signature:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
}
class WeeklyReview {
 constructor(saved={}){this.profiles=Object.create(null);for(const [id,p]of Object.entries(saved.profiles||{}).slice(0,40))if(validID(id)){const reviews={};for(const [key,v]of Object.entries(p.reviews||{}).slice(-104))if(validDay(key)&&key===week(key)&&typeof v.text==='string')reviews[key]={date:key,title:text(v.title,100),text:text(v.text,10000),signature:text(v.signature,64),at:Number(v.at)||0,edited:v.edited===true,versions:(v.versions||[]).slice(-5).filter(v=>typeof v.text==='string').map(v=>({title:text(v.title,100),text:text(v.text,10000)}))};this.profiles[id]={reviews,automatic:p.automatic===true};}}
 data(id){if(!validID(id))throw Error('连接无效。');return this.profiles[id]||(this.profiles[id]={reviews:{},automatic:false});}
 save(){return {profiles:this.profiles};}
 write(id,source,line){const p=this.data(id),old=p.reviews[source.start];if(old?.edited)throw Error('此周报有手动修改，请先导出或明确重写。');return this.replace(id,source.start,{title:'与颉相伴的一周 · '+source.start,text:line||`这一周留下了 ${source.summary.diaries} 篇小记，完成 ${source.summary.focus} 段专注，共 ${source.summary.minutes} 分钟。\n${source.summary.habits} 个习惯留下 ${source.summary.checkins} 次打卡，还收到 ${source.summary.gifts} 份礼物。\n这些只是已经留下的记录；没记到的片刻，不替你补写。`,signature:source.signature,edited:false});}
 replace(id,date,v){if(!validDay(date)||date!==week(date)||!text(v.text,10000))throw Error('周报日期或正文无效。');const d=this.data(id),old=d.reviews[date];const result={date,title:text(v.title,100)||'相伴周报',text:text(v.text,10000),signature:v.signature||old?.signature||'',at:Date.now(),edited:v.edited!==false,versions:old?[...(old.versions||[]),{title:old.title,text:old.text}].slice(-5):[]};d.reviews[date]=result;const keys=Object.keys(d.reviews).sort();while(keys.length>104)delete d.reviews[keys.shift()];return result;}
 restore(id,date){const e=this.data(id).reviews[date],v=e?.versions?.pop();if(!v)throw Error('没有上一版周报。');Object.assign(e,v,{edited:true});return {ok:true};}
}
module.exports={WeeklyReview,collect};
