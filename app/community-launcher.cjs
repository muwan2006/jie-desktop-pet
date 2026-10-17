'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
// Windows PowerShell exits without executing -File when launched DETACHED_PROCESS.
// A short-lived normal broker uses ShellExecute to start a hidden independent host.
async function launchMaintenance(job,h={}){
 const config=JSON.parse(fs.readFileSync(job,'utf8').replace(/^\uFEFF/,'')),root=path.resolve(h.root||__dirname),directory=path.resolve(config.directory);
 if(path.resolve(config.root)!==root)throw Error('安装任务与当前基础版不一致。');
 const id=path.basename(job,'.json'),ready=path.join(directory,'community-jobs',id+'.ready.json'),log=path.join(directory,'community-jobs',id+'.startup.log');
 fs.mkdirSync(path.dirname(ready),{recursive:true});if(fs.existsSync(ready))fs.unlinkSync(ready);
 config.readyPath=ready;config.logPath=path.join(directory,'community-jobs',id+'.maintenance.log');
 fs.writeFileSync(job,JSON.stringify(config,null,2));
 const fd=fs.openSync(log,'a'),exe=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
 let child;try{child=(h.spawn||spawn)(exe,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'community-launch.ps1'),'-Job',path.resolve(job)],{windowsHide:true,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
 let exited=false,exitCode,error;child.once('exit',code=>{exited=true;exitCode=code;});child.once('error',e=>{error=e;});
 const deadline=Date.now()+(h.timeout||15000);
 while(Date.now()<deadline){
  if(fs.existsSync(ready)){const status=JSON.parse(fs.readFileSync(ready,'utf8').replace(/^\uFEFF/,''));if(status.ok&&status.root===root&&status.job===path.resolve(job)&&Number.isInteger(status.pid)&&status.pid>0)return {pid:status.pid,ready,log};}
  if(error||exited&&exitCode!==0)break;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('安装程序未确认接手，桌宠不会退出。请重试；启动记录：'+path.basename(log));
}
module.exports={launchMaintenance};
