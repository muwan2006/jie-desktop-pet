(function(root){
 'use strict';
 const definitions={
  classic:[['nod','轻轻点头','action',3400],['shake','摇头思考','action',3400],['greet','拢袖致意','action',3800],['unroll','展开书卷','action',4600],['roll','合上书卷','action',3800],['ponder','扶卷沉思','action',4400],['stretch','伸个懒腰','action',4200],['tail','摆尾回应','action',3800],['smile','浅浅一笑','expression',3400],['laugh','闭眼笑','expression',3600],['shy','有些害羞','expression',3600],['surprise','有些惊讶','expression',3000],['puzzled','疑惑','expression',3600],['serious','认真起来','expression',4000],['sleepy','有点困了','expression',4400],['comfort','温柔安慰','expression',4000]],
  desk:[['slow','慢慢敲字','action',4400],['fast','赶稿快敲','action',4400],['think','停下来思考','action',4600],['inspect','检查屏幕','action',4000],['chin','托腮片刻','action',4600],['rub','揉揉眼睛','action',3600],['stretch','伸个懒腰','action',4200],['nod','轻轻点头','action',3400],['smile','浅浅一笑','expression',3400],['laugh','会心一笑','expression',3600],['shy','被夸害羞','expression',3600],['typo','发现错字','expression',4000],['idea','灵感来了','expression',3400],['puzzled','有些疑惑','expression',3600],['sleepy','困意渐起','expression',4400],['relief','写完松口气','expression',3800]]
 };
 const catalog=Object.fromEntries(Object.entries(definitions).map(([form,rows])=>[form,rows.map(([id,label,kind,duration],frame)=>({id,form,label,kind,duration,frame,command:'emote:'+form+':'+id}))]));
 const byCommand=new Map(Object.values(catalog).flat().map(e=>[e.command,e]));
 function find(command){return typeof command==='string'?byCommand.get(command):undefined;}
 function active(emote,form,now){return !!emote&&emote.form===form&&find(emote.command)?.form===form&&emote.started<=now&&emote.until>now;}
 function alpha(emote,now){return Math.max(0,Math.min(1,(now-emote.started)/160,(emote.until-now)/180));}
 const layout=/*LAYOUT*/{"classic":[{"source":[0,0,314,324],"destination":[-6.29,19.348,389.087,401.478]},{"source":[314,0,313,324],"destination":[-7.316,20.587,387.848,401.478]},{"source":[627,0,313,324],"destination":[-3.386,19.348,387.848,401.478]},{"source":[940,0,314,324],"destination":[-9.413,19.348,389.087,401.478]},{"source":[0,324,314,303],"destination":[-6.066,40.413,389.087,375.457]},{"source":[314,324,313,303],"destination":[-8.777,41.652,387.848,375.457]},{"source":[627,324,313,303],"destination":[-1.959,39.174,387.848,375.457]},{"source":[940,324,314,303],"destination":[-4.902,41.652,389.087,375.457]},{"source":[0,627,314,302],"destination":[-3.851,45.37,389.087,374.217]},{"source":[314,627,313,302],"destination":[-10.506,42.891,387.848,374.217]},{"source":[627,627,313,302],"destination":[0.134,44.13,387.848,374.217]},{"source":[940,627,314,302],"destination":[-4.933,42.891,389.087,374.217]},{"source":[0,929,314,325],"destination":[-5.63,44.13,389.087,402.717]},{"source":[314,929,313,325],"destination":[-7.368,44.13,387.848,402.717]},{"source":[627,929,313,325],"destination":[-6.789,44.13,387.848,402.717]},{"source":[940,929,314,325],"destination":[-7.202,45.37,389.087,402.717]}],"desk":[{"source":[0,0,314,326],"destination":[-10.375,-36.622,532.924,553.291]},{"source":[314,0,313,326],"destination":[-7.863,-43.089,537.653,559.984]},{"source":[627,0,313,326],"destination":[0.462,-45.279,539.83,562.251]},{"source":[940,0,314,326],"destination":[2.699,-42.627,537.205,557.735]},{"source":[0,326,314,304],"destination":[-15.143,6.071,530.81,513.905]},{"source":[314,326,313,304],"destination":[-10.071,6.071,529.119,513.905]},{"source":[627,326,313,304],"destination":[3.452,6.071,529.119,513.905]},{"source":[940,326,314,304],"destination":[3.7,8.016,528.711,511.874]},{"source":[0,630,314,303],"destination":[-6.403,6.332,528.711,510.19]},{"source":[314,630,313,303],"destination":[-6.69,4.381,529.119,512.214]},{"source":[627,630,313,303],"destination":[1.506,0.717,531.227,514.255]},{"source":[940,630,314,303],"destination":[1.506,2.414,532.924,514.255]},{"source":[0,933,314,321],"destination":[-8.381,9.452,530.81,542.643]},{"source":[314,933,313,321],"destination":[-6.403,11.383,527.028,540.498]},{"source":[627,933,313,321],"destination":[3.203,7.506,531.227,544.805]},{"source":[940,933,314,321],"destination":[1.762,9.452,530.81,542.643]}]};
 function drawPose(ctx,sheet,form,index){const f=layout[form][index];ctx.drawImage(sheet,...f.source,...f.destination);}
 function frames(){return typeof module==='object'&&module.exports?require('./animation-frames.js'):root.JieFrames;}
 function repair(){return typeof module==='object'&&module.exports?require('./repair-animation.js'):root.JieRepair;}
 function timing(emote,now){
  const item=find(emote.command);if(!emote.held)return [now-emote.started,emote.until-emote.started];
  const remaining=emote.until-now;
  // Hold one complete emotional pose, blink briefly, then use its original exit.
  const elapsed=remaining<800?item.duration-remaining:(now-emote.started)%3200>2820?item.duration-750:800;
  return [Math.max(0,elapsed),item.duration];
 }
 function drawClassic(ctx,sheet,emote,now,width,height){
  if(!active(emote,'classic',now)||!frames().ready('classic'))return false;
  const item=find(emote.command),[elapsed,duration]=timing(emote,now);
  // Each pose contains the complete character. Never blend a second idle
  // character behind its transparent silhouette or fade its limbs separately.
  ctx.clearRect(0,0,width,height);
  if(root.JieClassicHD?.drawEmote(ctx,item.id,elapsed,duration,width,height))return true;
  // While a complete frame loads, let the pet renderer show the neutral whole
  // character. Do not flash the previous facial composite as a loading fallback.
  if(root.JieClassicHD?.wholeFrames&&root.JieClassicHD.enabled)return false;
  if(repair()?.ready('classic',item.id)){
   ctx.clearRect(0,0,width,height);
   return repair().draw(ctx,'classic',item.id,elapsed,duration,width,height);
  }
  ctx.save();ctx.scale(width/384,height/416);ctx.globalAlpha=1;
  frames().draw(ctx,'classic',item.id,elapsed,duration,Math.floor(height*370/416)*416/height);
  ctx.restore();return true;
 }
 function drawDeskExtra(ctx,deskSheet,extraSheet,emote,now,width,height,activity={}){
  if(!active(emote,'desk',now)||!frames().ready('desk'))return false;
  const item=find(emote.command),[elapsed,duration]=timing(emote,now);
  const deskApi=typeof module==='object'&&module.exports?require('./desk-animation.js'):root.JieDesk;
  if(item.id==='slow'||item.id==='fast'){
   deskApi.drawDesk(ctx,deskSheet,repair().typingFrame(elapsed,duration,item.id==='fast'),width,height);
   return true;
  }
  if(repair()?.ready('desk',item.id)){
   repair().draw(ctx,'desk',item.id,elapsed,duration,width,height);
   // Keyboard activity may temporarily replace only the original hand regions.
   // The original head, desk and the current expression remain intact.
   if(now-(activity.lastPress??-Infinity)<320&&item.kind==='expression'){
    ctx.save();ctx.scale(width/512,height/512);
    ctx.beginPath();ctx.rect(127,325,281,69);ctx.clip();ctx.clearRect(127,325,281,69);
    deskApi.drawDesk(ctx,deskSheet,Math.floor(now/110)%2?2:3,512,512);ctx.restore();
   }
   return true;
  }
  deskApi.drawDesk(ctx,deskSheet,0,width,height);
  const cut=Math.floor(height*394/512)*512/height;
  ctx.save();ctx.scale(width/512,height/512);ctx.beginPath();ctx.rect(0,0,512,cut);ctx.clip();ctx.clearRect(0,0,512,cut);
  frames().draw(ctx,'desk',item.id,elapsed,duration,cut);
  if(now-(activity.lastPress??-Infinity)<320&&item.kind==='expression'){
   const phase=frames().selectFrame('desk','fast',now%800+220,4400);
   for(const rect of [[127,326,137,68],[282,326,126,68]]){ctx.save();ctx.beginPath();ctx.rect(...rect);ctx.clip();ctx.clearRect(...rect);frames().pose(ctx,'desk','fast',phase);ctx.restore();}
  }
  ctx.restore();return true;
 }

 const api={catalog,find,active,alpha,timing,layout,drawClassic,drawDeskExtra};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.JieEmotes=api;
})(typeof globalThis==='object'?globalThis:this);
