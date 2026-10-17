'use strict';
const layout=displays=>JSON.stringify(displays.map(d=>({id:String(d.id),x:d.bounds?.x,y:d.bounds?.y,width:d.bounds?.width,height:d.bounds?.height,scale:d.scaleFactor})).sort((a,b)=>a.id.localeCompare(b.id)));
const nativeId=source=>String(source.display_id??'');
function displayTarget(source,sources,displays){
 const screens=sources.filter(s=>s.id.startsWith('screen:')),kind=source.id.startsWith('screen:')?'screen':'window';
 const reported=nativeId(source);let displayId=reported;
 // A sole source and sole display are unambiguous; never guess multi-display order.
 if(kind==='screen'&&!displayId&&screens.length===1&&displays.length===1)displayId=String(displays[0].id);
 return {id:source.id,label:source.name.slice(0,200),kind,displayId,...(kind==='screen'&&!reported?{displayLayout:layout(displays)}:{})};
}
function selectedDisplay(target,displays){
 if(target.kind==='window')return null;
 if(target.displayLayout!==undefined&&target.displayLayout!==layout(displays))throw Error('屏幕连接发生变化，请刷新后重新选择。');
 const display=displays.find(d=>String(d.id)===String(target.displayId));
 if(!display&&(target.kind==='region'||target.displayId))throw Error('原屏幕已断开，请重新选择。');
 if(target.kind==='region'&&(display.bounds.width!==target.bounds?.width||display.bounds.height!==target.bounds?.height||display.bounds.x!==target.bounds?.x||display.bounds.y!==target.bounds?.y||display.scaleFactor!==target.scaleFactor))throw Error('屏幕尺寸、位置或缩放已改变，请重新框选。');
 return display||null;
}
function selectedSource(target,sources,displays){
 if(target.kind!=='region'){
  const source=sources.find(s=>s.id===target.id);if(!source)return null;
  if(target.kind==='screen'&&nativeId(source)&&target.displayId&&nativeId(source)!==String(target.displayId))return null;
  return source;
 }
 const matching=sources.find(s=>s.id.startsWith('screen:')&&nativeId(s)&&nativeId(s)===String(target.displayId));if(matching)return matching;
 const screens=sources.filter(s=>s.id.startsWith('screen:'));
 return screens.length===1&&!nativeId(screens[0])&&displays.length===1&&String(displays[0].id)===String(target.displayId)?screens[0]:null;
}
module.exports={displayTarget,selectedDisplay,selectedSource};
