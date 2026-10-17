'use strict';
function catalog(items,preference='favorites',used=new Map(),now=Date.now()){const weight=v=>preference==='favorites'?(v.builtin?0:2):preference==='builtin'?(v.builtin?2:0):1,recent=v=>used.has(v.id)&&now-used.get(v.id)<300000;return [...items].sort((a,b)=>weight(b)-weight(a)||Number(recent(a))-Number(recent(b))||(Number(b.collectedAt)||0)-(Number(a.collectedAt)||0)).map(v=>({...v,source:v.builtin?'内置':'本会话收藏',recentlyUsed:recent(v)}));}
function guidance(preference='favorites'){return {favorites:'优先使用本会话收藏的群友或好友表情包。特别留意新收藏且最近没用过的表情；同样贴切时优先选收藏，内置仅在收藏不适合或没有收藏时作为补充。不要为了使用收藏而乱配，也不要连续重复同一张。',builtin:'同样贴切时可以优先使用内置表情，收藏贴切时仍可使用；不连续重复同一张。',balanced:'内置与收藏都可以自然使用，同样贴切时多留意新收藏或最近未用过的表情，不连续重复同一张。'}[preference]||guidance('favorites');}
module.exports={catalog,guidance};
