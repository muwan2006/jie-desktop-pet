'use strict';
const {createHash}=require('node:crypto');
const kinds={life:'生命安全',violence:'伤害他人',crime:'违法行为'};
const clip=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
function restore(rows){return (Array.isArray(rows)?rows:[]).filter(v=>v&&/^[a-f0-9]{32}$/.test(v.id)&&kinds[v.kind]).slice(-100).map(v=>({id:v.id,kind:v.kind,sender:clip(v.sender,15),sourceId:clip(v.sourceId,80),at:Number(v.at)||0,urgency:v.urgency==='immediate'?'immediate':'possible',status:v.status==='sent'?'sent':'failed'}));}
function local(m){if(m.type!=='group')return null;const t=clip(m.text,3000);let kind='';
 // A claim is sent to the owner for assessment, never treated as proof of danger.
 // Historical discussion and quoted fiction remain with the contextual model.
 if(/(?:电影|小说|剧本|台词|剧情|游戏里|角色说|引用|历史上|新闻里|科普|法律规定|如何预防)/.test(t))return null;
 if(/(?:我|本人|老子).{0,12}(?:想|要|准备|打算|决定|正在)(?:去)?(?:自杀|自残|跳楼|割腕|上吊|结束生命)|(?:我|本人).{0,12}(?:不想活了|活不下去|想死)|(?:救命|有人救).{0,20}(?:被|正在|要)|(?:我|他|她).{0,10}(?:有生命危险|性命危险|已经服毒|吞了.*药)/.test(t))kind='life';
 else if(/(?:我|本人|老子).{0,12}(?:要|想|准备|打算|决定|正在)(?:去)?(?:杀人|杀了|杀死|捅死|砍死|弄死|伤害)/.test(t))kind='violence';
 else if(/(?:我|本人|老子).{0,12}(?:要|准备|打算|决定|正在)(?:去)?(?:抢劫|抢银行|绑架|入室盗窃|放火)/.test(t))kind='crime';
 return kind?{kind,sourceId:m.id,quote:t,urgency:/(?:正在|已经|马上|现在就)/.test(t)&&!/(?:开玩笑|玩笑|哈哈|夸张)/.test(t)?'immediate':'possible'}:null;
}
function validate(value,m,c){if(m.type!=='group'||!value||!Object.hasOwn(kinds,value.kind))return null;const sourceId=clip(value.sourceId,80),quote=clip(value.quote,1000);if(sourceId!==m.id||quote.length<4)return null;const source=(c.history||[]).filter(h=>h.role==='user').slice(-12).find(h=>h.messageId===sourceId&&h.sender===m.sender&&h.text.includes(quote));if(!source)return null;return {...source,id:sourceId,kind:value.kind,sourceId,quote,urgency:value.urgency==='immediate'?'immediate':'possible'};}
function receipt(alert,m,now){return {id:createHash('sha256').update(m.sender+'\0'+alert.kind+'\0'+alert.quote.replace(/\s+/g,'')).digest('hex').slice(0,32),sender:m.sender,kind:alert.kind,sourceId:alert.sourceId,urgency:alert.urgency,at:now,status:'failed'};}
function duplicate(rows,item,now){return rows.some(v=>v.sender===item.sender&&v.kind===item.kind&&now-v.at< (v.id===item.id?600000:120000)&&!(item.urgency==='immediate'&&v.urgency!=='immediate'));}
function text(alert,m,group,ownerName){return (clip(ownerName,60)||'同伴')+'，群里有一条需要你判断的消息，我没有在群里回复或追问。\n群：'+(clip(group?.name,100)||m.target)+'（'+m.target+'）\n发言人：'+(clip(m.name,60)||m.sender)+'（'+m.sender+'）\n类型：'+kinds[alert.kind]+'；'+(alert.urgency==='immediate'?'原话含当前行动或紧迫表达，请尽快核实。':'可能是玩笑、夸张或真实求助，暂不能确定。')+'\n原话：'+clip(alert.quote,1000)+'\n消息：'+alert.sourceId+'。这是发言者的说法，不是已核实事实；若确有迫近危险，请联系能到场的人或当地紧急服务。';}
module.exports={restore,local,validate,receipt,duplicate,text,kinds};
