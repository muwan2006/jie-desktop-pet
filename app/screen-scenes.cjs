'use strict';
function difference(a,b){
 if(!a||!b||a.length!==b.length)return {average:255,maxTile:255,changed:true,abrupt:false};
 const width=a.length===64*36*4?64:a.length===32*18*4?32:0,height=width?a.length/(width*4):0,tiles=Array.from({length:12},()=>({sum:0,count:0}));let sum=0,count=0;
 for(let i=0;i<a.length;i++){if(width&&i%4===3)continue;const d=Math.abs(a[i]-b[i]);sum+=d;count++;if(width){const p=Math.floor(i/4),x=p%width,y=Math.floor(p/width),t=tiles[Math.min(2,Math.floor(y*3/height))*4+Math.min(3,Math.floor(x*4/width))];t.sum+=d;t.count++;}}
 const average=sum/Math.max(1,count),maxTile=width?Math.max(...tiles.map(t=>t.sum/Math.max(1,t.count))):average;
 return {average,maxTile,changed:average>=3||maxTile>=9,abrupt:average>=22||maxTile>=55};
}
function imagePart(f){return {type:'input_image',image_url:f.data,detail:'auto'};}
function validFrame(f){return typeof f?.data==='string'&&/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(f.data)&&f.data.length<=8*1024*1024;}
class FrameWindow{
 constructor(){this.clear();}
 clear(){this.frames=[];this.peak=null;this.beforePeak=null;}
 push(frame,delta){const previous=this.frames.at(-1);this.frames.push(frame);if(delta.abrupt){this.peak=frame;this.beforePeak=previous||null;}while(this.frames.length>8||this.frames.length>1&&this.frames.reduce((n,f)=>n+f.data.length,0)>12*1024*1024)this.frames.shift();this.prune(frame.at);}
 prune(now){this.frames=this.frames.filter(f=>now-f.at<=15000);if(this.peak&&now-this.peak.at>12000){this.peak=null;this.beforePeak=null;}}
 bundle(now){this.prune(now);const last=this.frames.at(-1);if(!last)return [];const selected=this.peak?[this.beforePeak,this.peak,last]:[this.frames.at(-3)||this.frames[0],last];return [...new Set(selected.filter(Boolean))].sort((a,b)=>a.at-b.at).slice(-3);}
}
function words(s){return [...new Set((String(s).toLowerCase().replace(/[\s，。！？、,.!?“”"']/g,'')).match(/.{1,2}/g)||[])];}
function repeated(reply,previous){const a=words(reply);return previous.some(p=>{const b=words(p.reply||p);return a.length&&a.filter(w=>b.includes(w)).length/Math.max(a.length,b.length)>=.8;});}
module.exports={difference,imagePart,validFrame,FrameWindow,repeated};
