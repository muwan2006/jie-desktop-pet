'use strict';
const clip=(v,n=200)=>typeof v==='string'?v.trim().slice(0,n):'';
function normalize(v={}){return {replyLength:['short','balanced','long'].includes(v.replyLength)?v.replyLength:'balanced',proactive:['quiet','normal','talkative'].includes(v.proactive)?v.proactive:'normal',gameHelp:v.gameHelp==='direct'?'direct':'hints',quietApps:[...new Set((Array.isArray(v.quietApps)?v.quietApps:[]).map(a=>clip(a,100).toLowerCase()).filter(Boolean))].slice(0,30),likedTone:clip(v.likedTone,30)};}
class CompanionPreferences{
 constructor(saved={},onChange=()=>{}){this.onChange=onChange;this.value=normalize(saved.value);this.feedback=(Array.isArray(saved.feedback)?saved.feedback:[]).slice(-100).map(f=>({kind:clip(f.kind,30),at:Number(f.at)||0,sourceId:clip(f.sourceId,100),app:clip(f.app,100)}));this.lastProactive=Number(saved.lastProactive)||0;}
 save(){return {value:this.value,feedback:this.feedback,lastProactive:this.lastProactive};}
 configure(input){this.value=normalize({...this.value,...input});this.onChange();return {ok:true};}
 respond(kind,{sourceId='',tone='',app=''}={}){if(!['like','shorter','quiet','hints','direct','fewer','more'].includes(kind))throw Error('反馈选项无效。');if(kind==='like')this.value.likedTone=clip(tone,30);if(kind==='shorter')this.value.replyLength='short';if(kind==='fewer')this.value.proactive='quiet';if(kind==='more')this.value.proactive='talkative';if(kind==='hints'||kind==='direct')this.value.gameHelp=kind;if(kind==='quiet'&&app)this.value.quietApps=[...new Set([...this.value.quietApps,app.toLowerCase()])].slice(-30);this.feedback.push({kind,at:Date.now(),sourceId:clip(sourceId,100),app:clip(app,100)});this.feedback=this.feedback.slice(-100);this.onChange();return {ok:true,result:kind==='quiet'&&!app?'这次先安静陪着你；当前应用无法识别。':'已调整相伴偏好，可在“任务与状态”查看或修改。'};}
 quiet(app){return !!app&&this.value.quietApps.includes(app.toLowerCase());}
 mayProactive(now=Date.now()){const gap={quiet:7200000,normal:0,talkative:0}[this.value.proactive];return now-this.lastProactive>=gap;}
 usedProactive(now=Date.now()){this.lastProactive=now;}
 context(){return {...this.value,quietApps:undefined,replyGuidance:{short:'通常先用80至180字说重点，复杂问题仍保留必要信息。',balanced:'按问题复杂度自然安排长度。',long:'需要解释时给充分细节，但不重复。'}[this.value.replyLength]};}
 snapshot(){return {value:this.value,feedback:this.feedback.slice(-20).reverse()};}
}
module.exports={CompanionPreferences,normalize};
