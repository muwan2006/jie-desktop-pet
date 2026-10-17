'use strict';
const color=p=>p===1?'黑棋':'白棋';
function context(game,lastMove={},recentReplies=[]){
 const self=3-game.human,user=game.human,last=game.moves.at(-1);
 const describe=m=>m?{actor:m.player===self?'颉':'用户',subject:m.player===self?'我':'你',color:color(m.player),row:m.row+1,column:m.col+1}:null;
 const outcome=game.status==='draw'?'平局':['won','resigned'].includes(game.status)?game.winner===self?'颉赢了，用户输了':'用户赢了，颉输了':'对局进行中';
 return {participants:{self:{name:'颉',pronoun:'我',stone:self,color:color(self)},user:{name:'用户',pronoun:'你',stone:user,color:color(user)}},rules:'15路自由五子棋，五子或长连获胜，无禁手。',outcome,turn:game.status==='playing'?game.turn===self?'颉':'用户':null,lastMove:describe(last),moveReason:lastMove.reason||'position',recentMoves:game.moves.slice(-6).map(describe),boardLegend:'X=黑棋，O=白棋，.=空位；每一行自左向右为第1至15列。行列从1开始。',rows:Array.from({length:15},(_,r)=>({row:r+1,cells:game.board.slice(r*15,r*15+15).map(p=>p===1?'X':p===2?'O':'.').join('')})),recentReplies:recentReplies.slice(-3)};
}
function prompt(card,c){
 const role=String(card?.text||'').trim();
 const instructions=`你就是颉，正在与用户下五子棋，请按下面角色卡的性格、日常口吻和相处方式说一句对局中的话。你是下棋的人，用“我”指颉，用“你”指用户。你执${c.participants.self.color}，用户执${c.participants.user.color}；换先后手也必须按本轮身份说话。\n先表现自己的想法、心情或与用户的互动，必要时只带一个真实棋局细节。可以轻轻逗他、接他一步棋、承认自己的失误、得意或认输，具体语气服从角色卡。不要充当解说员，不要只罗列黑棋白棋局势，不要称自己为“她”“AI”“双方”，不要每次重复坐标或套用书卷比喻。\n棋局数据是唯一事实依据：lastMove.actor 是刚刚落子的本人，outcome 指明真实输赢，不能倒置身份、抢称胜利、捏造连子或自己的落子。recentReplies 用于避免重复。角色卡只决定人格与口吻，不改变棋局事实。\n一句自然的中文口语，最多70字，不要网址、Markdown、动作或电脑操作指令。返回JSON {"text":"台词","speakerColor":"${c.participants.self.color}","lastActor":"${c.lastMove?.actor||'无'}"}。\n以下为当前用户设置的角色卡，请实际按它扮演：\n${role||'颉，说话温和、简短，和用户熟悉自然地相处。'}`;
 return {instructions,input:JSON.stringify(c)};
}
function reply(result,c){if(result?.speakerColor!==c.participants.self.color||result?.lastActor!==(c.lastMove?.actor||'无'))return null;const t=typeof result.text==='string'?result.text.trim():'';return t&&t.length<=100&&!/https?:\/\/|[<>`]|[\r\n]/i.test(t)?t:null;}
function fallback(c){if(c.outcome==='平局')return '这一盘谁也没让谁。再下一局？';if(c.outcome==='用户赢了，颉输了')return '好，这一局是你赢了。我可记着这一步，下回再来。';if(c.outcome==='颉赢了，用户输了')return '这一局我先收下了。别急着收棋，再陪我下一盘？';if(c.moveReason==='block')return '这一步得挡住你了，差点就让你把路走通了。';if(c.lastMove?.actor==='用户')return '你这一步，我可得认真看看了。';return '我这一步落好了。来，让我看看你接下来怎么走。';}
module.exports={context,prompt,reply,fallback};
