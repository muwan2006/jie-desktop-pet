'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const X=require('../xiangqi.cjs'),Games=require('../qq-games.cjs'),{think}=require('../xiangqi-ai.cjs');
const position=pieces=>{const b=Array(90).fill(0);for(const [i,p]of pieces)b[i]=p;return b;};
const tactics=[
 {name:'双车侧翼入宫',pieces:[[3,-2],[5,-1],[12,-5],[21,-2],[25,5],[38,4],[40,7],[78,5],[84,1]],winning:[[25,7],[78,6]]},
 {name:'弃吃子而取将杀',pieces:[[3,-2],[5,-1],[10,4],[15,5],[19,-5],[21,-2],[40,7],[56,5],[84,1]],winning:[[15,6]]},
 {name:'车马联合封宫',pieces:[[2,4],[3,-1],[19,-5],[21,-2],[23,-2],[26,5],[40,7],[59,5],[85,1]],winning:[[26,8]]},
 {name:'马车合击杀网',pieces:[[4,-1],[5,-2],[13,-2],[18,4],[22,5],[25,5],[37,-5],[40,7],[86,1]],winning:[[18,11]]},
 {name:'双车占肋',pieces:[[3,-1],[5,-2],[13,-2],[40,7],[45,4],[46,5],[65,5],[80,-5],[86,1]],winning:[[46,1],[65,2]]}
];
// Independent forcing-line verifier: every legal defending move must lose.
function forced(b,turn,attacker,remaining,memo=new Map()){
 const options=X.moves(b,turn);if(!options.length)return turn!==attacker;if(!remaining)return false;
 const key=b.join(',')+':'+turn+':'+remaining;if(memo.has(key))return memo.get(key);
 const answers=options.map(m=>()=>{const next=X.moved(b,m.from,m.to);if(turn===attacker&&!X.check(next,-turn)&&X.moves(next,-turn).length)return false;return forced(next,-turn,attacker,remaining-1,memo);});
 const result=turn===attacker?answers.some(f=>f()):answers.every(f=>f());memo.set(key,result);return result;
}
test('old hard/challenge migrate to easy/normal once, preserving exact board and undo history',()=>{
 const g=new X.Xiangqi({difficulty:'hard'});g.place(70,67);const v=g.snapshot();delete v.difficultySchema;
 const easy=new X.Xiangqi(v);assert.equal(easy.difficulty,'easy');assert.deepEqual(easy.board,v.board);assert.deepEqual(easy.moves,v.moves);assert.equal(easy.snapshot().difficultySchema,2);assert.equal(new X.Xiangqi(easy.snapshot()).difficulty,'easy');
 assert.equal(new X.Xiangqi({...v,difficulty:'challenge'}).difficulty,'normal');assert.equal(new X.Xiangqi({difficulty:'hard'}).difficulty,'hard');assert.equal(new X.Xiangqi({difficulty:'challenge'}).difficulty,'challenge');
});
test('piece-specific move generation matches exhaustive rules through real legal playouts',()=>{
 let b=X.initial(),seed=74931;for(let step=0;step<30;step++){for(const turn of [1,-1]){const slow=[];for(let f=0;f<90;f++)if(Math.sign(b[f])===turn)for(let t=0;t<90;t++)if(X.legal(b,f,t,turn))slow.push(f*90+t);const before=b.slice(),fast=X.moves(b,turn);assert.deepEqual(fast.map(m=>m.from*90+m.to).sort((a,c)=>a-c),slow.sort((a,c)=>a-c));assert.deepEqual(b,before);assert.deepEqual(X.moves(b,turn,true).map(m=>m.from*90+m.to).sort((a,c)=>a-c),fast.filter(m=>m.captured).map(m=>m.from*90+m.to).sort((a,c)=>a-c));}const all=X.moves(b,step%2?-1:1);if(!all.length)break;seed=(seed*1664525+1013904223)>>>0;const m=all[seed%all.length];b=X.moved(b,m.from,m.to);}
});
for(const puzzle of tactics)test('upper levels find verified five-ply forced mate: '+puzzle.name,()=>{
 const b=position(puzzle.pieces),before=b.slice();assert.equal(X.check(b,1),false);assert.equal(X.check(b,-1),false);
 for(const level of ['hard','challenge']){const m=X.choose(b,1,level,500);assert.ok(puzzle.winning.some(([f,t])=>m.from===f&&m.to===t),level+': '+JSON.stringify(m));assert.ok(forced(X.moved(b,m.from,m.to),-1,1,4));assert.deepEqual(b,before);}
});
test('advanced search handles black-side tactical positions and always leaves caller state unchanged on timeout',()=>{
 const b=position(tactics[1].pieces).reverse().map(p=>-p),m=X.choose(b,-1,'hard',500);assert.deepEqual([m.from,m.to],[89-15,89-6]);
 const start=X.initial(),before=start.slice(),short=X.choose(start,-1,'challenge',1);assert.ok(X.legal(start,short.from,short.to,-1));assert.deepEqual(start,before);
});
test('QQ async chess cancels without committing either human or AI move after session change',async()=>{
 const c={},m={sender:'12345678',name:'玩家',text:'象棋',at:1};Games.apply(c,m);let release;const before=JSON.stringify(c.game),pending=Games.applyAsync(c,{...m,text:'炮二平五'},{think:()=>new Promise(r=>release=r),current:()=>false});release({from:1,to:20});await assert.rejects(pending,/取消/);assert.equal(JSON.stringify(c.game),before);
 await assert.rejects(Games.applyAsync(c,{...m,text:'炮二平五'},{think:async()=>{throw Error('worker failed');}}),/worker failed/);assert.equal(JSON.stringify(c.game),before);
});
test('QQ async chess passes selected difficulty to background worker and commits a legal full turn',async()=>{
 const c={},m={sender:'12345678',name:'玩家',text:'象棋',at:1};Games.apply(c,m);Games.apply(c,{...m,text:'困难'});let seen;
 const r=await Games.applyAsync(c,{...m,text:'炮二平五'},{think:async g=>{seen=g;return X.moves(g.board,g.turn)[0];}});assert.equal(seen.difficulty,'hard');assert.equal(seen.difficultySchema,2);assert.equal(r.game.board.moves.length,2);assert.equal(r.game.board.turn,1);
});
test('real background worker leaves event loop responsive and abort terminates pending search',async()=>{
 const g=new X.Xiangqi({difficulty:'challenge',human:-1}).snapshot(),controller=new AbortController();let ticked=false;const pending=think(g,{signal:controller.signal});setTimeout(()=>{ticked=true;controller.abort();},25);await assert.rejects(pending,/取消/);assert.equal(ticked,true);await assert.rejects(think(g,{signal:controller.signal}),/取消/);
});

