'use strict';
const {Solar}=require('./calendar-vendor/lunar.js');
const names=['立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至','小寒','大寒'];
const aliases={DA_XUE:'大雪',DONG_ZHI:'冬至',XIAO_HAN:'小寒',DA_HAN:'大寒',LI_CHUN:'立春',YU_SHUI:'雨水',JING_ZHE:'惊蛰'};
let cachedYear,terms=[];
function calendar(now=Date.now()){
 const d=new Date(now+8*3600000),year=d.getUTCFullYear();if(!Number.isFinite(now)||year<1901||year>2099)throw Error('日期超出节气计算范围。');
 if(cachedYear!==year){const map=new Map();for(const y of [year-1,year,year+1])for(const [key,s] of Object.entries(Solar.fromYmd(y,7,1).getLunar().getJieQiTable())){const name=aliases[key]||key;if(names.includes(name)){const at=Date.parse(s.toYmdHms().replace(' ','T')+'+08:00');map.set(at,{name,at,date:s.toYmd()});}}terms=[...map.values()].sort((a,b)=>a.at-b.at);cachedYear=year;}
 const current=terms.filter(t=>t.at<=now).at(-1),next=terms.find(t=>t.at>now),date=d.toISOString().slice(0,10),today=terms.find(t=>t.date===date),index=names.indexOf(current.name);
 return {date,zone:'Asia/Shanghai',current:{...current},next:{...next},today:today?{...today}:null,season:index<6?'春':index<12?'夏':index<18?'秋':index<22?'冬':'冬',disclaimer:'中国节气，不代表所选城市当地气候。'};
}
function city(v){if(!v||!Number.isInteger(v.id)||v.id<1||!Number.isFinite(v.latitude)||Math.abs(v.latitude)>90||!Number.isFinite(v.longitude)||Math.abs(v.longitude)>180||typeof v.name!=='string'||!v.name.trim())return null;return {id:v.id,name:v.name.slice(0,80),admin1:String(v.admin1||'').slice(0,80),country:String(v.country||'').slice(0,80),latitude:v.latitude,longitude:v.longitude,timezone:String(v.timezone||'').slice(0,80)};}
function description(code){return code===0?'晴':code<=3&&code>=1?'多云': [45,48].includes(code)?'雾':[51,53,55,56,57].includes(code)?'毛毛雨':[61,63,65,66,67,80,81,82].includes(code)?'雨':[71,73,75,77,85,86].includes(code)?'雪':[95,96,99].includes(code)?'雷雨':null;}
function forecast(v,now=Date.now()){
 const c=v?.current,d=v?.daily;if(!c||!d||!Number.isFinite(c.time)||Math.abs(c.time*1000-now)>6*3600000||!Number.isFinite(c.temperature_2m)||c.temperature_2m< -100||c.temperature_2m>70||!Number.isFinite(c.apparent_temperature)||c.apparent_temperature< -120||c.apparent_temperature>90||!description(c.weather_code)||![0,1].includes(c.is_day)||!Number.isFinite(c.wind_speed_10m)||c.wind_speed_10m<0||c.wind_speed_10m>500)throw Error('天气数据格式异常，请稍后重试。');
 const daily=[0,1].map(i=>{const min=d.temperature_2m_min?.[i],max=d.temperature_2m_max?.[i],rain=d.precipitation_probability_max?.[i],code=d.weather_code?.[i],time=d.time?.[i];if(!Number.isFinite(time)||Math.abs(time*1000-now)>3*86400000||![min,max,rain].every(Number.isFinite)||min< -100||max>70||min>max||rain<0||rain>100||!description(code))throw Error('天气预报格式异常。');return {at:time*1000,min,max,rain,code,description:description(code)};});
 return {fetchedAt:now,at:c.time*1000,temperature:c.temperature_2m,feels:c.apparent_temperature,code:c.weather_code,description:description(c.weather_code),day:c.is_day===1,wind:c.wind_speed_10m,daily,source:'Open-Meteo',timezone:String(v.timezone||'').slice(0,80),disclaimer:'模型天气预报，并非本地传感器实测。'};
}
function weatherSettings(v={}){return {enabled:v.enabled===true,city:city(v.city),proactive:v.proactive===true,voice:v.voice!==false,solar:v.solar!==false,lastComment:Number.isFinite(v.lastComment)?Math.max(0,v.lastComment):0,lastTerm:typeof v.lastTerm==='string'?v.lastTerm.slice(0,30):''};}
function prompt(card,facts){return {instructions:'你就是颉。按完整角色卡、第一人称，结合用户主动选择的城市天气或中国节气，偶尔关心用户，也可提茶、青竹、读书、写稿。最多70字，自然接话，不逐项读天气，不扮播报员。只能使用输入事实，不把天气模型当实测，不说已经下雨或已经陪用户做过某事，不杜撰预警或共同经历。节气不是城市气候。返回JSON {"text":"一句话"}。完整角色卡：\n'+String(card?.text||''),input:JSON.stringify(facts)};}
function fallback(f){if(!f.weather)return '已经到'+f.calendar.current.name+'了。要不要泡杯茶，陪我慢慢翻两页书？';const w=f.weather;return /雨|雪/.test(w.description)?'预报里是'+w.description+'，出门记得看看窗外。回来可以陪我喝杯茶。':w.temperature<=10?'预报里有些凉。出门加件衣服吧，手边的茶也别放冷了。':w.temperature>=30?'预报里有些热。忙的时候也别忘了喝水，我陪你歇一会儿。':'手边的事忙得怎样了？'+f.city.name+'的预报看起来还好，要不要陪我看看青竹？';}
module.exports={calendar,city,description,forecast,weatherSettings,prompt,fallback};
