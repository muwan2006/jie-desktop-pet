'use strict';
{const compose=window.composeAtelier;window.composeAtelier=async v=>{
 if(!v.animated||v.kind!=='sticker')return compose(v);
 if(typeof ImageDecoder==='undefined'||!await ImageDecoder.isTypeSupported('image/gif'))throw Error('当前环境不支持动画解码，请选择静态表情。');
 const bytes=Uint8Array.from(atob(v.foreground.split(',')[1]),x=>x.charCodeAt(0)),decoder=new ImageDecoder({data:bytes,type:'image/gif'}),source=document.createElement('canvas');
 try{await decoder.tracks.ready;const frames=[];for(let i=0;i<Math.min(80,decoder.tracks.selectedTrack.frameCount);i++){const {image}=await decoder.decode({frameIndex:i,completeFramesOnly:true});try{source.width=image.displayWidth;source.height=image.displayHeight;source.getContext('2d').drawImage(image,0,0);await compose({...v,animated:false,foreground:source.toDataURL('image/png')});const canvas=document.getElementById('canvas');frames.push({pixels:canvas.getContext('2d').getImageData(0,0,512,512).data,duration:Math.max(30,Math.min(500,(image.duration||100000)/1000))});}finally{image.close();}}const encoded=window.JieGif.encode(512,512,frames);let binary='';for(let i=0;i<encoded.length;i+=32768)binary+=String.fromCharCode(...encoded.subarray(i,i+32768));return 'data:image/gif;base64,'+btoa(binary);}finally{decoder.close();}
};}
