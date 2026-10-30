# 图片与视频组件来源

本次接入采用现有QQ传输、PyAV解码和本地语音转写，新增图库管理、候选图片检查、后台队列及视频链接获取。

随附 `media-ytdlp.whl`：yt-dlp 2026.10.26，上游 https://github.com/yt-dlp/yt-dlp ，由PyPI发布的原始wheel。许可证、第三方代码声明保留在wheel内的dist-info目录；未对wheel作修改。不是下载执行未知脚本，也不自动启用第三方yt-dlp插件。

实现调研参考（没有将这些完整插件打包成桌宠依赖）：

- https://github.com/Qfxaile/astrbot_plugin_multi_parser ：平台解析、媒体与内容职责分离。
- https://github.com/JefferyHcool/BiliNote ：字幕优先及视频内容整理流程。
- https://github.com/chenluQwQ/astrbot_plugin_bilibili_ai_bot ：观看范围记录、指定时间段分析及角色讨论流程。
- https://github.com/OFA-Sys/Chinese-CLIP ：中文图文检索思路。当前采用轻量描述索引与视觉复核，未打包Chinese-CLIP模型。
- https://github.com/searxng/searxng ：可选外部图片搜索服务，未打包SearXNG服务器。

平台和图片内容的权利归其各自权利人；软件组件许可不等于网络图片或视频的使用许可。解析可用性取决于平台、访问权限和网络状况。
