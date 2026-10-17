'use strict';
function clean(value,limit=400){return typeof value==='string'?value.replace(/Bearer\s+[^\s"']+/gi,'Bearer [已隐藏]').replace(/\bsk-[\w-]+/g,'[已隐藏]').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,limit):'';}
function failure(value={},status=0,requestId=''){
 const data=value.response||value,error=data.error||value.error||value;
 const code=clean(error.code,100),param=clean(error.param,120),reason=clean(data.incomplete_details?.reason,100),message=clean(error.message||data.detail||value.detail);
 let summary=reason==='max_output_tokens'?'回答达到输出长度限制，没有完整完成。请要求更简短的回答后重试。':reason==='content_filter'?'这次回答没有完整完成，服务返回了内容限制。':({
  subscription_sharing_usage_limit_exceeded:'桌宠使用 ChatGPT 套餐的额度已达到限制，请查看 ChatGPT 设置中的用量。',
  subscription_sharing_usage_unavailable:'服务暂时无法核对用量，请稍后重试；登录已保留。',
  subscription_sharing_user_unavailable:'服务暂时无法读取账号或工作区，请稍后重试；登录已保留。',
  subscription_sharing_user_not_eligible:'当前账号或工作区暂不允许桌宠使用 ChatGPT 套餐。',
  subscription_sharing_unsupported_capability:'当前模型或账号不支持本次请求中的某项功能。请根据下方原因调整模型或联网搜索设置。',
  subscription_sharing_route_not_supported:'服务不接受当前请求的接口路径。',
  chatpass_v2_scope_not_authorized:'当前授权不包含本次请求需要的权限。',
  chatpass_v2_invalid_authorization_context:'当前授权上下文未被服务接受。',
  subscription_sharing_invalid_user:'服务无法验证当前账号，请检查连接状态。',
  context_length_exceeded:'本次对话内容超过模型可接受的长度。',
  rate_limit_exceeded:'请求过于频繁，请稍后重试。',
  insufficient_quota:'服务返回了额度不足，请检查当前账号的用量。',
  server_error:'模型服务暂时出错，请稍后重试。',
  model_not_found:'当前选择的模型不可用，请刷新模型列表后重新选择。'
 })[code]|| (status===401?'服务未接受当前登录或授权。':status===403?'服务拒绝了本次请求，请查看具体权限或访问限制。':status===429?'已达到使用限制，请查看当前账号用量。':status===503?'服务暂时不可用，请稍后重试；登录已保留。':'模型没有完成回答，请查看具体原因后重试。');
 const id=clean(requestId,100),parts=[summary];if(status)parts.push('HTTP '+status);if(code||reason)parts.push('错误代码：'+(code||reason));if(param)parts.push('相关参数：'+param);if(message)parts.push('服务说明：'+message);if(id)parts.push('请求编号：'+id);
 const result=Error(parts.join('\n'));result.name='InferenceError';result.code=code||reason;result.param=param;result.status=status;result.requestId=id;return result;
}
async function httpFailure(response){
 let value={};const reader=response.body?.getReader();if(reader){const parts=[];let bytes=0;try{for(;;){const {done,value:chunk}=await reader.read();if(done)break;bytes+=chunk.length;if(bytes>32768)break;parts.push(chunk);}const text=Buffer.concat(parts).toString('utf8');try{value=JSON.parse(text);}catch{/* HTML/proxy pages are not exposed as model diagnostics. */}}catch{}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}}
 return failure(value,response.status,response.headers?.get('x-request-id')||'');
}
module.exports={failure,httpFailure};
