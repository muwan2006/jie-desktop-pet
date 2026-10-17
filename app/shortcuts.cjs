'use strict';
const {definitions,defaults,validate,label}=require('./shortcut-keys.js');
class Shortcuts{
 constructor(saved,api,run,onChange=()=>{}){this.api=api;this.run=run;this.onChange=onChange;const incoming={...(saved?.keys||defaults)};if(saved?.keys&&!Object.hasOwn(incoming,'desktopVoice'))incoming.desktopVoice=Object.values(incoming).includes(defaults.desktopVoice)?'':defaults.desktopVoice;if(saved?.keys&&!Object.hasOwn(incoming,'fade'))incoming.fade=Object.values(incoming).includes(defaults.fade)?'':defaults.fade;this.keys=validate(incoming).keys||{...defaults};this.registered=new Map();this.errors={};this.capturing=false;this.captureTimer=null;}
 register(key,id){return this.api.register(key,()=>{if(!this.capturing)this.run(id);});}
 start(){for(const d of definitions.filter(d=>d.scope==='global')){const key=this.keys[d.id];if(key){try{if(this.register(key,d.id))this.registered.set(key,d.id);else this.errors[d.id]='快捷键被其他程序占用：'+label(key);}catch{this.errors[d.id]='此组合键无法注册：'+label(key);}}}this.onChange();}
 configure(input){
  const checked=validate(input);if(checked.error)return checked;const next=checked.keys,old={...this.keys},oldRegistered=new Map(this.registered),added=[];
  // Keep unchanged own registrations, release changed ones only; never unregister
  // another module's shortcuts or persist a half-successful configuration.
  for(const [key,id] of this.registered)if(next[id]!==key){this.api.unregister(key);this.registered.delete(key);}
  try{
   for(const d of definitions.filter(d=>d.scope==='global')){const key=next[d.id];if(!key||this.registered.get(key)===d.id)continue;if(!this.register(key,d.id))throw Error(d.label+'：快捷键被占用或系统不支持 '+label(key));this.registered.set(key,d.id);added.push(key);}
   this.keys=next;this.errors={};this.onChange();return {ok:true};
  }catch(e){
   for(const key of added){this.api.unregister(key);this.registered.delete(key);}
   const errors={};for(const [key,id] of oldRegistered)if(!this.registered.has(key)){try{if(this.register(key,id))this.registered.set(key,id);else errors[id]='原快捷键未能恢复，请重新设置。';}catch{errors[id]='原快捷键未能恢复，请重新设置。';}}
   this.keys=old;this.errors=errors;this.onChange();return {error:e.message+'。未保存这次修改，原设置保留。'};
  }
 }
 capture(active){this.capturing=!!active;clearTimeout(this.captureTimer);if(active){this.captureTimer=setTimeout(()=>{this.capturing=false;this.onChange();},20000);this.captureTimer.unref?.();}this.onChange();}
 snapshot(){return {keys:{...this.keys},errors:{...this.errors},capturing:this.capturing};}
 save(){return {keys:{...this.keys}};}
 stop(){clearTimeout(this.captureTimer);for(const key of this.registered.keys())this.api.unregister(key);this.registered.clear();}
}
module.exports={Shortcuts};
