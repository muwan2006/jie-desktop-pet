'use strict';
function started(kind){return kind==='image'?'我找找。':kind==='discussion'?'我看看刚才读到的内容。':'我看看这个视频。';}
function missingImage(){return '这次没找到能确认是你要的图，我先不乱发。';}
function failed(kind,error=''){
 const subject=kind==='image'?'图片':'视频';
 // Keep actionable setup failures visible. Raw diagnostics stay in task status.
 if(/登录|Cookie|cookie|授权|令牌|密钥|验证码|验证/.test(error))return '这次没能取到'+subject+'，需要先处理登录或验证；可在“图片与视频”查看详情。';
 if(/先.{0,10}(?:连接|配置|开启|安装)|不支持|未配置|未启用|未连接|没有.{0,8}(?:搜索|视觉|识图)/.test(error))return '这次没能处理'+subject+'，还需要检查相关服务设置；可在“图片与视频”查看详情。';
 if(/超时|timeout|timed out/i.test(error))return '这次读取'+subject+'超时了，还没取到结果。';
 return '这次没能取到'+subject+'，还没有可发送的结果。';
}
module.exports={started,missingImage,failed};
