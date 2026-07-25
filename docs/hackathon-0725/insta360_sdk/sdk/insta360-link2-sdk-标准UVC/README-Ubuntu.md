# Ubuntu 使用教程

Ubuntu 通常是最容易迁移的 Linux 平台，因为摄像头会作为 V4L2 设备出现，例如 `/dev/video0`、`/dev/video2`。

当前仓库的 `ptz_server.py` 是 macOS AVFoundation 版本。Ubuntu 选手需要把视频输入部分改成 V4L2；UVC 云台控制工具可以直接复用。

## 1. 安装依赖

```bash
sudo apt update
sudo apt install -y build-essential libusb-1.0-0-dev ffmpeg v4l-utils python3
```

## 2. 找到 Insta360 的视频设备

```bash
v4l2-ctl --list-devices
```

输出里找到类似 `Insta360 Link 2` 的设备组。它可能会暴露多个 `/dev/video*` 节点，建议逐个测试能否出图。

列出某个节点支持的格式：

```bash
v4l2-ctl -d /dev/video0 --list-formats-ext
```

测试 720p 视频流：

```bash
ffmpeg -f v4l2 \
  -input_format uyvy422 \
  -framerate 30 \
  -video_size 1280x720 \
  -i /dev/video0 \
  -an -f null -
```

如果 `uyvy422` 不行，按 `--list-formats-ext` 里显示的格式换成 `mjpeg`、`yuyv422` 或其他格式。

## 3. 编译 UVC 云台工具

```bash
cc uvc_ptz_get.c -lusb-1.0 -o uvc_ptz_get
cc uvc_ptz_set.c -lusb-1.0 -o uvc_ptz_set
cc uvc_ptz_probe.c -lusb-1.0 -o uvc_ptz_probe
cc probe_insta360_uvc.c -lusb-1.0 -o probe_insta360_uvc
```

读取云台位置：

```bash
./uvc_ptz_get
```

回中：

```bash
./uvc_ptz_set 0 0
```

## 4. USB 权限

如果 `./uvc_ptz_get` 报 `open failed`，先用 sudo 验证是不是权限问题：

```bash
sudo ./uvc_ptz_get
```

如果 sudo 可以，添加 udev 规则：

```bash
sudo tee /etc/udev/rules.d/99-insta360-link.rules >/dev/null <<'EOF'
SUBSYSTEM=="usb", ATTR{idVendor}=="2e1a", ATTR{idProduct}=="4c04", MODE="0666", GROUP="plugdev"
EOF
sudo udevadm control --reload-rules
sudo udevadm trigger
```

然后拔插摄像头。

## 5. Ubuntu 版本 Web demo 怎么改

把 `ptz_server.py` 里 FFmpeg 输入从 macOS 的 AVFoundation 改成 V4L2。核心命令类似：

```bash
ffmpeg -hide_banner -loglevel error \
  -f v4l2 \
  -input_format uyvy422 \
  -framerate 30 \
  -video_size 1280x720 \
  -i /dev/video0 \
  -an -vf fps=15 -q:v 5 \
  -f mjpeg pipe:1
```

也就是把代码里的：

```text
-f avfoundation ... -i <camera>
```

换成：

```text
-f v4l2 -input_format uyvy422 ... -i /dev/videoX
```

更稳一点的做法是启动时用 `v4l2-ctl --list-devices` 找到 `Insta360 Link 2` 对应的 `/dev/videoX`，不要写死 `/dev/video0`。

## 6. 也可以试 v4l2-ctl 控制

有些 UVC 控件会被 Linux UVC driver 暴露成 V4L2 controls：

```bash
v4l2-ctl -d /dev/video0 -l
```

如果能看到 `pan_absolute`、`tilt_absolute`、`pan_relative`、`tilt_relative` 之类控件，可以直接试：

```bash
v4l2-ctl -d /dev/video0 --set-ctrl=pan_absolute=0
v4l2-ctl -d /dev/video0 --set-ctrl=tilt_absolute=0
```

如果 V4L2 没暴露这些控件，就继续用本项目的 libusb 控制路径。

## Ubuntu 现场排查

- 视频能开、云台不动：确认视频流正在打开，相机已退出隐私待机。
- `open failed`：大概率是 USB 权限，先试 `sudo ./uvc_ptz_get`。
- `/dev/video0` 没画面：换同设备组里的其他 `/dev/videoX`。
- 画面格式不支持：用 `v4l2-ctl --list-formats-ext` 查真实格式。
- 不要同时让多个 FFmpeg / 浏览器 / 会议软件抢摄像头。
