'use strict';
function project(card,m={},conversation={}){
 const text=String(card?.text||''),matches=[...text.matchAll(/^([一二三四五六七八九十百]+)、([^\n]+)$/gm)];
 if(text.length<9000||matches.length<8||/设定|原作|剧情|考据|档案|官方|历史|世界线|祀|(?<![希失愿盼期探远仰眺凝观渴奢])望(?![着见向去外下上到])|兄弟|姐妹|哥哥|姐姐|弟弟|妹妹|岁兽|宏山|塔卫|完整角色卡/.test((m.text||'')+' '+(conversation.history||[]).filter(h=>h.role==='user').slice(-3).map(h=>h.text).join(' ')))return card;
 const sections=matches.map((v,i)=>({title:v[2],body:text.slice(v.index,matches[i+1]?.index||text.length)}));
 const core=/^(?:总纲|世界线与知识边界|情绪与判断方式|说话的质地|桌宠与用户的相处距离|新增总纲|持续执行的优先次序|用户设定图中的外形)/;
 const terms=require('./qq-event-memory.cjs').words((m.text||'')+' '+(conversation.history||[]).slice(-3).map(h=>h.text).join(' '));
 const selected=sections.filter(s=>core.test(s.title)),extra=sections.filter(s=>!core.test(s.title)&&!/对话样本|语气样本|资料.*依据/.test(s.title)).map(s=>({s,score:terms.filter(w=>s.title.includes(w)).length})).filter(v=>v.score>=1).sort((a,b)=>b.score-a.score).slice(0,2).map(v=>v.s);
 if(selected.length<3)return card;return {...card,text:text.slice(0,matches[0].index)+[...selected,...extra].map(s=>s.body).join('\n'),contextSelection:{fullLength:text.length,sections:[...selected,...extra].map(s=>s.title),meaning:'完整角色卡原件保留，本轮按人格核心和话题选择原文段落；未提供的细节不补猜'}};
}
function identity(m){const {liveDiscussion,memoryArchive,personaState,browseShare,browseHistory,browseGrowth,cachedVideo,ownerSelfMemory,...out}=m;return JSON.stringify(out);}
function route(text,m,pref){
 const video=!!m.video||!!m.videoNotebook,file=!!m.fileRequested,background=!!m.backgroundTask,visual=!!m.imageCount||!!m.guessingImages,game=!!m.game;
 return text.split('\n').filter(l=>{
  if(l.startsWith('本次后台任务步骤：')&&!background)return false;
  if(l.startsWith('实际报名与投票记录：')&&!(m.activities||[]).length)return false;
  if(l.startsWith('本会话确认的识图与群梗资料：')&&!visual&&!video&&!m.knowledge?.identities?.length&&!m.knowledge?.memes?.length)return false;
  if(l.startsWith('本条视频的实际读取情况：')&&!video)return false;
  if(l.startsWith('转发读取与回复分别判断：')&&!m.social?.forwards?.length)return false;
  if(l.startsWith('QQ引用与附件：')&&!m.social?.quoted&&!m.social?.forwards?.length&&!m.social?.files?.length)return false;
  if(l.startsWith('本轮没有直接文件生成要求')&&!file)return false;
  return true;
 }).map(l=>l.startsWith('群聊语境与当前关注点：')?'群聊关注当前实际发言人和最新讨论。区分玩笑、转述和真实求助，不能只凭关键词认定危机，也不能只凭“哈哈”排除真实危险。新的可信的迫近危险用ownerAlert及时私聊转交已配置主人，不在群内追问；澄清后不反复追问。不得因旧记录再次转交；没有新消息时不续发。不要声称已报警，不绕过发送间隔和参与权限。':l.startsWith('当前同群紧邻消息（')?'当前消息正文已按顺序提供，优先接当前话题最新相关的一点。表达自己的具体反应，不把聊天变成图片说明书；有确认的画面细节可接其表达，无需复述画面。contribution用continuation/new_point/caption_only/none标记。':l).join('\n');
}
module.exports={project,identity,route};
