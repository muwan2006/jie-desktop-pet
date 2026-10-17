'use strict';
const {parentPort,workerData}=require('node:worker_threads'),{choose}=require('./xiangqi.cjs');
try{parentPort.postMessage({move:choose(workerData.board,workerData.turn,workerData.difficulty,workerData.budget||600)});}catch{parentPort.postMessage({error:'象棋思考未完成，请重试。'});}
