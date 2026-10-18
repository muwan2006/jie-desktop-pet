'use strict';
// Stronger local search for the two upper levels. No model or network needed.
const {moves,check}=require('./xiangqi.cjs');
const MATE=100000,INF=110000,VALUES=[0,30000,120,120,400,900,430,100];
let seed=0x712f384b;
function random32(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;}
const Z1=Array.from({length:90},()=>Array.from({length:15},random32)),Z2=Array.from({length:90},()=>Array.from({length:15},random32)),TURN1=random32(),TURN2=random32();
function evaluate(b,s){let result=0;
 for(let i=0;i<90;i++){const p=b[i];if(!p)continue;const side=Math.sign(p),kind=Math.abs(p),row=Math.floor(i/9),col=i%9,forward=side===1?9-row:row,center=4-Math.abs(col-4);let n=VALUES[kind];
  if(kind===7)n+=forward*7+(forward>=5?65+center*7:0)+(forward===9?-35:0);
  if(kind===4){n+=center*9+(forward>=2&&forward<=7?20:0);for(const [dr,dc]of [[-1,0],[1,0],[0,-1],[0,1]]){const r=row+dr,c=col+dc;if(r>=0&&r<10&&c>=0&&c<9&&!b[r*9+c])n+=7;}}
  if(kind===5||kind===6){n+=center*(kind===6?5:2);for(const [dr,dc]of [[-1,0],[1,0],[0,-1],[0,1]]){let free=0;for(let r=row+dr,c=col+dc;r>=0&&r<10&&c>=0&&c<9&&!b[r*9+c];r+=dr,c+=dc)free++;n+=Math.min(5,free)*(kind===5?4:2);}}
  if(kind===1){n-=forward*6;for(const delta of [-1,1])if(col+delta>=3&&col+delta<=5&&b[row*9+col+delta]===side*2)n+=12;}
  result+=side*s*n;
 }
 return result;
}
function choose(input,side,settings,budget,options={}){
 const started=Date.now(),limit=Math.max(1,Math.min(settings.budget,Number(budget)||settings.budget)),deadline=started+limit;
 const b=input.slice(),rootMoves=moves(b,side);if(!rootMoves.length)return null;
 const maxDepth=Math.min(settings.depth,Math.max(1,Number(options.maxDepth)||settings.depth)),maxNodes=Math.max(1,Number(options.maxNodes)||Infinity);
 const table=new Map(),killers=[],history=new Int32Array(2*90*90),path=new Set(),prior=new Map();let h1=0,h2=0,nodes=0,qnodes=0,done=0,best=rootMoves[0],bestScore=evaluate(b,side);
 for(let i=0;i<90;i++)if(b[i]){h1^=Z1[i][b[i]+7];h2^=Z2[i][b[i]+7];}
 for(const m of options.history||[])if(typeof m.position==='string')prior.set(m.position,(prior.get(m.position)||0)+1);
 const key=turn=>((h1^(turn===-1?TURN1:0))>>>0)*2097152+((h2^(turn===-1?TURN2:0))&0x1fffff);
 const stop=()=>{nodes++;if(nodes>=maxNodes||Date.now()>=deadline)throw STOP;},STOP=Symbol('search-budget');
 function make(m){const p=b[m.from],q=b[m.to];h1^=Z1[m.from][p+7]^Z1[m.to][p+7];h2^=Z2[m.from][p+7]^Z2[m.to][p+7];if(q){h1^=Z1[m.to][q+7];h2^=Z2[m.to][q+7];}b[m.to]=p;b[m.from]=0;return q;}
 function unmake(m,q){const p=b[m.to];h1^=Z1[m.from][p+7]^Z1[m.to][p+7];h2^=Z2[m.from][p+7]^Z2[m.to][p+7];if(q){h1^=Z1[m.to][q+7];h2^=Z2[m.to][q+7];}b[m.from]=p;b[m.to]=q;}
 const code=m=>m.from*90+m.to;
 function ordered(list,turn,ply,preferred){const k=killers[ply]||[],offset=turn===1?0:8100;for(const m of list){const id=code(m);m.order=id===preferred?10000000:m.captured?1000000+16*VALUES[Math.abs(m.captured)]-VALUES[Math.abs(b[m.from])]:id===k[0]?800000:id===k[1]?700000:history[offset+id];}return list.sort((a,c)=>c.order-a.order||a.from-c.from||a.to-c.to);}
 function quiet(turn,alpha,beta,ply,qdepth){stop();qnodes++;if(b.indexOf(turn)<0)return -MATE+ply;if(b.indexOf(-turn)<0)return MATE-ply;
  const inCheck=check(b,turn),all=moves(b,turn);if(!all.length)return -MATE+ply;
  const standing=evaluate(b,turn);if(ply>=48||qdepth>=12)return standing;
  if(!inCheck){if(standing>=beta)return standing;if(standing>alpha)alpha=standing;}
  const list=ordered(inCheck?all:all.filter(m=>m.captured),turn,ply,-1);
  for(const m of list){const captured=make(m);let score;try{score=-quiet(-turn,-beta,-alpha,ply+1,qdepth+1);}finally{unmake(m,captured);}if(score>=beta)return score;if(score>alpha)alpha=score;}
  return alpha;
 }
 function search(turn,depth,alpha,beta,ply,extensions){stop();if(b.indexOf(turn)<0)return -MATE+ply;if(b.indexOf(-turn)<0)return MATE-ply;if(depth<=0)return quiet(turn,alpha,beta,ply,0);
  const hash=key(turn);if(path.has(hash))return 0;
  const inCheck=check(b,turn);if(inCheck&&extensions<2){depth++;extensions++;}
  const originalAlpha=alpha,entry=table.get(hash);if(entry&&entry.lock===(h2>>>0)&&entry.depth>=depth&&Math.abs(entry.score)<MATE-100){if(entry.flag===0)return entry.score;if(entry.flag===1)alpha=Math.max(alpha,entry.score);else beta=Math.min(beta,entry.score);if(alpha>=beta)return entry.score;}
  const all=ordered(moves(b,turn),turn,ply,entry?.move);if(!all.length)return -MATE+ply;let score=-INF,selected=-1,count=0;path.add(hash);
  try{for(const m of all){const captured=make(m);let n;try{
    if(!count)n=-search(-turn,depth-1,-beta,-alpha,ply+1,extensions);
    else{const reduction=depth>=4&&count>=4&&!inCheck&&!captured&&!check(b,-turn)?1:0;n=-search(-turn,depth-1-reduction,-alpha-1,-alpha,ply+1,extensions);if(reduction&&n>alpha)n=-search(-turn,depth-1,-alpha-1,-alpha,ply+1,extensions);if(n>alpha&&n<beta)n=-search(-turn,depth-1,-beta,-alpha,ply+1,extensions);}
   }finally{unmake(m,captured);}count++;if(n>score){score=n;selected=code(m);}if(n>alpha)alpha=n;if(alpha>=beta){if(!captured){const ks=killers[ply]||(killers[ply]=[]);if(ks[0]!==selected){ks[1]=ks[0];ks[0]=selected;}const i=(turn===1?0:8100)+selected;history[i]=Math.min(600000,history[i]+depth*depth*16);}break;}}
  }finally{path.delete(hash);}
  if(table.size<120000||table.has(hash))table.set(hash,{lock:h2>>>0,depth,score,move:selected,flag:score<=originalAlpha?2:score>=beta?1:0});return score;
 }
 for(let depth=1;depth<=maxDepth;depth++){let candidate=best,score=-INF;
  try{for(const m of ordered(rootMoves,side,0,code(best))){const captured=make(m);let n;try{
     const repeated=(prior.get(b.join(',')+':'+(-side))||0)>=2;
     // Respect a real third repetition at the root; perpetual checking is a loss.
     if(repeated){const position=b.join(',')+':'+(-side),rows=options.history||[],start=rows.findIndex(v=>v.position===position),cycle=rows.slice(start+1).concat([{side,check:check(b,-side)}]),checking=[1,-1].filter(p=>cycle.some(x=>x.side===p)&&cycle.filter(x=>x.side===p).every(x=>x.check));n=checking.length===1?(checking[0]===side?-MATE+1:MATE-1):0;}
     else n=-search(-side,depth-1,-INF,-score,1,0);
    }finally{unmake(m,captured);}if(n>score){score=n;candidate=m;}}
   best=candidate;bestScore=score;done=depth;if(Math.abs(score)>=MATE-48)break;
  }catch(e){if(e!==STOP)throw e;break;}
 }
 return {from:best.from,to:best.to,captured:best.captured,depth:done,nodes,qnodes,score:bestScore,elapsedMs:Date.now()-started};
}
module.exports={choose,evaluate};
