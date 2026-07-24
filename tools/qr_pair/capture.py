"""相机采集：按设备名定位 Insta360 Link 2，avfoundation 取流。

SDK README 的忠告：不要写死设备序号（插拔/重启后会变），启动时枚举匹配名字。
"""

import re
import subprocess

import cv2

from config import CAMERA_NAME, FRAME_HEIGHT, FRAME_WIDTH


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


class Camera:
    """OpenCV avfoundation 采集封装。open 失败抛 RuntimeError。"""

    def __init__(self, index: int | None = None, name: str = CAMERA_NAME):
        if index is None:
            index = find_camera_index(name)
            if index is None:
                available = ", ".join(f"[{i}] {n}" for i, n in list_avfoundation_devices())
                raise RuntimeError(f"找不到相机「{name}」。当前设备：{available or '无'}")
        self.index = index
        self.cap = cv2.VideoCapture(index, cv2.CAP_AVFOUNDATION)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
        if not self.cap.isOpened():
            raise RuntimeError(f"相机 index={index} 打开失败（检查摄像头权限/是否被其他应用占用）")

    def read(self):
        ok, frame = self.cap.read()
        return frame if ok else None

    def release(self):
        self.cap.release()
