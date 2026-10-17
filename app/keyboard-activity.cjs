'use strict';
const path=require('node:path');
const {spawn}=require('node:child_process');
class KeyboardActivity{
 constructor({platform=process.platform,spawnProcess=spawn,onPress=()=>{},onStatus=()=>{}}={}){
  this.platform=platform;this.spawnProcess=spawnProcess;this.onPress=onPress;this.onStatus=onStatus;this.child=null;this.status='off';
 }
 setStatus(status){if(this.status!==status){this.status=status;this.onStatus(status);}}
 start(){
  if(this.child)return;
  if(this.platform!=='win32'){this.setStatus('unsupported');return;}
  this.setStatus('starting');
  let child;
  try{child=this.spawnProcess('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'keyboard-activity.ps1')],{windowsHide:true,stdio:['ignore','pipe','pipe']});}
  catch{this.setStatus('unavailable');return;}
  this.child=child;let pending='';
  child.stdout?.on('data',data=>{
   if(this.child!==child)return;pending+=data.toString();
   if(pending.length>1024){pending='';return;}
   let end;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end).trim();pending=pending.slice(end+1);
    if(line==='READY')this.setStatus('ready');
    else if(line==='PRESS')this.onPress();
   }
  });
  child.stderr?.on('data',()=>{});
  const ended=()=>{if(this.child===child){this.child=null;this.setStatus('unavailable');}};
  child.on('error',ended);child.on('exit',ended);
 }
 stop(){const child=this.child;this.child=null;this.setStatus('off');if(child){try{child.kill();}catch{}}}
}
module.exports={KeyboardActivity};
