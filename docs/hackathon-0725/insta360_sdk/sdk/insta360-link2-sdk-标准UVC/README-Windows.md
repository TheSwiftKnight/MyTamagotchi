# Windows 使用教程

Windows 可以读取视频流，但云台控制会比 macOS / Ubuntu 麻烦一点。主要坑是：如果你用 Zadig 把整台摄像头切到 WinUSB/libusb 驱动，可能会破坏系统正常的摄像头输入。黑客松里不建议一上来就改驱动。

当前仓库的 `ptz_server.py` 是 macOS AVFoundation 版本。Windows 选手需要把视频输入部分改成 DirectShow 或 Media Foundation；云台控制建议优先考虑 Windows 平台 UVC / Camera Control API，libusb 路径要小心驱动。

## 1. 安装依赖

推荐：

- 安装 Python 3
- 安装 FFmpeg，并把 `ffmpeg.exe` 加到 PATH
- 安装 Visual Studio Build Tools，提供 `cl.exe`
- 安装 libusb 开发包，或用 MSYS2 / vcpkg 管理依赖

MSYS2 路线示例：

```bash
pacman -S --needed mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-libusb mingw-w64-ucrt-x86_64-ffmpeg
```

vcpkg 路线示例：

```powershell
vcpkg install libusb
```

## 2. 找到视频设备

用 DirectShow 列设备：

```powershell
ffmpeg -list_devices true -f dshow -i dummy
```

你应该能看到类似：

```text
"Insta360 Link 2"
```

测试视频流：

```powershell
ffmpeg -f dshow -video_size 1280x720 -framerate 30 -i video="Insta360 Link 2" -an -f null -
```

如果 DirectShow 不稳定，也可以试 Media Foundation：

```powershell
ffmpeg -f mf -list_devices true -i dummy
```

不同 FFmpeg 构建对 `mf` 支持情况不一样，黑客松现场以 `ffmpeg -devices` 输出为准。

## 3. Windows 云台控制建议

优先级建议：

1. 使用 Windows 平台的 UVC / Camera Control API 操作 pan/tilt。
2. 如果只做 demo，可以先让视频由 DirectShow/Media Foundation 打开，再用一个单独的 UVC 控制实现发 `CT_PANTILT_ABSOLUTE_CONTROL`。
3. 谨慎使用 Zadig 给摄像头换 WinUSB 驱动。这样 libusb 会更容易打开设备，但摄像头可能不再作为普通 webcam 出现在 Zoom/Chrome/FFmpeg 里。

本项目的 `uvc_ptz_get.c` / `uvc_ptz_set.c` 使用 libusb 控制传输。在 Windows 上直接编译后是否能打开设备，取决于当前 USB driver。能打开就可以继续用；打不开时不要急着换整台设备驱动，先考虑平台 UVC API。

MSYS2 编译方向大概是：

```bash
gcc uvc_ptz_get.c -lusb-1.0 -o uvc_ptz_get.exe
gcc uvc_ptz_set.c -lusb-1.0 -o uvc_ptz_set.exe
```

如果用 Visual Studio + vcpkg，确保 include/lib 路径指向 vcpkg 安装的 libusb。

## 4. Windows 版本 Web demo 怎么改

把 `ptz_server.py` 的视频命令改成 DirectShow：

```powershell
ffmpeg -hide_banner -loglevel error ^
  -f dshow ^
  -video_size 1280x720 ^
  -framerate 30 ^
  -i video="Insta360 Link 2" ^
  -an -vf fps=15 -q:v 5 ^
  -f mjpeg pipe:1
```

Python 里对应的 `subprocess.Popen([...])` 参数可以写成：

```python
[
    "ffmpeg",
    "-hide_banner",
    "-loglevel", "error",
    "-f", "dshow",
    "-video_size", "1280x720",
    "-framerate", "30",
    "-i", "video=Insta360 Link 2",
    "-an",
    "-vf", "fps=15",
    "-q:v", "5",
    "-f", "mjpeg",
    "pipe:1",
]
```

注意设备名可能有地区化或后缀，先用 `ffmpeg -list_devices true -f dshow -i dummy` 确认准确名称。

## 5. Windows 现场排查

如果视频能开、云台不能控：

- 检查是否被其他应用占用，比如 Teams、Zoom、浏览器。
- 检查 libusb 是否能看到 `vid=2e1a pid=4c04`。
- 不要同时开多个视频消费者。
- 如果设备被换成 WinUSB 后视频没了，把驱动恢复成系统 USB Video Device / UVC 驱动。

如果云台命令返回成功但物理不动：

- 确保视频流正在打开，设备已经退出隐私待机。
- 先发 `pan=0 tilt=0` 回中。
- 不要一开始就打硬件极限。

## Windows 特别提醒

Windows 上“视频输入”和“USB 控制”经常会因为驱动选择互相影响。黑客松现场建议先保证视频能通过普通 webcam 方式打开，再做云台控制。不要为了 libusb 能打开设备而贸然替换整台摄像头驱动，否则视频流可能直接消失。
