'use strict';
const {createHash}=require('node:crypto');
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function receipt(type,item){if(!['note','todo','reminder','focus'].includes(type)||!item)return null;return {type,id:item.id||'',fingerprint:fingerprint(item),at:Date.now()};}
function undoReceipt(value,hooks){if(!value||!['note','todo','reminder','focus'].includes(value.type))throw Error('这项操作没有可撤销的本地内容。网页搜索和打开软件不自动关闭，保存的文件请使用原文备份。');const item=hooks.lookup(value.type,value.id);if(!item)throw Error('这项内容已经不存在，未重复撤销。');if(fingerprint(item)!==value.fingerprint)throw Error('这项内容后来被修改或已触发，不能直接撤销。请到原页面检查。');if(!hooks.remove(value.type,value.id))throw Error('撤销未完成，请到原页面检查。');return {ok:true,result:'已撤销这一步创建的内容。'};}
module.exports={fingerprint,receipt,undoReceipt};
