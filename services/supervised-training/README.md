# Agent Land 监督训练引擎

这是从“练了吗”中抽出的最小线上运行时，只提供 Agent Land 使用的三个会话接口：

- `POST /api/session/start`
- `POST /api/session/frame`
- `POST /api/session/stop`

手机浏览器负责摄像头授权、画面预览和帧压缩；服务端用 RTMPose CPU 模型提取 17 个身体关键点，再由确定性规则判断动作阶段、次数和提示。

## 隐私边界

- 图像帧只在请求内存中解码并推理，不写入磁盘。
- 会话只保留动作、次数、阶段和错误计数，20 分钟无活动自动过期。
- 原始视频和图像不会写入 Agent 记忆。
- 公网只通过主站同源的 `/training-api/` 访问；Python 服务仅监听 `127.0.0.1:4010`。

## 模型

运行时需要：

`models/rtmo-s_8xb32-600e_body7-640x640-dac2bf74_20231211.onnx`

当前使用模型的 SHA-256：

`d0703d40d19f3921da51ae725402d5fdae4d2478c7442072d3101bd396f370d8`

模型文件不提交进 Git；部署时从本地经过校验后上传到服务器。

运行 `install-runtime.sh` 创建 Python 3.11 虚拟环境。脚本会用 `--no-deps` 安装 `rtmlib`，避免同时安装桌面版 OpenCV；图像处理使用 `opencv-python-headless`。
