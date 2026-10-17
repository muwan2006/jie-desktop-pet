# 聊天与语音服务接入

桌宠可继续用 ChatGPT 登录，也能添加 API 连接。配置入口在“聊聊 → 聊天连接与模型 → 添加或修改 API 连接”。选择模板后，填写自己的基础地址、密钥和完整模型名称，点击“保存并使用”。模型目录可以刷新；服务不提供目录时仍可手填模型。

## 聊天接口

| 模板 | 接口协议 | 基础地址 |
| --- | --- | --- |
| OpenAI API | Responses | `https://api.openai.com/v1` |
| DeepSeek | Chat Completions | `https://api.deepseek.com` |
| 通义千问／百炼北京 | Chat Completions | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 硅基流动 | Chat Completions | `https://api.siliconflow.cn/v1` |
| Claude | Messages | `https://api.anthropic.com/v1` |
| Gemini | generateContent | `https://generativelanguage.googleapis.com/v1beta` |
| Ollama 本机 | Chat Completions | `http://127.0.0.1:11434/v1` |
| 其他兼容服务 | Chat Completions 或 Responses | 服务提供的 API 基础地址 |

模型名称由用户填写或从服务目录选择；不预设你拥有某个模型。百炼等服务的地址随地区与账号方案变化，应使用自己账号提供的地址。其他采用上述协议的服务也可以自定义地址；不支持 AWS Bedrock 的签名鉴权、Vertex AI 的服务账号鉴权或任意供应商私有协议。

“图片”“PDF”“原生搜索”须按具体模型和服务支持的能力启用。文字附件始终作为文本资料传入。图片用于上传图片、屏幕问答和陪玩；PDF 需要文件能力。Completions 接口本版不接入供应商私有搜索扩展；Responses、Claude 和 Gemini 可启用其原生搜索。强制搜索会检查实际返回的搜索结果，未搜索不会冒称核实过。不能看图的模型无法理解屏幕；关闭能力时会报明原因，不悄悄丢弃附件。

聊天、表情分析、主动接话、小记与屏幕理解共用当前连接。每个连接分别保存聊天、记忆和小记；切回原连接可继续原来的对话。编辑同一连接会保留其聊天。移除连接删除对应配置与密钥，已有聊天不会删除，但连接移除后应先通过原连接导出需要的对话。

## 语音接口

“声音”中选择声音来源，再保存。旧安装沿用已有本机 GPT-SoVITS 设置，新用户默认 Windows 系统语音。

| 来源 | 配置 |
| --- | --- |
| Windows 系统语音 | 无密钥，无独立 TTS 服务；可刷新并选择 Windows 已安装的音色。没有中文音色时安装对应 Windows 语音包。 |
| GPT-SoVITS 本机 | 原有参考录音与本机端口，默认 9880。 |
| OpenAI 兼容 Audio Speech | 基础地址、语音模型、音色名称、自己的密钥；固定 `/audio/speech`，请求 WAV。适用于 OpenAI、硅基流动及实现相同协议的服务。 |
| Azure Speech | `https://<region>.tts.speech.microsoft.com`，语音资源密钥与音色名称（例如 `zh-CN-XiaoxiaoNeural`）；模型栏填写 `azure-tts`。使用 SSML 与 WAV 输出。 |
| ElevenLabs | `https://api.elevenlabs.io/v1`、模型名称和 Voice ID、密钥；请求 PCM 24 kHz，在本机包装为 WAV。具体模型与音频格式须有账号权限。 |

聊天和语音可以使用不同服务、不同密钥。系统与在线音色不等同于原颉参考录音；已有预录日常语音仍直接播放原录音。语音选项影响新合成的聊天台词。检查在线连接仅查询模型或音色目录，不进行付费合成；“生成并试听”和聊天朗读会把朗读文字交给选定服务合成。系统语音在本机生成。静音、停止、逐句朗读、表情同步和丢弃迟来结果沿用统一播放流程。

## 配置与发布

API 密钥使用 Electron `safeStorage` 在本机加密，保存于 Electron userData 下的 `jie-api-services.enc`。ChatGPT 登录仍使用原来的独立加密登录文件。密钥不返回给界面、不进入一般设置文件、不写入地址，不会随聊天导出；修改服务域名时不会沿用旧密钥。安全存储不可用时拒绝保存密钥。在线地址使用 HTTPS；本机回环地址可以使用 HTTP。网络请求拒绝重定向。

示例文件只描述配置结构，不含真实密钥，也不自动导入任何账号。将项目发布到 GitHub 时提交源代码与无密钥示例，不提交 userData、个人聊天、录音、日志、备份目录、`.env` 或任何 `.enc` 文件。`.gitignore` 提供常用排除项；它不影响已被 Git 跟踪的文件。发布前检查待提交清单。

## 开发接口

`api-connections.cjs` 管理连接选择、模型目录、密钥保存和恢复；`api-protocols.cjs` 将统一的桌宠输入转换为服务请求，再将结果归一为现有的回复事件。增加聊天协议需要实现请求、鉴权、媒体和完整结束状态转换，并补充取消、错误与能力检查。

`voice-services.cjs` 管理在线语音与系统语音；`Voice.synthesize()` 把生成结果统一为经过校验的 WAV。新增语音服务须提供有大小限制、超时和取消处理的生成方法，返回音频与播放速度，不能把密钥发给渲染进程。

## 核对资料

- [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
- [OpenAI TTS](https://developers.openai.com/api/docs/guides/text-to-speech)
- [DeepSeek API](https://api-docs.deepseek.com/)
- [百炼地址与地区](https://www.alibabacloud.com/help/en/model-studio/base-url)
- [硅基流动 TTS](https://docs.siliconflow.cn/docs/userguide/capabilities/text-to-speech)
- [Claude API](https://platform.claude.com/docs/en/api/overview)
- [Gemini API](https://ai.google.dev/api/generate-content)
- [Ollama 兼容接口](https://docs.ollama.com/api/openai-compatibility)
- [Azure TTS](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech)
- [ElevenLabs TTS](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)
- [Windows 系统语音](https://learn.microsoft.com/en-us/dotnet/api/system.speech.synthesis.speechsynthesizer?view=netframework-4.8.1)
