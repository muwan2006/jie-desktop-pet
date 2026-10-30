'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function encode(file,{runtime,signal,run=spawn}){
 signal.throwIfAborted();const output=path.join(path.dirname(file),'delivery.mp3'),receipt=output+'.json',hash=sha(file);
 try{const r=JSON.parse(fs.readFileSync(receipt,'utf8'));if(r.sourceSha256===hash&&fs.statSync(output).size>1024&&fs.statSync(output).size<=32*1024*1024&&sha(output)===r.sha256)return {file:output,bytes:r.bytes,duration:r.duration};}catch{}
 const result=await new Promise((resolve,reject)=>{let child,raw='',done=false;const finish=(error,data)=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',abort);if(error)child?.kill();error?reject(error):resolve(data);},abort=()=>finish(Error('已取消歌曲音频导出。')),timer=setTimeout(()=>finish(Error('歌曲音频导出超时。')),180000);signal.addEventListener('abort',abort,{once:true});
  try{child=run(path.join(runtime,'soulx-runtime/Scripts/python.exe'),['-X','utf8','-B',path.join(__dirname,'singing-qq-file.py'),'--source',file,'--output',output],{windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.setEncoding('utf8');child.stdout.on('data',v=>{raw+=v;if(raw.length>10000)finish(Error('音频导出结果异常。'));});child.stderr.on('data',()=>{});child.once('error',()=>finish(Error('无法启动歌曲音频导出组件。')));child.once('close',code=>{if(done)return;try{const r=JSON.parse(raw);if(code!==0||!r.ok||r.sourceSha256!==hash||!r.sha256||sha(output)!==r.sha256)throw Error('歌曲音频导出未完成。');finish(null,r);}catch(e){finish(e);}});if(signal.aborted)abort();}catch(e){finish(e);}
 });
 fs.writeFileSync(receipt,JSON.stringify(result));return {file:output,bytes:result.bytes,duration:result.duration};
}
async function voices(file,{runtime,signal,run=spawn}){
 signal.throwIfAborted();const root=path.join(path.dirname(file),'qq-voice-v1'),receipt=path.join(root,'voice-parts.json'),hash=sha(file);
 const valid=r=>r?.ok&&r.sourceSha256===hash&&Array.isArray(r.parts)&&r.parts.length>0&&r.parts.length<=20&&r.parts.every(p=>/^voice-\d{2}\.wav$/.test(p.name)&&p.seconds>0&&p.seconds<=55.01&&fs.statSync(path.join(root,p.name)).size<=16000000&&sha(path.join(root,p.name))===p.sha256);
 const result=r=>({parts:r.parts.map(p=>({...p,file:path.join(root,p.name)})),duration:r.duration});
 try{const r=JSON.parse(fs.readFileSync(receipt,'utf8'));if(valid(r))return result(r);}catch{}
 fs.mkdirSync(root,{recursive:true});
 const data=await new Promise((resolve,reject)=>{let child,raw='',done=false;const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',abort);if(error)child?.kill();error?reject(error):resolve(value);},abort=()=>finish(Error('已取消歌曲语音导出。')),timer=setTimeout(()=>finish(Error('歌曲语音导出超时。')),180000);signal.addEventListener('abort',abort,{once:true});
  try{child=run(path.join(runtime,'soulx-runtime/Scripts/python.exe'),['-X','utf8','-B',path.join(__dirname,'singing-qq-voice.py'),'--source',file,'--output',root],{windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.setEncoding('utf8');child.stdout.on('data',v=>{raw+=v;if(raw.length>32000)finish(Error('歌曲语音导出结果异常。'));});child.stderr.on('data',()=>{});child.once('error',()=>finish(Error('无法启动歌曲语音导出组件。')));child.once('close',code=>{if(done)return;try{const r=JSON.parse(raw);if(code||!valid(r))throw Error('歌曲语音导出没有完成。');finish(null,r);}catch(e){finish(e);}});if(signal.aborted)abort();}catch(e){finish(e);}
 });
 fs.writeFileSync(receipt,JSON.stringify(data));return result(data);
}
module.exports={encode,voices};
