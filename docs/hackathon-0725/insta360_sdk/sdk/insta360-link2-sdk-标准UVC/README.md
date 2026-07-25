# Insta360 Link 2 / Link 2 Pro PTZ Demo SDK

一个给黑客松快速上手用的小 demo：读取 Insta360 Link 2 / Link 2 Pro 视频流，并通过标准 UVC 控制云台 pan/tilt。

当前仓库里的 Web demo 已在 macOS 上跑通。Ubuntu / Windows 选手可以复用 UVC 控制思路和 C 工具代码，但视频输入后端、权限和驱动处理会不同，请直接看对应平台文档。

## 选择你的平台

- [macOS 使用教程](README-macOS.md)：已验证，可直接跑当前 Web demo。
- [Ubuntu 使用教程](README-Ubuntu.md)：推荐 Linux 选手参考，视频输入改为 V4L2。
- [Windows 使用教程](README-Windows.md)：可做，但需要小心 UVC / libusb 驱动问题。

## 项目包含

- `ptz_server.py`：浏览器控制台，实时视频 + 上下左右/回中云台控制
- `uvc_ptz_get.c`：读取 pan/tilt
- `uvc_ptz_set.c`：设置 pan/tilt
- `uvc_ptz_probe.c`：读取常见 UVC PTZ 控件的范围/当前值
- `probe_insta360_uvc.c`：Dump USB/UVC 描述符

## 已知设备信息

这台设备在 USB 层暴露为：

```text
Vendor ID:  0x2e1a / 11802
Product ID: 0x4c04 / 19460
Product:    Insta360 Link 2
```

即使设备是 Link 2 Pro，macOS / USB 产品字符串也可能显示为 `Insta360 Link 2`，不一定带 `Pro` 后缀。

云台控制使用标准 UVC Camera Terminal 控件：

```text
Entity: Camera Terminal, unit id 1
Interface: 0
Selector: CT_PANTILT_ABSOLUTE_CONTROL / 0x0d
Payload: 8 bytes
Format: little-endian int32 pan + little-endian int32 tilt
```

读取描述符时看到的硬件范围大约是：

```text
pan:  -522000 .. 522000
tilt: -324000 .. 360000
step: 3600
```

Web demo 里使用了更保守的软件边界，避免撞到机械极限后固件状态不同步：

```text
pan:  -360000 .. 360000
tilt: -270000 .. 270000
```

## 重要注意事项

### 1. 摄像头待机时云台可能不动

Link 2 / Link 2 Pro 在没有应用读取视频流时，会进入隐私/待机状态，镜头扣下。这个状态下直接发 UVC 云台命令可能会显示成功，但物理云台不一定立即执行。

解决方法：打开视频流。当前 macOS Web 控制台已经内嵌视频流，所以页面打开后会自动唤醒摄像头。

### 2. 不要写死视频设备序号

设备顺序会变。macOS 上 `1:none`、Linux 上 `/dev/video0`、Windows 上某个 DirectShow 名称都可能随着插拔、系统重启、其他虚拟摄像头变化。

建议启动时枚举并匹配 `Insta360 Link 2`。

### 3. 不要一开始就打满硬件极限

硬件描述符给出的范围很大，但直接打到边界可能让固件读回值和机械位置不同步。建议控制层使用保守范围，并提供回中按钮。

### 4. AI Tracking 会自己转

如果相机开着 AI Tracking / Auto Framing，即使没有调用本项目的控制代码，摄像头也会自己跟人移动。测试手动控制前，最好先关闭追踪。

### 5. 同时只开一个视频消费者

多个 FFmpeg / Chrome 标签 / Zoom / Teams 同时打开同一摄像头时，可能导致掉线或串流。当前 macOS 服务内部使用单个摄像头工作线程，把同一份 MJPEG 帧分发给页面。

## 免责声明

这是黑客松 demo 级代码，不是官方 SDK。云台控制来自设备暴露的标准 UVC 控件和本地实测。不同固件版本、USB 连接方式、操作系统权限状态下行为可能不同。建议不要频繁撞机械极限，也不要在多个程序里同时抢摄像头。
