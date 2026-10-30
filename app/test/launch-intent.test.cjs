'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {launchIntent}=require('../launch-intent.cjs'),{Utilities}=require('../utilities.cjs');
const links=[{id:'b',label:'B站',aliases:['哔哩哔哩','bilibili'],kind:'url',target:'https://www.bilibili.com'},{id:'editor',label:'编辑器',aliases:['写作软件'],kind:'app',target:'D:\\Software\\editor.exe'}];
test('explicit registered-name and alias requests match locally',()=>{for(const text of ['打开B站','帮我打开哔哩哔哩一下','请打开 bilibili 吧','启动写作软件'])assert.equal(launchIntent(text,links).matches.length,1);});
test('conversation, arbitrary paths and injected commands never trigger launch',()=>{for(const text of ['我刚才打开B站发现没声音','你觉得应该打开B站吗','打开 https://example.com','打开 D:\\test.exe','打开编辑器;删除文件','打开编辑器 & calc','打开编辑器\n然后发消息','能介绍一下编辑器吗'])assert.equal(launchIntent(text,links),null,text);});
test('ambiguous alias keeps all alternatives for user choice',()=>{const intent=launchIntent('打开B站',[...links,{...links[0],id:'duplicate'}]);assert.equal(intent.matches.length,2);});
test('app entry requires absolute exe or shortcut and editing aliases never changes the path',()=>{const u=new Utilities();assert.ok(u.addLink('app','无效','relative.exe').error);assert.ok(u.addLink('app','无效','D:\\test.cmd').error);const r=u.addLink('app','写作','D:\\Apps\\write.exe','编辑器，写作软件');assert.ok(r.item);const l=u.links[0],original=l.target;assert.equal(u.editLink(l.id,{label:'写稿',aliases:'文档'}).ok,true);assert.equal(l.target,original);assert.equal(new Utilities(u.snapshot()).links[0].aliases[0],'文档');});
