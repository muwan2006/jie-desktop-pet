'use strict';
(()=>{
 const video=document.querySelector('#source'),canvas=document.createElement('canvas'),small=document.createElement('canvas'),preview=document.createElement('canvas');small.width=64;small.height=36;
 let stream=null,timer=null,last=null,peak=null,beforePeak=null,ended=false,config=null;
 function delta(a,b){if(!a||a.length!==b.length)return 0;let sum=0,max=0;const groups=Array.from({length:12},()=>({sum:0,count:0}));for(let i=0;i<b.length;i++){if(i%4===3)continue;const d=Math.abs(b[i]-a[i]),p=Math.floor(i/4),t=groups[Math.floor(Math.floor(p/64)*3/36)*4+Math.floor((p%64)*4/64)];sum+=d;t.sum+=d;t.count++;}max=Math.max(...groups.map(t=>t.sum/t.count));return Math.max(sum/(64*36*3)/22,max/55);}
 function sample(){
  if(ended||video.readyState<2||!video.videoWidth)return;const r=config.rect,b=config.bounds;let x=0,y=0,w=video.videoWidth,h=video.videoHeight;
  if(r){x=Math.max(0,r.x/b.width*w);y=Math.max(0,r.y/b.height*h);w=Math.min(video.videoWidth-x,r.width/b.width*video.videoWidth);h=Math.min(video.videoHeight-y,r.height/b.height*video.videoHeight);}
  const factor=Math.min(1,1600/Math.max(w,h));canvas.width=Math.max(2,Math.round(w*factor));canvas.height=Math.max(2,Math.round(h*factor));canvas.getContext('2d').drawImage(video,x,y,w,h,0,0,canvas.width,canvas.height);
  const ctx=small.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,64,36);const fingerprint=Array.from(ctx.getImageData(0,0,64,36).data),at=Date.now();preview.width=200;preview.height=Math.max(1,Math.round(200*canvas.height/canvas.width));preview.getContext('2d').drawImage(canvas,0,0,preview.width,preview.height);
  const frame={data:canvas.toDataURL('image/jpeg',.85),preview:preview.toDataURL('image/png'),fingerprint,at};if(last&&delta(last.fingerprint,fingerprint)>=1){beforePeak=last;peak=frame;}last=frame;if(peak&&at-peak.at>12000){peak=null;beforePeak=null;}
 }
 window.captureStart=async value=>{config=value;stream=await navigator.mediaDevices.getDisplayMedia({audio:false,video:{frameRate:{ideal:15,max:15}}});stream.getVideoTracks()[0].addEventListener('ended',()=>{ended=true;last=null;peak=null;beforePeak=null;clearInterval(timer);});video.srcObject=stream;await video.play();sample();timer=setInterval(sample,200);return {ok:true};};
 window.captureRead=()=>({ended,frame:last,peak,beforePeak});window.captureStop=()=>{ended=true;clearInterval(timer);stream?.getTracks().forEach(t=>t.stop());last=null;peak=null;beforePeak=null;};
})();
