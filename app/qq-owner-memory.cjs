'use strict';
const Knowledge=require('./qq-knowledge.cjs'),Memory=require('./qq-memory.cjs'),Feedback=require('./qq-feedback.cjs');
const clip=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
function requested(m,owner){return !!owner&&m.sender===owner&&!m.proactive&&(m.type==='private'||m.type==='group'&&m.mention===true)&&typeof m.text==='string'&&m.text.includes('记住')&&!/(?:不要|不用|别|无需|不必|不想让你)\s*记住/.test(m.text);}
function payload(raw){const s=clip(raw,3000).replace(/^(?:小小颉|小颉|颉)[，,：:\s]*/,'');const at=s.indexOf('记住');let body=s.slice(at+2).replace(/^(?:了|一下)?[，,：:\s]*/,'').replace(/[。！!]+$/,'').trim();if(!body)body=s.slice(0,at).replace(/(?:请|帮我|给我|要|你|得|务必|一定|也|都|就)[，,：:\s]*$/,'').replace(/[，,：:\s]+$/,'').trim();return clip(body,1800);}
function name(body){const corrected=body.match(/(?:不是|误认成|误认作|错认成)[^，。；\n]{1,30}[，,；;\s]+(?:而?是|应该是|其实是)[“"「]?([\p{L}\p{N}·_-]{1,30})/u);if(corrected)return corrected[1];let value=Knowledge.command('记住'+body);if(value?.kind==='identity')return value.label;const match=body.match(/(?:(?:图(?:片)?(?:里|中)?(?:的)?(?:人|角色)?|这(?:张|个|位)?(?:人物|角色|人|图)?|画的|画的是|名字|认成|认作)[^，。；！？\n]{0,8}?(?:就是|是|叫(?:作)?|为)|^)([\p{L}\p{N}·_-]{1,30}?)(?:[，。；\s]|$|是.{0,12}(?:姐姐|哥哥|妹妹|弟弟|兄弟|姐妹))/u);const label=match?.[1]||'';return /^(?:谁|什么|哪|不知道|不确定)/.test(label)?'':label;}
function hint(body){return /这(?:张|个|位)?(?:图|图片|角色|人)|图(?:中|里)|识图|角色|认(?:成|作)|这(?:就是|是)|画的|姐姐|哥哥|妹妹|弟弟|兄弟|姐妹/.test(body);}
function habitText(body){return body.replace(/(?:尽量|最好|以后|都要|要|请)?(?:回复|说话|回答)(?:尽量|要)?(?:简洁|精炼|短点)/g,'回复简短一点').replace(/(?:以后|都)?(?:少用|不用|不发)(?:表情包)/g,'不要发表情包').replace(/(?:称呼|叫)(?:我)?(?:少点|少一点)/g,'少称呼');}
function apply(c,m,{owner,reference=null,social=null,now=Date.now()}={}){
 if(!requested(m,owner))return null;
 let body=payload(m.text);const fromQuote=social?.quoted;
 if(!body||/^(?:这个|这条|这段|上面|刚才|上面的|刚才的)(?:内容|消息|资料|安排)?[。！!\s]*$/.test(body)){
  if(fromQuote?.text&&!fromQuote.error){body=clip(fromQuote.text,1800);}else return {text:'你想让我记住哪段内容？把内容接在“记住”后，或引用那条消息再说“记住这个”就行。',saved:false};
 }
 if(/^(?:吗|么|了|什么|了吗|了吗[？?])$/.test(body))return {text:'这句像是在问我是否记得。要新增资料，直接说“记住”加上具体内容就好。',saved:false};
 let kind='fact',label=body.slice(0,40),meaning=body;
 const legacy=Knowledge.command('记住'+body);const identity=name(body);
 if(reference&&hint(body)&&identity){kind='identity';label=identity;meaning=body;}
 else if(legacy?.kind==='meme'){kind='meme';label=legacy.label;meaning=legacy.meaning;}
 else if(/群梗|这个梗|外号|典故/.test(body)){kind='meme';const match=body.match(/^(?:群梗|这个梗|梗|外号|典故)[：:\s]*(.{1,40}?)(?:[=＝：:]|(?:的?意思是))([\s\S]+)/);if(match){label=match[1].trim();meaning=match[2].trim();}}
 c.summary='';const added=Knowledge.add(c,{kind,label,meaning},m,{owner,fingerprint:kind==='identity'?reference.fingerprint:null,sourceId:kind==='identity'?reference.sourceId:m.id});
 Memory.apply(c,[{sourceId:m.id,sender:m.sender,quote:m.text.slice(0,1000),label,tags:['主人指定',kind]}]);
 const adjusted=habitText(body),entries=Feedback.intent(adjusted);let feedback='';
 if(entries.length){feedback=Feedback.apply(c,{...m,text:adjusted+(m.type==='group'&&!/只对我|与我|和我|给我|对我说/.test(body)?' 在这个群':'')},owner,{explicit:true,quote:m.text,sourceId:m.id});}
 const where=m.type==='group'?'本群':'与你的私聊';let text='记住了：'+label+'。已保存到'+where+'的会话资料'+(kind==='identity'?'，并绑定参考图':'')+'。';
 if(added.entry.expiresAt)text+='有效至'+new Date(added.entry.expiresAt-1).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'})+'。';if(added.entry.status==='completed')text+='这件事已完成，不再作为待办提醒。';if(feedback)text+='聊天习惯也已调整。';else if(hint(body)&&identity&&!reference)text+='当前没有读到参考图，先保留文字；发原图或引用图片再说“记住”即可绑定。';
 return {saved:true,text,entry:added.entry,kind,habit:!!feedback};
}
module.exports={requested,payload,name,hint,apply};
