'use strict';
const modes=['text','voice','sticker','reaction','text_sticker','voice_sticker','text_voice'];
function normalize(v){return modes.includes(v)?v:'';}
function requested(m={}){
 const t=String(m.text||'');
 if(/(?:别|不要|不用|不许|不能).{0,5}(?:语音|朗读)|(?:只|改用|用)发?文字|打字(?:回|说|给)|不方便听/.test(t))return 'text';
 if(/(?:只|就).{0,4}(?:发|回|用).{0,4}表情|(?:发|回)个?表情(?:包)?(?:就行|就好|即可)/.test(t))return 'sticker';
 if(/(?:发|用|来|回).{0,6}语音|说给我听|读给我听|念给我听|(?:想|要)听你(?:说|讲|的声音)/.test(t))return 'voice';
 return '';
}
function plan(result,pref,m,{voiceAvailable=true,stickerAvailable=false}={}){
 const explicit=requested(m),selected=normalize(result.delivery);let mode=selected,fallback='';
 if(m.fileRequested||result.document||result.taskOutput)mode='text';
 else if(explicit==='text')mode='text';
 else if(explicit==='voice')mode=pref.voiceMode==='text'?'text':'voice';
 else if(explicit==='sticker')mode=stickerAvailable?'sticker':'text';
 else if(pref.voiceMode==='both'&&result.text)mode='text_voice';
 else if(pref.voiceMode==='voice'&&result.text&&!['sticker','reaction'].includes(mode))mode='voice';
 else if(!mode)mode=pref.voiceMode==='auto'&&m.record&&voiceAvailable?'voice':result.text?'text':stickerAvailable?'sticker':'reaction';
 let text=['text','text_sticker','text_voice'].includes(mode),voice=['voice','voice_sticker','text_voice'].includes(mode),sticker=['sticker','text_sticker','voice_sticker'].includes(mode)||!selected&&stickerAvailable&&explicit!=='text'&&explicit!=='voice';
 if(voice&&(pref.voiceMode==='text'||!voiceAvailable)){fallback=pref.voiceMode==='text'?'voice-disabled':'voice-unavailable';voice=false;text=!!result.text;}
 if(voice&&String(result.text||'').length>500&&!explicit){fallback='voice-too-long';voice=false;text=true;}
 if(sticker&&!stickerAvailable){fallback='sticker-unavailable';sticker=false;text=!!result.text;}
 if(!text&&!voice&&!sticker&&mode!=='reaction')text=!!result.text;
 if(mode==='reaction'&&!result.reaction)text=!!result.text;
 return {mode,text,voice,sticker,fallback,reaction:mode==='reaction'||!selected&&!!result.reaction};
}
function options(pref={},m={},stickers=[],voiceAvailable=true){return {voiceAvailable:voiceAvailable&&pref.voiceMode!=='text',stickerAvailable:pref.stickers!==false&&stickers.length>0,allowed:modes.filter(v=>!(pref.voiceMode==='text'||!voiceAvailable)&&v.includes('voice')||!v.includes('voice')).filter(v=>pref.stickers!==false&&stickers.length||!v.includes('sticker')).filter(v=>v!=='reaction'||m.type==='group'&&pref.emojiReplies!==false)};}
function protocol(pref={},m={},stickers=[]){const available=options(pref,m,stickers,m.expressionOptions?.voiceAvailable!==false),example=stickers.find(v=>/笑|开心|高兴|得意/.test(v.label+' '+(v.tags||[]).join(' ')))||stickers[0],examples=[];
 if(available.stickerAvailable)examples.push('接住一个笑点或轻巧应声，表情本身已足够时：'+JSON.stringify({delivery:'sticker',reply:'',sticker:example.id,skip:false,contribution:'continuation'}));
 if(available.voiceAvailable)examples.push('想亲口送达一句短短的感谢、安慰或带笑的回应，对方未要求语音也可选择：'+JSON.stringify({delivery:'voice',reply:'本轮想亲口说的短句',sticker:'',skip:false}));
 examples.push('要准确读、复制、操作的信息：'+JSON.stringify({delivery:'text',reply:'本轮需要写下的信息',sticker:'',skip:false}));
 return '本轮可用表达能力（程序确认）：'+JSON.stringify(available)+'。先按沟通意图决定表达媒介，再写内容；不是每轮先写文字、再考虑要不要加表情或朗读。delivery是必填枚举，没有默认值。只发表情时reply可为空，这是完整有效回复；单语音的reply只是配音台词，不另发文字。轻巧应声或接住笑点时，如果一句同义文字并未增加信息，可以直接用贴切表情完成，不必再配‘哈哈、收到、嗯’之类解释。text_sticker只有两部分确实互补时才选。对方需要实际回答时，别用表情回避问题。不需要等对方索要，也不规定配额或轮流切换；确实需要文字就用文字。下面只演示协议与适用意图，不是固定台词，不照抄、不用来推断当前话题：\n'+examples.join('\n');
}
function modelHistory(h){return JSON.stringify({reply:require('./qq-reply.cjs').inline(h.text).text,...(h.delivery&&h.delivery!=='text'?{delivery:h.delivery}:{})});}
function guidance(pref={}){return `表达形式由本轮意思决定。真有先后两步意思时，可用replyParts给1至3段自然短句，reply须等于这些段落以换行连接的全文；不拆半句话、不为了装人凑条数，不人为等待。输出delivery为text、voice、sticker、reaction、text_sticker、voice_sticker或text_voice。通常只选一种：想把短短一句亲口说给对方听时可主动选voice，例如带笑的调侃、真诚感谢或轻声回应，不必等对方先要求语音；reply只写要说的台词；表情本身已经接住意思就选sticker，sticker填目录id，reply可留空，不额外解说，作为续话时contribution填continuation。需要准确阅读、复制、链接、教程或长文时用text。reaction只用于贴一个已有原生表情。两种形式互补时才组合，不把相同内容同时写出又朗读；text_voice仅在对方明确需要或已设置“文字与语音”时使用。当前语音设置=${pref.voiceMode||'auto'}；text禁用语音，both保留文字与语音偏好，其他允许自然选择。对方本条明确要求的形式优先。缺少表情素材时不编造id；语音不可用会回退文字，不声称已发送。日常看表情先理解它在这段交流里的意思，可以参与比喻和玩笑，不必解释图画；真实身份、亲属、出处等识别仍需原有核查。只有已提供图像或可靠标签才能使用其细节。`}
function diagnostic(r={}){const names={text:'文字',voice:'单语音',sticker:'单表情包',reaction:'原生表情回应',text_sticker:'文字与表情',voice_sticker:'语音与表情',text_voice:'文字与语音'},reasons={'voice-disabled':'当前设置只发文字','voice-unavailable':'语音服务未开启','voice-too-long':'台词过长，改为文字','sticker-unavailable':'所选表情素材不可读取','tts-failed':'语音合成失败'};return '模型选择 '+(names[r.selected]||'未明确指定')+(reasons[r.fallback]?' · 回退原因：'+reasons[r.fallback]:'');}
function history(result,m){const r=m.expressionReceipt;if(!r)return result.text||(result.sticker?'[发送表情包]':result.reaction?'[原生表情回应]':'');return r.words||(r.sticker?'[发送表情包：'+r.sticker.label+']':r.reaction?'[原生表情回应]':'');}
async function deliver(q,m,result,signal,current){
 const pref=q.preferences(m),sticker=pref.stickers&&result.sticker?q.stickers.data(q.key(m),result.sticker):null,p=plan(result,pref,m,{voiceAvailable:typeof q.h.synthesize==='function'&&q.h.voiceReady?.()!==false,stickerAvailable:!!sticker});
 if(result.sticker&&!sticker&&pref.stickers)q.log('sticker-error','所选表情包无法读取，本轮只发送可用台词。');
 let textSent=false,imageSent=false,spoken=0,words='';const receipt={mode:p.mode,selected:normalize(result.delivery)||'unspecified',fallback:p.fallback,words:'',sticker:null,reaction:false};m.expressionReceipt=receipt;
 const image=p.sticker&&sticker?{type:'image',data:{file:'base64://'+sticker.bytes.toString('base64'),summary:sticker.label,sub_type:1}}:null;
 if(p.text&&result.text){const supplied=(Array.isArray(result.replyParts)?result.replyParts:[]).slice(0,3),parts=supplied.length>1&&supplied.every(v=>typeof v==='string'&&v.length<=600)&&supplied.join('\n')===result.text?supplied:[result.text];for(let i=0;i<parts.length;i++){if(!current())return '已取消';const img=i===parts.length-1?image:null;try{await q.send(m,[{type:'text',data:{text:parts[i]}},...(img?[img]:[])]);}catch(e){if(!textSent)throw e;q.log('send-error','后续短句发送未确认，未重发，也未继续发送其他内容。');receipt.words=words;receipt.partial=true;receipt.mode='text';return '文字（部分已确认）';}textSent=true;imageSent=!!img;words+=(words?'\n':'')+parts[i];receipt.words=words;}}
 if(image&&!imageSent){if(!current())return '已取消';await q.send(m,[image]);imageSent=true;}
 if(imageSent){q.lastSticker??=new Map();q.lastSticker.set(q.key(m),q.now());q.stickerUses??=new Map();q.stickerUses.set(result.sticker,q.now());receipt.sticker={id:result.sticker,label:sticker.label};}
 if(p.voice&&result.text){const clean=require('./speech-text.cjs').spokenText(result.text,2400);const parts=clean.length<=500?[clean]:clean.match(/.{1,180}(?:[。！？!?]|$)|.{1,180}/gs)||[clean];for(const part of parts.slice(0,14)){if(!current())return '已取消';let bytes;try{if(!part)throw Error('台词没有可朗读内容');q.progress('synthesize',m);bytes=await q.h.synthesize(part,signal);if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>16000000)throw Error('语音数据无效');}catch(e){if(!current())return '已取消';receipt.fallback='tts-failed';q.log('voice-error','语音未完成：'+e.message);if(!textSent&&!spoken){await q.send(m,[{type:'text',data:{text:result.text}}]);textSent=true;words=result.text;}break;}if(!current())return '已取消';// A send failure may already have reached QQ. Never retry it as text.
   await q.send(m,[{type:'record',data:{file:'base64://'+bytes.toString('base64')}}]);spoken++;if(!textSent)words+=part;
 }}
 receipt.words=words;receipt.mode=spoken?(textSent?'text_voice':imageSent?'voice_sticker':'voice'):imageSent?(textSent?'text_sticker':'sticker'):'text';
 if(!textSent&&!imageSent&&!spoken)throw Error('所选表达形式没有可发送内容，请重试。');
 return [textSent?'文字':'',spoken?spoken+'条语音':'',imageSent?'表情包':''].filter(Boolean).join('＋');
}
module.exports={modes,normalize,requested,plan,guidance,protocol,options,modelHistory,diagnostic,history,deliver};
