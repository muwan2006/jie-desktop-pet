'use strict';
const path=require('node:path'),{Worker}=require('node:worker_threads'),{LEVEL_SETTINGS}=require('./xiangqi.cjs');
function think(game,{signal,onWorker}={}){
 if(signal?.aborted)return Promise.reject(Error('象棋思考已取消。'));
 const budget=(LEVEL_SETTINGS[game.difficulty]||LEVEL_SETTINGS.normal).budget;
 return new Promise((resolve,reject)=>{let worker,timer,finished=false;
  const done=(error,move)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);worker?.terminate();error?reject(error):resolve(move);};
  const abort=()=>done(Error('象棋思考已取消。'));
  try{worker=new Worker(path.join(__dirname,'xiangqi-worker.cjs'),{workerData:{board:game.board,turn:game.turn,difficulty:game.difficulty,budget,history:game.moves||[]}});onWorker?.(worker);timer=setTimeout(()=>done(Error('象棋思考超时，请重试。')),budget+2500);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}worker.once('message',v=>done(v.error?Error(v.error):null,v.move));worker.once('error',()=>done(Error('象棋思考未完成，请重试。')));worker.once('exit',()=>{if(!finished)done(Error('象棋思考已停止。'));});}catch(error){done(error);}
 });
}
module.exports={think};
