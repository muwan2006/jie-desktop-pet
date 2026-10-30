'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spokenText,Voice}=require('../voice.cjs'),{segmentsFor}=require('../dialogue.cjs'),{Chat}=require('../chat.cjs');
function wav(){const b=Buffer.alloc(364);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(320,40);return b;}
test('spoken screenshot-style reply drops domain citations and formatting without losing body or versions',()=>{
 const reply='我先前对他的概括大体没有偏离。\n- **永生是他最稳定、最核心的目标。**这不只是读者概括。（[hetushu.com](https://www.hetushu.com/book/123)）\n- **他并不属于传统英雄。**会欺骗，也会合作。 ([hetushu.com](https://hetushu.com))\n版本 1.7.12，小数 3.14。';
 const value=spokenText(reply);assert.doesNotMatch(value,/hetushu|https|\*|\[|\]|^-/m);assert.match(value,/永生是他最稳定、最核心的目标/);assert.match(value,/会欺骗，也会合作/);assert.match(value,/1\.7\.12/);assert.match(value,/3\.14/);assert.equal(spokenText('请看[完整教程](https://example.com)。'),'请看完整教程。');
});
test('citation tokens, numeric notes, source blocks and URLs never become narrated placeholders',()=>{
 const reply='结论是这样。citeturn0search0turn1view0[1]【来源2】\nhttps://example.com/report。下一句。\n## 来源\n1. [报告](https://example.org)\n2. 网站名称\n## 补充说明\n还有这一点。';
 const value=spokenText(reply);assert.doesNotMatch(value,/cite|turn|来源|网站名称|example|链接请看|https|\[1\]/);assert.match(value,/结论是这样/);assert.match(value,/下一句/);assert.match(value,/还有这一点/);assert.equal(spokenText('(hetushu.com) [hetushu.com](https://hetushu.com) [1]'), '');assert.equal(spokenText('[example.fr](https://example.fr)\nhttps://example.fr。'), '');assert.equal(spokenText('请查看[main.cjs](/workspace/main.cjs)。'),'请查看main.cjs。');
});
test('cleaned sentence cues still align, and original chat text and sources remain unchanged',()=>{
 const reply='**别担心，我陪着你。** ([hetushu.com](https://hetushu.com))\n- 对了，我想到办法了！citeturn0search0';
 const cues=[{quote:'**别担心，我陪着你。**',reaction:{expression:'comfort'}},{quote:'对了，我想到办法了！',reaction:{expression:'idea'}}];
 const parts=segmentsFor(reply,cues);assert.deepEqual(parts.map(p=>p.text),['别担心，我陪着你。','对了，我想到办法了！']);assert.deepEqual(parts.map(p=>p.reaction.expression),['comfort','idea']);
 const c=new Chat();const h=c.append('assistant',reply);h.search={used:true,citations:[{url:'https://hetushu.com/',title:'hetushu.com'}],sources:[]};const restored=new Chat(c.save());assert.equal(restored.data().history[0].text,reply);assert.equal(restored.sourceURL(h.id,0,'citations'),'https://hetushu.com/');
});
test('both ordinary synthesis and synchronized clip requests receive clean speech only',async()=>{
 const reply='**第一句。** ([hetushu.com](https://hetushu.com))\n- 第二句。citeturn0search0',requests=[],plays=[],v=new Voice({presetGreetings:false},{request:async(_port,_route,options)=>{requests.push(options.body.text);return {status:200,buffer:wav()};},onAudio:e=>{if(e.type==='play')plays.push(e);}});
 assert.equal((await v.speak(reply,{manual:true})).ok,true);assert.equal(requests[0],'第一句。\n第二句。');v.stop();requests.length=0;plays.length=0;
 const parts=segmentsFor(reply),beats=[],pending=v.speakSegments(parts,{onSegment:(part,index)=>beats.push([index,part.text])});await new Promise(setImmediate);
 for(let i=0;i<2;i++){v.playback(plays[i].id,'started');v.playback(plays[i].id,'ended');await new Promise(setImmediate);}
 assert.equal((await pending).ok,true);assert.deepEqual(requests,['第一句。','第二句。']);assert.deepEqual(beats,[[0,'第一句。'],[1,'第二句。']]);v.stop();
});
