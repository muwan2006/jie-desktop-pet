'use strict';
const kinds=['gomoku','go','xiangqi','number'],labels={gomoku:'五子棋',go:'围棋',xiangqi:'象棋',number:'猜数字'};
const clean=t=>String(t||'').trim().replace(/^(?:小小颉|小颉|颉)[，,：:\s]*/,'').replace(/[，,。！!？?\s]/g,'');
function ensure(c){if(!c.games||typeof c.games!=='object'||Array.isArray(c.games)){c.games={};if(kinds.includes(c.game?.kind))c.games[c.game.kind]=c.game;}return c.games;}
function ongoing(g){return !!g&&['playing','scoring'].includes(g.board?.status||g.status);}
function list(c){return kinds.map(k=>ensure(c)[k]).filter(Boolean);}
function restore(c,restoreGame,restoreCoach){const games={};if(c.games&&typeof c.games==='object'&&!Array.isArray(c.games))for(const k of kinds){const g=restoreGame(c.games[k]);if(g?.kind===k)games[k]=g;}const legacy=restoreGame(c.game);if(legacy&&!games[legacy.kind])games[legacy.kind]=legacy;const coaches={};for(const k of kinds)coaches[k]=restoreCoach?.(c.gameCoaches?.[k]||(legacy?.kind===k?c.coach:{})||{})||{};return {games,game:legacy&&games[legacy.kind]||Object.values(games).at(-1)||null,gameCoaches:coaches};}
function scope(c,kind){ensure(c);const proxy=Object.create(c);Object.defineProperty(proxy,'game',{get:()=>c.games[kind]||null,set:g=>{if(g)c.games[kind]=g;else delete c.games[kind];c.game=g||list(c).at(-1)||null;}});Object.defineProperty(proxy,'coach',{get:()=>{c.gameCoaches??={};return c.gameCoaches[kind]??=(c.game?.kind===kind?c.coach:{})||{};},set:v=>{c.gameCoaches??={};c.gameCoaches[kind]=v;c.coach=v;}});Object.defineProperty(proxy,'party',{get:()=>c.party,set:v=>{c.party=v;}});Object.defineProperty(proxy,'gameArchives',{get:()=>(c.gameArchives||[]).filter(g=>g.kind===kind),set:v=>{c.gameArchives=[...(c.gameArchives||[]).filter(g=>g.kind!==kind),...v].slice(-8);}});return proxy;}
function prefix(t){const m=t.match(/^(五子棋|围棋|中国象棋|象棋|猜数字)(.+)$/);return m?{kind:{五子棋:'gomoku',围棋:'go',中国象棋:'xiangqi',象棋:'xiangqi',猜数字:'number'}[m[1]],text:m[2]}:null;}
function resolve(c,m,command){const games=ensure(c),t=clean(m.text),end=t.match(/^(?:结束|关闭|收起)(五子棋|围棋|中国象棋|象棋|猜数字)(?:棋局|游戏)?$/);
 if(/^(?:结束|关闭)(?:本群)?全部(?:棋局|棋类游戏)$/.test(t))return {all:true,cmd:{type:'close'}};
 if(end)return {kind:{五子棋:'gomoku',围棋:'go',中国象棋:'xiangqi',象棋:'xiangqi',猜数字:'number'}[end[1]],text:'结束游戏',cmd:{type:'close'}};
 const view=t.match(/^(?:查看|看看|显示|刷新)(五子棋|围棋|中国象棋|象棋|猜数字)(?:棋盘|棋局|游戏)?$/);if(view)return {kind:{五子棋:'gomoku',围棋:'go',中国象棋:'xiangqi',象棋:'xiangqi',猜数字:'number'}[view[1]],text:'查看棋盘',cmd:{type:'view'}};
 const open=command(t,null);if(open?.type==='open')return {kind:open.kind,text:m.text,cmd:open};
 const named=t.match(/五子棋|中国象棋|象棋/);if(named){const kind=named[0]==='五子棋'?'gomoku':'xiangqi',cmd=command(t,games[kind]);if(cmd?.type==='difficulty')return {kind,text:m.text,cmd};}
 const explicit=prefix(t);if(explicit){const cmd=command(explicit.text,games[explicit.kind]);if(cmd||/^(?:结束游戏|结束棋局)$/.test(explicit.text))return {...explicit,cmd:cmd||{type:'close'}};return {...explicit,cmd:null};}
 const own=list(c).filter(g=>g.player===m.sender),activeOwn=own.filter(ongoing),candidates=activeOwn.length?activeOwn:own;
 const hits=candidates.map(g=>({kind:g.kind,text:m.text,cmd:command(m.text,g)})).filter(x=>x.cmd);
 if(hits.length===1)return hits[0];if(hits.length>1)return {ambiguous:true,kinds:hits.map(x=>x.kind)};
 const others=list(c).map(g=>({kind:g.kind,text:m.text,cmd:command(m.text,g)})).filter(x=>x.cmd);
 if(others.length===1)return others[0];if(others.length>1)return {ambiguous:true,kinds:others.map(x=>x.kind)};
 return open?{text:m.text,cmd:open}:null;
}
function notice(r){return {handled:true,text:'这里有多盘棋局：'+r.kinds.map(k=>labels[k]).join('、')+'。请带上棋种，例如“五子棋 八行八列”“围棋 悔棋”“结束象棋”，避免操作错棋盘。'};}
function ownerAllowed(m,owner){return !!owner&&m.sender===owner&&(m.type!=='group'||m.mention===true);}
function apply(c,m,options,single,command){const r=resolve(c,m,command);if(!r)return null;if(r.ambiguous)return notice(r);
 if(r.all){if(!ownerAllowed(m,options.owner))return {handled:true,text:'结束全部棋局只能由主人在群里真实@我后操作；棋手可以结束自己发起的那一局。'};const old=list(c);for(const g of old)delete c.games[g.kind];c.game=null;return {handled:true,closedGames:old,text:old.length?'本群的全部棋局已收起。':'本群没有正在保留的棋局。'};}
 if(!r.cmd)return null;const slot=scope(c,r.kind||'gomoku'),previous=slot.game;
 if(r.cmd.type==='close'){
  if(!previous)return {handled:true,text:labels[r.kind]+'还没开局。'};
  if(previous.player!==m.sender&&!ownerAllowed(m,options.owner))return {handled:true,text:'这局只有发起者或主人真实@我后才能结束，其他人可以旁观。'};
  slot.game=null;return {handled:true,closedGames:[previous],text:labels[r.kind]+'这局先收起来，其他棋局继续。'};
 }
 const result=single(slot,{...m,text:r.text},options);if(!result)return result;
 if(slot.game)c.game=slot.game;
 if(previous&&(previous!==slot.game||!ongoing(slot.game)))result.closedGames=[previous];
 return result;
}
async function applyAsync(c,m,options,single,command){const r=resolve(c,m,command);if(!r||r.ambiguous||r.all||r.cmd?.type==='close'||!r.cmd)return apply(c,m,options,options.sync,command);const slot=scope(c,r.kind||'gomoku'),previous=slot.game;const result=await single(slot,{...m,text:r.text},options);if(result&&slot.game)c.game=slot.game;if(result&&previous&&(previous!==slot.game||!ongoing(slot.game)))result.closedGames=[previous];return result;}
function command(text,c,parse){const r=resolve(c,{text,sender:''},parse);return r&&(r.cmd||r.ambiguous?{type:r.ambiguous?'choose':r.cmd.type,kind:r.kind}:null);}
module.exports={kinds,labels,ensure,ongoing,list,restore,scope,prefix,resolve,notice,ownerAllowed,apply,applyAsync,command};
