'use strict';
const Artifacts=require('./codex-artifacts.cjs');
const strip=v=>String(v||'').trim().replace(/^(?:小小颉|小颉|颉)[，,：:\s]*/,'').replace(/[。！!]$/,'').trim();
function command(text){const t=strip(text),artifact=Artifacts.command(t);if(artifact)return artifact;let m;
 if(/^(?:清除|清空)(?:待发送的)?任务附件$/.test(t))return {type:'clear-inputs'};
 if(/^(?:Codex|codex)?(?:项目列表|查看项目|查看项目列表)$/.test(t))return {type:'projects'};
 if(/^(?:Codex|codex)?(?:任务列表|查看任务列表)$/.test(t))return {type:'list'};
 if((m=t.match(/^(?:查看)?任务(?:进度|状态|结果)(?:[：:\s]*([a-f0-9]{8}))?$/i)))return {type:'status',id:m[1]||''};
 if((m=t.match(/^(?:停止|取消)任务(?:[：:\s]*([a-f0-9]{8}))?$/i)))return {type:'stop',id:m[1]||''};
 if((m=t.match(/^(?:发送|查看)?任务结果文件[：:\s]*([a-f0-9]{8})$/i)))return {type:'file',id:m[1]};
 if((m=t.match(/^(批准|拒绝)任务[：:\s]*([a-f0-9]{8})\s+([a-f0-9]{8})$/i)))return {type:'approval',id:m[2],token:m[3],accept:m[1]==='批准'};
 if((m=t.match(/^回答任务[：:\s]*([a-f0-9]{8})\s+([a-f0-9]{8})[：:\s]+([\s\S]+)$/i)))return {type:'answer',id:m[1],token:m[2],text:m[3]};
 if((m=t.match(/^(?:继续|追问)任务[：:\s]*([a-f0-9]{8})[：:\s]+([\s\S]+)$/i)))return {type:'follow',id:m[1],text:m[2]};
 if((m=t.match(/^(?:请|帮我)?在(.{1,40}?)项目(?:里|中)?[，,：:\s]*([\s\S]+)$/)))return {type:'submit',project:m[1].trim(),text:m[2].trim()};
 if((m=t.match(/^(?:交给|让)\s*Codex\s*[：:]\s*(.{1,40}?)\s*[：:]\s*([\s\S]+)$/i)))return {type:'submit',project:m[1].trim(),text:m[2].trim()};
 return null;
}
function authorized(m,owner){return !!owner&&m.type==='private'&&m.sender===owner&&m.target===owner&&!m.proactive&&!m.poke&&!m.upload&&!m.forwards?.length&&!m.videos?.length&&(!(m.files?.length||m.images?.length)||['submit','follow'].includes(command(m.text)?.type));}
module.exports={command,authorized};
