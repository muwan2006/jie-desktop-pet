# 源码结构与构建

本仓库包括共用 Electron 应用及可选包源文件。Windows运行包与大型模型在 Releases；GitHub「Source code」不能直接双击运行。

## 目录

- `app/`：桌宠、文字聊天、记忆与共用后端；基础版入口 `community-bootstrap.cjs`。
- `components/<id>/files/`：功能包的页面、专属素材及标记文件。
- `component-definitions.json`：组件名称、依赖与前端入口。
- `scripts/build-release.py`：用明确指定的干净运行组件构建发布文件。
- `app/test/`：自动检查；`docs/`：用户和开发说明。

## 开发运行

1. 准备 Windows x64、Node.js 22+、npm、Git。构建脚本另需 Python 3.10+。
2. 克隆仓库，进入 `app` 执行 `npm ci`，按锁文件安装依赖。Electron下载可能需要自己的网络设置。
3. 在 `app` 执行 `npm start`。启动使用独立基础版用户目录，请勿把真实账号文件复制进项目。
4. 源码默认是基础能力。测试可选功能时，使用签名功能包管理器在独立测试安装中安装；不要手工把完整版设置混入源码。
5. 执行 `npm test` 运行自动检查。安装事务测试会调用Windows PowerShell，并只使用系统临时目录和模拟资料。

## 构建发行版

需要以下明确输入，均不能包含个人资料：

1. 与锁文件版本一致的 Electron Windows x64 解压目录。使用 `Jie.exe` 名称时保留 Electron许可证、Chromium第三方声明、DLL及locales；不要把整个旧运行目录当干净壳。
2. 经 `npm ci --omit=dev` 获得的运行依赖目录，不能将Electron开发依赖再打进app/node_modules。
3. 本地识别组件目录：Python可嵌入运行时、Whisper模型及其LICENSE、所需Python依赖；可使用本项目Release中对应官方组件解压出的 `files/asr-runtime`。
4. 官方 KWS 模型目录：`encoder.onnx`、`decoder.onnx`、`joiner.onnx`，来源和哈希在 `app/wake-model/SOURCE.json`；模型仅随语音功能包发布，不提交到源码。构建时使用 `--wake-model` 指定。
5. 位于仓库外的 Ed25519 私钥路径。首次构建会生成；以后官方组件更新必须使用同一密钥。私钥不能提交、上传Release或放进运行包。

示例（在仓库根目录运行，路径换成自己的）：

```powershell
python scripts/build-release.py --electron-dir D:\BuildInputs\electron --dependencies D:\BuildInputs\node_modules --local-runtime D:\BuildInputs\asr-runtime --wake-model D:\BuildInputs\wake-model --signing-key D:\PrivateKeys\jie-release.pem --out D:\ReleaseOutput\jie-1.0.2
```

输出目录必须在仓库外；新建空的输出目录运行完整构建。脚本生成组件ZIP、签名catalog、基础程序清单、便携版ZIP、大小报告和SHA256SUMS。修改源码后须重新构建，不能直接修改已签名目录中的哈希。

开发者分支若使用自己的签名密钥，需同步提交相应公钥并自行托管组件；不能让原版接受未经签名的包。当前下载源固定为 `muwan2006/jie-desktop-pet`，fork发布应修改下载源和更新说明。

## 发布检查

1. 新用户目录启动基础版，确认桌宠、聊天和功能中心正常，无个人账号预填。
2. 测试在线/离线安装、依赖、校验失败、取消、卸载、保留历史与事务回退。
3. 检查使用说明里的每个功能入口与实际版本一致；截图仅用模拟账号与示例内容。
4. 扫描待提交清单，排除密钥、用户目录、QQ号、训练数据、运行日志和旧完整备份。`.gitignore`不会自动删除已被跟踪的文件。
5. 基础版上传 `v1.0.2` Release；组件和catalog上传 `components-v1` Release，和应用固定地址一致。
6. 真正从公开Release下载至少一个包，在隔离安装验证签名及安装过程；不能把只测本地文件写成已测公开下载。

## 模块边界

共用后端未完全拆成独立进程，基础版携带少量可选功能的共用处理代码；模块入口与传感器按已安装组件限制。专属UI、动画、环境音、预存声音、Python和模型实际按包分发。未来若拆后端，请保留存储兼容、权限判断、取消和事务回退。
