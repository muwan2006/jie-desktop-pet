'use strict';
window.qqDecode=url=>new Promise((resolve,reject)=>{
 if(typeof url!=='string'||!/^data:image\/(gif|webp);base64,/.test(url)){reject(Error('动图格式无效。'));return;}
 const image=new Image();image.onerror=()=>reject(Error('QQ动图无法读取。'));image.onload=()=>{try{const width=image.naturalWidth,height=image.naturalHeight;if(width<1||height<1||width*height>50000000)throw Error('QQ动图尺寸过大。');const scale=Math.min(1,2560/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/png'));}catch(e){reject(e);}};image.src=url;
});
