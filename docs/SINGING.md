# 歌声引擎准备与接入

「唱歌与翻唱」包提供点歌、转换任务、播放、歌库和QQ回传代码。它与说话用的GPT-SoVITS不同；设置好TTS不能代替歌声引擎。当前没有随包分发的一键歌声环境安装器。

## 准备内容

按上游 [SoulX-Singer](https://github.com/Soul-AILab/SoulX-Singer) 的SVC推理说明准备Python、PyTorch及适合显卡的运行环境，同时安装Demucs、音频依赖和RMVPE预处理依赖。上游项目、模型与依赖分别受其许可证约束。需要自行提供有权使用的干净说话参考音频。

桌宠适配器读取下面这个目录结构；路径可以放在任意有写入权限的本机目录，不能只放一个模型文件：

```text
JieSinging/
  READY.json
  soulx-runtime/Scripts/python.exe
  soulx/soulxsinger/models/soulxsinger_svc.py
  models/soulx-svc/model-svc.pt
  models/whisper-base/config.json
  models/whisper-base/model.safetensors
  models/whisper-base/preprocessor_config.json
  models/rmvpe/model.pt
  reference/accepted-speaking.wav
```

`soulx` 是SoulX-Singer源码目录。模型应与该SVC实现兼容；Whisper-base从其官方模型仓库取得。RMVPE推理与预处理实现参考 [HQ-SVC](https://github.com/ShawnPi233/HQ-SVC)。安装了目录结构但Python缺依赖，仍会在实际制作时失败；请先按上游完成本机推理验证。

环境真正准备完成后创建 `READY.json`：

```json
{"engine":"soulx-svc-v1"}
```

这个文件只是组件类型标记，不会安装任何依赖。适配器运行时使用目录内的Python及离线模型，详见仓库 `app/singing-convert.py` 和 `app/singing-worker.py` 的导入与参数。不同歌曲的音色、咬字和音准效果可能不同。

## 桌宠里操作

1. 功能中心安装「唱歌与翻唱」。
2. 打开「小工具 → 唱歌与翻唱歌库」，展开组件设置，选择准备好的根目录 `JieSinging`。
3. 在线搜歌并选择版本，观察取得音源、人声分离、转换、混音进度。失败时查看个人数据目录 `singing/<歌曲编号>/process.log`。
4. 制作完成点击播放；导出WAV保存成果。退出桌宠会停止未完成制作，已完成歌库保留。
5. QQ点歌需额外安装并配置QQ聊天，语音格式转换需本地识别与音视频组件。机器人仅向原会话回传，不自动发到其他群。

使用自己的音源和参考素材时请遵守对应权限。软件不会附带作者的训练环境、私人参考录音或已有歌曲成品。
