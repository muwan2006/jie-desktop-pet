'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Chat}=require('../chat.cjs'),{DEFAULT_CARD}=require('../character.cjs');
// Event-level renderer harness; native dialogs and Windows layout require the target OS.
function fixture(){
 const elements=new Map();
 function element(){return {value:'',textContent:'',children:[],hidden:false,disabled:false,open:false,scrollHeight:0,scrollTop:0,clientHeight:0,listeners:{},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},addEventListener(name,fn){this.listeners[name]=fn;},showModal(){this.open=true;},close(){this.open=false;}};}
 const html=fs.readFileSync(path.join(__dirname,'../panel.html'),'utf8');for(const m of html.matchAll(/id="([^"]+)"/g)){assert.ok(!elements.has('#'+m[1]),'duplicate HTML id');elements.set('#'+m[1],element());}
 const select=s=>{assert.ok(elements.has(s),'missing HTML control '+s);return elements.get(s);};
 let callback,importCard={...DEFAULT_CARD,version:'2.0',text:'导入的人设'},exports=0;
 const c=new Chat({},()=>callback?.(snapshot()));c.addMemory('旧的个人记忆');
 function snapshot(){return {chat:c.snapshot(),auth:{active:'local',connected:false,pending:false,accounts:[],models:[],model:'',welcome:false}};}
 const bridge={onPage(){},onChat(fn){callback=fn;},chatState:async()=>snapshot(),chat:async(op,input)=>{
  if(op==='character-save')return c.setCharacter(input);
  if(op==='character-import')return {ok:true,character:importCard};
  if(op==='character-export'){exports++;return {ok:true};}
  if(op==='character-reset')return c.setCharacter(DEFAULT_CARD);
  throw Error('Unexpected operation '+op);
 }};
 const context=vm.createContext({window:{jie:bridge},document:{querySelector:select,querySelectorAll:()=>[],createElement:element},confirm:()=>true,setTimeout,JSON,Date,console});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../chat-ui.js'),'utf8'),context);
 return {c,select,publish:()=>callback(snapshot()),exports:()=>exports};
}
test('renderer keeps unsaved edits on updates and activates only after save',async()=>{
 const f=fixture();await new Promise(setImmediate);assert.equal(f.select('#character-text').value,DEFAULT_CARD.text);
 f.select('#character-text').value='修改的人设';f.select('#character-text').listeners.input();f.c.addMemory('新记忆');assert.equal(f.select('#character-text').value,'修改的人设');assert.equal(f.c.character.text,DEFAULT_CARD.text);
 await f.select('#character-form').onsubmit({preventDefault(){}});assert.equal(f.c.character.text,'修改的人设');assert.equal(f.c.snapshot().memories.length,2);
 f.c.busy=true;f.publish();assert.equal(f.select('#character-save').disabled,true);assert.equal(f.select('#character-import').disabled,true);
});
test('renderer import is a draft; revert, export and reset preserve personal memories',async()=>{
 const f=fixture();await new Promise(setImmediate);await f.select('#character-import').onclick();assert.equal(f.select('#character-text').value,'导入的人设');assert.equal(f.c.character.text,DEFAULT_CARD.text);
 f.publish();assert.equal(f.select('#character-text').value,'导入的人设');await f.select('#character-export').onclick();assert.equal(f.exports(),1);
 f.select('#character-revert').onclick();assert.equal(f.select('#character-text').value,DEFAULT_CARD.text);
 f.c.setCharacter({...DEFAULT_CARD,text:'另一张卡'});await f.select('#character-reset').onclick();assert.equal(f.select('#character-text').value,DEFAULT_CARD.text);assert.equal(f.c.snapshot().memories[0].text,'旧的个人记忆');
});
