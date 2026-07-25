"""相机采集：按设备名定位 Insta360 Link 2 Pro，ffmpeg avfoundation 取流。

为什么用 ffmpeg 子进程而不是 cv2.VideoCapture：
- cv2 的 AVFoundation 设备序号和 ffmpeg 枚举序号**不一定一致**，按 ffmpeg
  序号用 cv2 打开可能开错到 MacBook 内置摄像头；
- ffmpeg 自己枚举、自己打开，序号绝对一致，且 uyvy422 取流是验证过的手法。

SDK README 的忠告：不要写死设备序号（插拔/重启后会变），启动时枚举匹配名字。
"""

import re
import subprocess
import tempfile

import numpy as np

from config import CAMERA_FPS, CAMERA_NAME, FRAME_HEIGHT, FRAME_WIDTH


def list_avfoundation_devices() -> list[tuple[int, str]]:
    """解析 `ffmpeg -f avfoundation -list_devices` 的输出，返回 [(index, name)]。"""
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""],
        capture_output=True, text=True,
    )
    devices: list[tuple[int, str]] = []
    in_video = False
    for line in proc.stderr.splitlines():
        if "AVFoundation video devices" in line:
            in_video = True
            continue
        if "AVFoundation audio devices" in line:
            break
        if in_video:
            m = re.search(r"\[(\d+)\]\s+(.+)$", line)
            if m:
                devices.append((int(m.group(1)), m.group(2).strip()))
    return devices


def find_camera_index(name_substr: str = CAMERA_NAME) -> int | None:
    for idx, name in list_avfoundation_devices():
        if name_substr.lower() in name.lower():
            return idx
    return None


def probe_modes(index: int) -> list[tuple[int, int, float]]:
    """探测设备支持的 (宽, 高, fps) 列表：故意用非法参数让 ffmpeg dump 支持模式。"""
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-f", "avfoundation",
         "-framerate", "1", "-video_size", "8x8", "-i", f"{index}:none",
         "-t", "0.1", "-f", "null", "-"],
        capture_output=True, text=True, timeout=15,
    )
    modes = set()
    for m in re.finditer(r"(\d{3,4})x(\d{3,4})@\[(\d+\.?\d*)", proc.stderr):
        modes.add((int(m.group(1)), int(m.group(2)), float(m.group(3))))
    return sorted(modes, key=lambda x: (x[0] * x[1], x[2]), reverse=True)


def pick_mode(index: int) -> tuple[int, int, float]:
    """选最优模式：优先分辨率大、fps 15~30。探测失败回退 1920x1080@30。"""
    modes = probe_modes(index)
    if not modes:
        return (FRAME_WIDTH, FRAME_HEIGHT, float(CAMERA_FPS))
    good = [m for m in modes if 15 <= m[2] <= 30] or modes
    return max(good, key=lambda x: (x[0] * x[1], x[2]))


class Camera:
    """ffmpeg avfoundation 取流封装。open 失败/取流中断抛 RuntimeError。"""

    def __init__(self, index: int | None = None, name: str = CAMERA_NAME):
        if index is None:
            index = find_camera_index(name)
            if index is None:
                available = ", ".join(f"[{i}] {n}" for i, n in list_avfoundation_devices())
                raise RuntimeError(f"找不到相机「{name}」。当前设备：{available or '无'}")
        self.index = index
        self.w, self.h, self.fps = pick_mode(index)
        print(f"[camera] 设备支持模式中选用 {self.w}x{self.h}@{self.fps:g}fps", flush=True)
        self._stderr = tempfile.NamedTemporaryFile(prefix="qr_pair_ffmpeg_", suffix=".log")
        self.proc = self._open(self.w, self.h, self.fps)
        # 读第一帧验证取流成功（权限/占用/参数错误会立刻暴露）
        first = self.proc.stdout.read(self.w * self.h * 3)
        if first is None or len(first) < self.w * self.h * 3:
            # 部分设备（MacBook 内置相机等）只接受 1080p@30fps + uyvy422 组合，回退再试
            print(f"[camera] {self.w}x{self.h}@{self.fps:g} 取流失败，回退 1920x1080@30fps", flush=True)
            self.proc.kill()
            self.w, self.h, self.fps = 1920, 1080, 30.0
            self.proc = self._open(self.w, self.h, self.fps)
            first = self.proc.stdout.read(self.w * self.h * 3)
            if first is None or len(first) < self.w * self.h * 3:
                raise RuntimeError(f"相机「{name}」(index={self.index}) 取流失败：{self._err_tail()}")
        self._frame_size = self.w * self.h * 3

    def _open(self, w: int, h: int, fps: float) -> subprocess.Popen:
        return subprocess.Popen(
            ["ffmpeg", "-hide_banner", "-loglevel", "error",
             "-f", "avfoundation",
             "-framerate", f"{fps:g}",
             "-video_size", f"{w}x{h}",
             "-pixel_format", "uyvy422",
             "-i", f"{self.index}:none",
             "-f", "rawvideo", "-pix_fmt", "bgr24", "pipe:1"],
            stdout=subprocess.PIPE, stderr=self._stderr,
        )

    def _err_tail(self) -> str:
        try:
            self._stderr.seek(0)
            return self._stderr.read().decode(errors="replace")[-400:] or "（无 ffmpeg 错误输出）"
        except Exception:
            return "（读取 ffmpeg 日志失败）"

    def read(self):
        buf = self.proc.stdout.read(self._frame_size)
        if buf is None or len(buf) < self._frame_size:
            raise RuntimeError(f"ffmpeg 取流中断：{self._err_tail()}")
        return np.frombuffer(buf, np.uint8).reshape(self.h, self.w, 3).copy()

    def release(self):
        if self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        self._stderr.close()
