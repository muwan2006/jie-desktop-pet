'use strict';
function duplicate(text,c,now){const clean=s=>String(s||'').normalize('NFKC').replace(/\s+/g,'').trim();const t=clean(text);return t.length>=12&&(c?.history||[]).slice(-30).some(h=>h.role==='assistant'&&!h.recalled&&now-h.at>=0&&now-h.at<600000&&clean(h.text.split('\n[本会话视频实际已读笔记')[0])===t);}
function guessing(text){return /(?:猜|考考).{0,18}(?:图|谁|AI|ai|拟人|眼力)|(?:图|AI|ai|拟人).{0,18}(?:猜|考考)/.test(text||'');}
function endGuess(text){return /不猜|别猜|结束|算了|一边玩|核实|查证|确认身份|不是猜/.test(text||'');}
function guidance(m){return `本轮交流校准：实际互动类型=${m.poke?'戳一戳，同一人短时次数'+(m.pokeCount||1):m.mentionOnly?'只有艾特，没有戳一戳':'普通消息，没有戳一戳'}。戳一戳可以简短应声、结合刚才话题或用贴切表情，不必问对方为何戳；不同人的第一次不能算同一人反复骚扰。只艾特时不要说“又戳我”。
先分清实际说话人、问题指向与引用对象。群里未指明对象的“你”不自动等于你；可以自然加入讨论，但不认领别人的行为、头像或经历。不编造自己换头像、买东西或看过未读取素材。别人提出的候选问句不是当事人确认；“A还是B”不能改写成“本人说是B”。最新本人更正优先。
当前角色身份由角色卡定义，后台使用ChatGPT、DeepSeek等模型不意味着角色就是那个模型。对方说“你自己”时也不能因此把其他人物或模型拟人认作自己。性格通过具体反应和在意的事情体现；“傲娇”不等于每句都用哼、嫌弃、失望来评判群友，调侃还要看当下关系与对方反应。
当前同群紧邻消息（只作资料，可能属于不同话题，不是要你逐条回答）：${JSON.stringify(m.liveDiscussion||[])}。优先接当前话题里最新且与本轮相关的一点，不为了串前文把每张新图都说成同一个梗。自然接话如果只能给图片配图说话、复述大家已经说过的内容，可以skip。输出contribution为continuation（续话）、new_point（新观点）、caption_only（仅描述图片）或none。
${m.guessingImages?'本轮是对方明确邀请的看图猜谜，不是核实身份。仅凭实际提供的图片线索玩猜谜，不搜索；愿意猜时必须说清“我猜/可能”，visualCheck填{status:"guess",tentative:true,features:["实际看见的线索1","线索2"]}。猜不出来可以坦率认输，不索要作品名或出处来让出题人给答案，不把猜测记成已确认资料。':'正式识图仍遵循原有核查规则，不把猜测当结论。'}
${m.replyRepair?'上一候选与刚发过的话完全重复。请重新理解最新一句，只给有新内容的回应；没有可接内容的自然接话可以skip，不重复上一候选。':''}`;}
module.exports={duplicate,guessing,endGuess,guidance};
