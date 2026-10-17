'use strict';
const Vision=require('./vision-search.cjs');
function policy({identity={},proactive=false,preferences={},visual=false}){
 const natural=visual&&identity.type==='group'&&proactive;
 const requiredReverse=visual&&!identity.video&&identity.type==='group'&&identity.mention===true&&!proactive&&
  (Vision.identification(identity.text)||/识图|认图|看(?:看|一下|下|一眼).{0,12}(?:图|照片)|这是什么/.test(identity.text||''));
 const localOnly=natural&&preferences.naturalImageSearch!==true;
 return {natural,localOnly,requiredReverse,reverseEnabled:!identity.video&&!localOnly&&(requiredReverse||preferences.reverseImages!==false)};
}
function features(value){return Array.isArray(value)&&new Set(value.filter(v=>typeof v==='string'&&v.trim().length>=4)).size>=2;}
function localConfirmed(value,identity){
 if(value?.status==='observed')return value.certain===true&&features(value.features);
 if(value?.status!=='confirmed'||!Array.isArray(value.claims)||!value.claims.length||value.claims.length>8)return false;
 const labels=(identity.knowledge?.identities||[]).filter(v=>v.match==='exact').map(v=>v.label);
 return value.claims.every(v=>labels.includes(v.claim)&&features(v.features));
}
function reverseSucceeded(research){return (research?.reverse||[]).some(v=>v.used===true&&(v.sources?.length||v.comparisons?.length));}
const localGuidance='本轮是群聊自然接话的纯识图模式，不调用联网搜索或以图搜图。只在明确确认图片内容时才接话；认不准、模糊、候选冲突或无法确认出处就skip:true、reply为空。图中直接可见的内容需要visualCheck:{status:"observed",certain:true,features:["清楚看见的具体细节1","具体细节2"]}，不把似乎、可能当确认。角色姓名、作品、亲属关系、梗出处不能只凭外形或训练印象推断；只有本会话纠错库的exact原图确认才可使用已确认的名称，visualCheck:{status:"confirmed",claims:[{claim:"照抄exact条目的label",features:["原图细节1","原图细节2"]}]}。不要声称查过资料。不要保存不确定的识图推测，不用表情包、原生表情或语音代替跳过。';
function guidance(p){return p.localOnly?localGuidance:Vision.guidance+(p.natural?' 这是群聊自然接话，任何需要确认的识图结论未确认就保持安静，skip:true，不发送猜测或无法确认的解释。':'')+(p.requiredReverse?' 本轮明确@你要求识图，程序同时启用以图搜图；必须核对实际返回结果，未成功取得结果或仍无法确认时只说“我不知道这张图是谁。”，不列候选、不反问出处，不把训练印象当搜索确认。':'');}
function unknown(result,conversation,p,search,research){return {...result,skip:p.natural,text:p.natural?'':p.requiredReverse?'我不知道，暂时无法确认这张图。':Vision.uncertain(),reason:p.natural?'识图未明确确认':'',summary:conversation.summary,sticker:'',saveStickers:[],memoryUpdates:[],peerUpdates:[],reaction:null,ownerAlert:null,document:null,taskOutput:null,replyTo:'',pokeBack:false,search:{...search,visualVerified:false},research};}
module.exports={policy,localConfirmed,reverseSucceeded,guidance,unknown};
