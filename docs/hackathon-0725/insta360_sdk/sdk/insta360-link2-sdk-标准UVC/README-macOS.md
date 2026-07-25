# macOS 使用教程

这是当前仓库已经验证通过的平台。Web 控制台、视频流和 UVC 云台控制都可以直接跑。

## 依赖

需要：

- Insta360 Link 2 / Link 2 Pro 通过 USB 连接到 Mac
- Homebrew
- FFmpeg
- libusb
- Xcode Command Line Tools 或可用的 `cc`
- Python 3

安装依赖：

```bash
brew install ffmpeg libusb
```

macOS 第一次访问摄像头时，可能会弹出相机权限请求。请允许终端或运行服务的 App 访问摄像头。

## 编译

在项目目录里运行：

```bash
cc uvc_ptz_get.c -I/opt/homebrew/include -L/opt/homebrew/lib -lusb-1.0 -o uvc_ptz_get
cc uvc_ptz_set.c -I/opt/homebrew/include -L/opt/homebrew/lib -lusb-1.0 -o uvc_ptz_set
cc uvc_ptz_probe.c -I/opt/homebrew/include -L/opt/homebrew/lib -lusb-1.0 -o uvc_ptz_probe
cc probe_insta360_uvc.c -I/opt/homebrew/include -L/opt/homebrew/lib -lusb-1.0 -o probe_insta360_uvc
```

## 启动 Web 控制台

```bash
python3 ptz_server.py
```

然后打开：

```text
http://127.0.0.1:8787
```

页面左侧是实时视频流，右侧是云台控制。视频流会自动让 Link 2 / Link 2 Pro 退出隐私待机状态，所以一般不需要再额外开一个 FFmpeg 进程保持唤醒。

如果页面还是旧版本，浏览器里用 `Cmd+Shift+R` 强制刷新。

## 命令行用法

读取当前云台位置：

```bash
./uvc_ptz_get
```

返回示例：

```json
{"pan":0,"tilt":0}
```

设置云台位置：

```bash
./uvc_ptz_set <pan> <tilt>
```

例如回中：

```bash
./uvc_ptz_set 0 0
```

向右看一点：

```bash
./uvc_ptz_set 72000 0
```

向左看一点：

```bash
./uvc_ptz_set -72000 0
```

## HTTP API

读取位置：

```bash
curl http://127.0.0.1:8787/api/position
```

移动：

```bash
curl -X POST http://127.0.0.1:8787/api/move \
  -H 'content-type: application/json' \
  -d '{"dir":"right","step":36000}'
```

方向支持：

```text
left
right
up
down
center
```

视频流：

```text
http://127.0.0.1:8787/video.mjpg
```

这是一个 MJPEG 流，可以直接放到 `<img src="/video.mjpg">` 里。

## 视频模式

通过 AVFoundation 当前测试可用的模式包括：

```text
640x480      @ 15/30 fps
1280x720     @ 15/30 fps
1760x1328    @ 15/30 fps
1328x1760    @ 15/30 fps
1552x1552    @ 15/30 fps
1920x1080    @ 15/30 fps
1080x1920    @ 15/30 fps
```

当前 demo 用 `1280x720` 输入，然后输出为 15fps 的 MJPEG，主要是为了稳定和低延迟。1080p 也可以读，但浏览器 MJPEG 会更吃 CPU 和带宽。

如果 USB 链路是 USB 2.0 / 480 Mbps，4K 可能不会通过 AVFoundation 暴露出来。

## 快速排查

列出 AVFoundation 设备：

```bash
ffmpeg -f avfoundation -list_devices true -i ""
```

确认 USB 层识别到了 Insta360：

```bash
ioreg -p IOUSB -l -w 0 | rg -C 20 "Insta360 Link 2"
```

测试视频流：

```bash
ffmpeg -f avfoundation \
  -pixel_format uyvy422 \
  -framerate 30 \
  -video_size 1280x720 \
  -i "Insta360 Link 2:none" \
  -an -f null -
```

如果设备名方式失败，用 AVFoundation 列出来的当前序号，例如 `0:none`。

测试云台回中：

```bash
./uvc_ptz_set 0 0
```

## macOS 注意事项

- 不要写死 `1:none`。AVFoundation 设备顺序会变，可能串到 MacBook 自带摄像头。
- 如果云台命令显示成功但物理不动，先打开视频流让相机退出隐私待机。
- 如果视频掉线，检查是否有其他应用占用摄像头。
