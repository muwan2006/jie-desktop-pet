'use strict';
function eligible(m){return !require('./qq-codex-command.cjs').command(m.text)&&!!m.text&&!m.proactive&&!m.record&&!m.poke&&!m.upload&&!m.images?.length&&!m.files?.length&&!m.forwards?.length&&!m.videos?.length&&!m.resumed&&!/记住|(?:打开|启动|提醒|便签|待办|专注|记下|后台|任务进度|取消任务|继续任务|暂停任务|撤回|改成|发起投票|发起报名|五子棋|围棋|猜数字|落子|悔棋|认输|结束游戏|报名|投票|查看棋盘|复盘)|^(?:简单|普通|困难|挑战|\d+)[。！!\s]*$/.test(m.text);}
class Burst{
 constructor(deliver,now=()=>Date.now()){this.deliver=deliver;this.now=now;this.items=new Map();}
 key(m){return [m.account,m.self,m.epoch,m.type,m.target,m.sender,m.replyId||'',m.topic||''].join(':');}
 has(m){return this.items.has(this.key(m));}
 add(m,seconds){const key=this.key(m),now=this.now();let b=this.items.get(key);if(b&&(now-b.started>=4000||b.rows.length>=8)){this.flush(key);b=null;}if(!b){if(this.items.size>=40)return false;b={rows:[],started:now};this.items.set(key,b);}b.rows.push({...m});clearTimeout(b.timer);b.due=Math.min(b.started+4000,now+seconds*1000);b.timer=setTimeout(()=>this.flush(key),Math.max(1,b.due-now));b.timer.unref?.();return true;}
 flush(key){const b=this.items.get(key);if(!b)return;this.items.delete(key);clearTimeout(b.timer);const last=b.rows.at(-1);if(!last)return;this.deliver({...last,text:b.rows.map(m=>m.text).join('\n').slice(0,3000),mention:b.rows.some(m=>m.mention),proactive:false,burst:b.rows.map(m=>({id:m.id,text:m.text,at:m.at})),mergedIds:b.rows.map(m=>m.id)});}
 remove(m){for(const [key,b]of this.items)if(b.rows.some(r=>r.type===m.type&&r.target===m.target&&r.sender===m.sender&&r.id===m.id)){clearTimeout(b.timer);this.items.delete(key);}}
 clear(){for(const b of this.items.values())clearTimeout(b.timer);this.items.clear();}
}
module.exports={eligible,Burst};
