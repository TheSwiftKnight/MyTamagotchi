"""相机采集：按设备名定位 Insta360 Link 2 Pro，ffmpeg avfoundation 取流。

为什么用 ffmpeg 子进程而不是 cv2.VideoCapture：
- cv2 的 AVFoundation 设备序号和 ffmpeg 枚举序号**不一定一致**，按 ffmpeg
  序号用 cv2 打开可能开错到 MacBook 内置摄像头；
- ffmpeg 自己枚举、自己打开，序号绝对一致，且 uyvy422 取流是验证过的手法。

SDK README 的忠告：不要写死设备序号（插拔/重启后会变），启动时枚举匹配名字。
"""

import re
import select
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
        picked = pick_mode(index)
        print(f"[camera] 设备支持模式中选用 {picked[0]}x{picked[1]}@{picked[2]:g}fps", flush=True)
        self._stderr = tempfile.NamedTemporaryFile(prefix="qr_pair_ffmpeg_", suffix=".log")
        # 依次尝试：探测模式 → 1080p30 → 720p30。
        # 注意「假活」陷阱：某些模式（如这台 MacBook 的 1080p）ffmpeg 能开流，
        # 但设备实际不出新帧，靠 dup 补齐——管道里全是同一张图。
        # 所以验证不只看第一帧能不能读到，还要看连续 3 帧是否有变化。
        for w, h, fps in (picked, (1920, 1080, 30.0), (1280, 720, 30.0)):
            self.w, self.h, self.fps = w, h, fps
            self.proc = self._open(w, h, fps)
            try:
                frames = [self._read_one() for _ in range(3)]
            except RuntimeError:
                frames = None
            if frames and len({f.tobytes() for f in frames}) > 1:
                if (w, h, fps) != picked:
                    print(f"[camera] {picked[0]}x{picked[1]}@{picked[2]:g} 取流失败/帧冻结，回退 {w}x{h}@{fps:g}fps", flush=True)
                break
            print(f"[camera] {w}x{h}@{fps:g} 帧冻结（ dup 补帧），换下一档…", flush=True)
            self.proc.kill()
        else:
            raise RuntimeError(f"相机「{name}」(index={self.index}) 取流失败：{self._err_tail()}")
        self._frame_size = self.w * self.h * 3
        self._last_key: bytes | None = None
        self._dup_count = 0

    def _read_one(self) -> "np.ndarray":
        buf = self.proc.stdout.read(self.w * self.h * 3)
        if buf is None or len(buf) < self.w * self.h * 3:
            raise RuntimeError("read short")
        return np.frombuffer(buf, np.uint8).reshape(self.h, self.w, 3).copy()

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
        # 看门狗：系统相机可能被其他应用抢占/休眠，管道静默停供，
        # 裸 read 会永远阻塞 → 大屏冻在最后一帧。超时抛错让上层重开相机。
        r, _, _ = select.select([self.proc.stdout], [], [], 5.0)
        if not r:
            raise RuntimeError(f"相机超过 5 秒无新帧（可能被其他应用抢占）：{self._err_tail()}")
        buf = self.proc.stdout.read(self._frame_size)
        if buf is None or len(buf) < self._frame_size:
            raise RuntimeError(f"ffmpeg 取流中断：{self._err_tail()}")
        frame = np.frombuffer(buf, np.uint8).reshape(self.h, self.w, 3).copy()
        # 假活看门狗：设备冻结时 ffmpeg 用 dup 补帧，管道里有数据但全是同一张图
        # （真实场景有传感器噪声，不可能连续 45 帧逐字节相同）
        key = frame.tobytes()
        self._dup_count = self._dup_count + 1 if key == self._last_key else 0
        self._last_key = key
        if self._dup_count > 45:
            raise RuntimeError("相机帧冻结（ffmpeg dup 补帧），需要重开/降档")
        return frame

    def release(self):
        if self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        self._stderr.close()
