'use strict';
const STORIES={
 letter:{title:'夜灯下的来信',intro:'原创互动故事 · 约5分钟 · 可随时保存离开',start:'letter',nodes:{
 letter:{text:'桌边多了一封没有署名的信。颉把它移到灯下：“墨还没干。你看，这里是不是留了什么？”',choices:[{id:'ink',label:'借灯光检查墨迹',next:'route',flag:'ink'},{id:'seal',label:'先看信封的落款',next:'route',flag:'seal'}]},
 route:{text:'纸上只留着一句“第三声钟响前”。颉望向窗外：“南边是旧书铺，北边是渡口。我们先往哪边走？”',choices:[{id:'shop',label:'去旧书铺问问',next:'shop',flag:'shop'},{id:'river',label:'去渡口找送信人',next:'river',flag:'river'}]},
 shop:{text:'书铺掌柜递来一本缺了书签的诗集。颉没有急着翻完：“要找东西，就先看留下的痕迹。”',choices:[{id:'margin',label:'比对信上的墨与页边批注',next:'choice',flag:'proof'},{id:'ask',label:'问掌柜是谁借走了诗集',next:'choice',flag:'witness'}]},
 river:{text:'渡口的小舟已经离岸，石阶上压着一枚竹叶书签。颉捡起来：“没有白来，至少它还在这里。”',choices:[{id:'leaf',label:'查看书签背面',next:'choice',flag:'proof'},{id:'wait',label:'留在渡口等下一班船',next:'choice',flag:'patience'}]},
 choice:{text:'钟声将响。颉把信与找到的线索摆在一起：“现在下结论还早。我们可以继续核对，也可以先把东西送回去。”',choices:[{id:'verify',label:'核对笔迹与书签',next:'truth',requires:'proof'},{id:'return',label:'把线索留在书铺，等失主认领',next:'gentle'},{id:'guess',label:'先凭直觉猜寄信的人',next:'open'}]},
 truth:{text:'书签与信上的细纹恰好吻合。原来是书铺学徒给未来的自己留的一封信。颉轻轻合上诗集：“这一回，是线索带着我们走到了这里。”',ending:'找到来信的主人'},
 gentle:{text:'第三声钟落下，你们没有等到失主，却替他留住了一页归处。颉在旁边补了一张便签：“找东西的人，总会再回头看看。”',ending:'留一页归处'},
 open:{text:'你们猜了几个名字，仍没有足够的证据。颉把信收进纸袋：“没查清就先不认定。下次有新线索，再接着找。”',ending:'仍待续写的信'}
 }},
 bamboo:{title:'竹影里的小约定',intro:'原创互动故事 · 约3分钟 · 三种结局',start:'start',nodes:{
 start:{text:'风把一页未写完的纸吹到青竹旁。颉按住纸角：“只剩半句话。我们替它续上，还是先找找原来的那一半？”',choices:[{id:'find',label:'寻找掉落的半页',next:'search',flag:'find'},{id:'write',label:'一起续写半句话',next:'write',flag:'write'}]},
 search:{text:'花盆背后藏着半页手写的清单，都是些很小的愿望。颉笑了笑：“最后一项还空着，留给今天怎样？”',choices:[{id:'walk',label:'一起看看窗外的天色',next:'sky'},{id:'keep',label:'先把纸好好收藏',next:'keep'}]},
 write:{text:'颉把笔推到你手边：“不必写得多漂亮。就留一句，你现在真的想说的话。”',choices:[{id:'thanks',label:'写下今天的小小感谢',next:'thanks'},{id:'keep',label:'留白，给未来的自己',next:'keep'}]},
 sky:{text:'你们看了一会儿天色，回来时，最后一项已经有了答案。颉把纸夹好：“原来腾出这一小会儿，也算完成了一件事。”',ending:'看过同一片天'},
 thanks:{text:'那一句话被折成小小的书签。颉看着它，语气轻下来：“写下来了，就不容易被忙碌挤走。”',ending:'把感谢留下'},
 keep:{text:'你们给空白留了一个位置。颉没有催促，只把纸压平：“有些话，等想好了再写。”',ending:'留白也是约定'}
 }}
};
const safe=(v,n=200)=>typeof v==='string'?v.trim().slice(0,n):'';
function restore(v={}){const story=Object.hasOwn(STORIES,v.story)?v.story:'letter',data=STORIES[story],node=Object.hasOwn(data.nodes,v.node)?v.node:data.start;return {story,node,flags:[...new Set((Array.isArray(v.flags)?v.flags:[]).filter(x=>/^[a-z-]{1,30}$/.test(x)))].slice(0,20),history:(Array.isArray(v.history)?v.history:[]).slice(-60).map(x=>({node:safe(x.node,30),choice:safe(x.choice,30),label:safe(x.label,100),note:safe(x.note,200),at:Number(x.at)||0})),revision:Math.max(0,Number(v.revision)||0),updatedAt:Number(v.updatedAt)||0};}
function view(raw){const s=restore(raw),data=STORIES[s.story],node=data.nodes[s.node];return {...s,title:data.title,intro:data.intro,text:node.text,ending:node.ending||'',choices:(node.choices||[]).filter(c=>!c.requires||s.flags.includes(c.requires)).map(c=>({id:c.id,label:c.label})),catalog:Object.entries(STORIES).map(([id,v])=>({id,title:v.title,intro:v.intro}))};}
function advance(raw,id,note='',expected,now=Date.now()){const s=restore(raw);if(expected!==undefined&&expected!==s.revision)throw Error('剧情已经更新，请查看当前段落后再选。');const choice=STORIES[s.story].nodes[s.node].choices?.find(c=>c.id===id&&(!c.requires||s.flags.includes(c.requires)));if(!choice)throw Error('当前剧情没有这个选项。');s.history.push({node:s.node,choice:choice.id,label:choice.label,note:safe(note,200),at:now});if(choice.flag&&!s.flags.includes(choice.flag))s.flags.push(choice.flag);s.node=choice.next;s.revision++;s.updatedAt=now;return s;}
function start(id){if(!Object.hasOwn(STORIES,id))throw Error('没有找到这个故事。');return restore({story:id});}
module.exports={STORIES,restore,view,advance,start};
