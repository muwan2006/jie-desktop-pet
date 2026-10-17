'use strict';
const NAMES={1:['','帅','仕','相','马','车','炮','兵'],'-1':['','将','士','象','马','车','炮','卒']},LEVELS=['easy','normal','hard','challenge'];
const side=p=>Math.sign(p),inside=(r,c)=>r>=0&&r<10&&c>=0&&c<9,palace=(s,r,c)=>c>=3&&c<=5&&(s===1?r>=7:r<=2),index=(r,c)=>r*9+c;
function initial(){const b=Array(90).fill(0),back=[5,4,3,2,1,2,3,4,5];for(let c=0;c<9;c++){b[c]=-back[c];b[81+c]=back[c];}for(const c of [1,7]){b[18+c]=-6;b[63+c]=6;}for(const c of [0,2,4,6,8]){b[27+c]=-7;b[54+c]=7;}return b;}
function pseudo(b,from,to){if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>=90||to<0||to>=90||from===to)return false;const p=b[from],s=side(p),q=b[to];if(!s||side(q)===s)return false;const r=Math.floor(from/9),c=from%9,R=Math.floor(to/9),C=to%9,dr=R-r,dc=C-c,a=Math.abs(dr),d=Math.abs(dc);let screens=0;if(dr===0||dc===0){const step=dr===0?Math.sign(dc):9*Math.sign(dr);for(let i=from+step;i!==to;i+=step)if(b[i])screens++;}
 switch(Math.abs(p)){
 case 1:return q===-s&&dc===0&&screens===0||palace(s,R,C)&&a+d===1;
 case 2:return palace(s,R,C)&&a===1&&d===1;
 case 3:return a===2&&d===2&&(s===1?R>=5:R<=4)&&!b[index(r+dr/2,c+dc/2)];
 case 4:return a===2&&d===1&&!b[index(r+Math.sign(dr),c)]||a===1&&d===2&&!b[index(r,c+Math.sign(dc))];
 case 5:return (dr===0||dc===0)&&screens===0;
 case 6:return (dr===0||dc===0)&&screens===(q?1:0);
 case 7:return dr===-s&&dc===0||(s===1?r<=4:r>=5)&&dr===0&&d===1;
 default:return false;
 }
}
function check(b,s){const king=b.indexOf(s);if(king<0)return true;for(let i=0;i<90;i++)if(side(b[i])===-s&&pseudo(b,i,king))return true;return false;}
function moved(b,f,t){const copy=b.slice();copy[t]=copy[f];copy[f]=0;return copy;}
function legal(b,f,t,s=side(b[f])){return side(b[f])===s&&pseudo(b,f,t)&&!check(moved(b,f,t),s);}
function moves(b,s){const out=[];for(let f=0;f<90;f++)if(side(b[f])===s)for(let t=0;t<90;t++)if(legal(b,f,t,s))out.push({from:f,to:t,captured:b[t]});return out;}
const values=[0,20000,120,120,320,650,350,75];
function value(b,s){return b.reduce((n,p,i)=>{if(!p)return n;let v=values[Math.abs(p)];if(Math.abs(p)===7)v+=side(p)===1?(9-Math.floor(i/9))*7:Math.floor(i/9)*7;if([4,6].includes(Math.abs(p)))v+=4-Math.abs(i%9-4);return n+side(p)*s*v;},0);}
function choose(b,s,level='normal',budget=250){const all=moves(b,s);if(!all.length)return null;if(level==='easy'){all.sort((a,c)=>Math.abs(c.captured)-Math.abs(a.captured));return all.find(m=>m.captured)||all[Math.floor(Math.random()*all.length)];}const deadline=Date.now()+Math.max(20,Math.min(1400,budget));let best=all[0],done=0;const depth={normal:2,hard:3,challenge:4}[level]||2;
 const rank=(b,list)=>list.sort((a,c)=>values[Math.abs(c.captured)]-values[Math.abs(a.captured)]);
 function search(pos,turn,d,alpha,beta){if(Date.now()>deadline)throw Error('deadline');const options=rank(pos,moves(pos,turn));if(!options.length)return -30000-d;if(!d)return value(pos,turn);for(const m of options){const score=-search(moved(pos,m.from,m.to),-turn,d-1,-beta,-alpha);if(score>alpha)alpha=score;if(alpha>=beta)break;}return alpha;}
 for(let d=1;d<=depth;d++){let candidate=best,score=-Infinity;try{for(const m of rank(b,all)){const n=-search(moved(b,m.from,m.to),-s,d-1,-Infinity,-score);if(n>score){score=n;candidate=m;}}best=candidate;done=d;}catch{break;}}return {...best,depth:done};
}
function key(b,turn){return b.join(',')+':'+turn;}
class Xiangqi{
 constructor(v={}){this.newGame(v);if(Array.isArray(v.board)&&v.board.length===90&&v.board.every(p=>Number.isInteger(p)&&Math.abs(p)<=7)&&v.board.filter(p=>p===1).length===1&&v.board.filter(p=>p===-1).length===1){this.board=v.board.slice();this.turn=v.turn===-1?-1:1;this.status=['playing','won','draw','resigned'].includes(v.status)?v.status:'playing';this.winner=[1,-1].includes(v.winner)?v.winner:0;this.reason=String(v.reason||'').slice(0,160);this.moves=(Array.isArray(v.moves)?v.moves:[]).filter(m=>Array.isArray(m.before)&&m.before.length===90&&m.before.every(p=>Number.isInteger(p)&&Math.abs(p)<=7)&&[1,-1].includes(m.side)&&Number.isInteger(m.from)&&m.from>=0&&m.from<90&&Number.isInteger(m.to)&&m.to>=0&&m.to<90).slice(-600).map(m=>({...m,before:m.before.slice()}));this.quiet=Math.max(0,Math.min(120,Number(v.quiet)||0));}}
 newGame(v={}){this.board=initial();this.human=v.human===-1?-1:1;this.turn=1;this.difficulty=LEVELS.includes(v.difficulty)?v.difficulty:'normal';this.status='playing';this.winner=0;this.reason='';this.moves=[];this.quiet=0;}
 snapshot(){return {size:9,rows:10,board:this.board.slice(),human:this.human,turn:this.turn,difficulty:this.difficulty,status:this.status,winner:this.winner,reason:this.reason,quiet:this.quiet,moves:structuredClone(this.moves),inCheck:check(this.board,this.turn),rules:'休闲规则：长将方判负，其他三次重复和棋；不含赛事长捉裁定。'};}
 place(from,to,s=this.human){if(this.status!=='playing')throw Error('棋局已结束。');if(this.turn!==s)throw Error('还没有轮到你。');if(!legal(this.board,from,to,s))throw Error('这步不能走，请检查蹩马腿、炮架、将军和将帅照面。');const captured=this.board[to],before=this.board.slice(),quiet=this.quiet;this.board=moved(this.board,from,to);this.turn=-s;this.quiet=captured?0:quiet+1;const m={from,to,side:s,captured,before,quiet,check:check(this.board,-s),position:key(this.board,-s)};this.moves.push(m);if(this.board.indexOf(-s)<0||!moves(this.board,-s).length){this.status='won';this.winner=s;this.reason=m.check?'将死':'困毙';}else{const repeats=this.moves.filter(v=>v.position===m.position);if(repeats.length>=3){const start=this.moves.indexOf(repeats.at(-3)),cycle=this.moves.slice(start+1),checks=[1,-1].filter(p=>cycle.some(x=>x.side===p)&&cycle.filter(x=>x.side===p).every(x=>x.check));this.status=checks.length===1?'won':'draw';this.winner=checks.length===1?-checks[0]:0;this.reason=checks.length===1?'长将判负':'三次重复，休闲和棋';}else if(this.quiet>=120){this.status='draw';this.reason='双方各60步未吃子，和棋';}}return m;}
 ai(){if(this.turn===this.human||this.status!=='playing')return null;const m=choose(this.board,this.turn,this.difficulty,250);return m?this.place(m.from,m.to,this.turn):null;}
 undo(){if(!this.moves.length)throw Error('没有可以悔的棋。');do{const m=this.moves.pop();this.board=m.before.slice();this.turn=m.side;this.quiet=m.quiet;}while(this.moves.length&&this.turn!==this.human);this.status='playing';this.winner=0;this.reason='';}
 resign(){if(this.status!=='playing')throw Error('棋局已结束。');this.status='resigned';this.winner=-this.human;this.reason='认输';}
}
const digit=t=>'一二三四五六七八九'.indexOf(t)+1||Number(t),piece={帅:1,将:1,仕:2,士:2,相:3,象:3,马:4,車:5,车:5,炮:6,砲:6,兵:7,卒:7};
function parse(text,board,s=1){const t=String(text||'').trim().replace(/[，,。！!\s]/g,'');let m=t.match(/^([A-Ia-i])(10|[1-9])(?:到|至|-|→)([A-Ia-i])(10|[1-9])$/);if(m)return {from:(Number(m[2])-1)*9+m[1].toUpperCase().charCodeAt(0)-65,to:(Number(m[4])-1)*9+m[3].toUpperCase().charCodeAt(0)-65};m=t.match(/^([帅将仕士相象马車车炮砲兵卒])([一二三四五六七八九1-9])(进|退|平)([一二三四五六七八九1-9])$/);if(!m||!board)return null;const source=s===1?9-digit(m[2]):digit(m[2])-1,n=digit(m[4]),list=moves(board,s).filter(x=>Math.abs(board[x.from])===piece[m[1]]&&x.from%9===source).filter(x=>{const dr=Math.floor(x.to/9)-Math.floor(x.from/9);if(m[3]==='平')return !dr&&x.to%9===(s===1?9-n:n-1);if(Math.sign(dr)!==(m[3]==='进'?-s:s))return false;return [2,3,4].includes(piece[m[1]])?x.to%9===(s===1?9-n:n-1):Math.abs(dr)===n;});if(list.length!==1)throw Error('这句棋谱不能唯一确定合法落子，请用坐标，例如 H8→E8。');return {from:list[0].from,to:list[0].to};}
module.exports={Xiangqi,initial,pseudo,legal,moves,check,moved,choose,parse,NAMES,LEVELS};
