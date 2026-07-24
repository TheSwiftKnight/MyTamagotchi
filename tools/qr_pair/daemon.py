"""qr_pair 主守护进程：Link2 采集 → 多码解码 → 配对状态机 → 上报后端。

用法：
  python daemon.py                          # 实拍模式（自动找 Insta360 Link 2）
  python daemon.py --index 0                # 指定 avfoundation 设备序号
  python daemon.py --source frame.png       # 图片回放（联调用，循环喂同一帧）
  python daemon.py --source clip.mp4        # 视频回放
  python daemon.py --show                   # 弹出预览窗口（画出解码结果）
  python daemon.py --once                   # 触发一次配对后退出（自测用）
"""

import argparse
import sys
import time

import cv2
import httpx

from capture import Camera
from config import BACKEND_URL, DECODE_FPS, PAIR_ENDPOINT, QR_PREFIX
from decoder import QRDecoder
from fsm import PairFSM


def post_pair(backend: str, payload_a: str, payload_b: str) -> dict | None:
    try:
        resp = httpx.post(backend + PAIR_ENDPOINT, json={
            "payload_a": payload_a,
            "payload_b": payload_b,
            "source": "qr_camera",
        }, timeout=90)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[pair] 上报后端失败: {e}", file=sys.stderr)
        return None


def print_pair_result(result: dict):
    if result.get("cached"):
        print("[pair] （冷却期内，返回缓存结果）")
    names = " × ".join(a["name"] for a in result.get("agents", []))
    print(f"\n===== 配对成功：{names} =====")
    res = result.get("resonance") or {}
    if res:
        print(f"  灵魂契合度 {res.get('score', '?')}/100 —— {res.get('reason', '')}")
    for line in result.get("lines", []):
        print(f"  {line.get('emoji', '')} {line.get('name')}: {line.get('text')}")
    learned = result.get("learned")
    if learned:
        print(f"  ✨ {learned['learner']} 向 {learned['teacher']} 学会了「{learned['skill']}」")
    print("=" * 40 + "\n")


class FrameSource:
    """统一实拍/回放两种帧来源。"""

    def __init__(self, source: str | None, index: int | None):
        self.is_image = False
        if source is None:
            self.cam = Camera(index=index)
            print(f"[camera] 已打开 avfoundation index={self.cam.index}")
        elif source.lower().endswith((".png", ".jpg", ".jpeg")):
            self.frame = cv2.imread(source)
            if self.frame is None:
                raise RuntimeError(f"读不到图片 {source}")
            self.is_image = True
            print(f"[source] 图片回放：{source}")
        else:
            self.cam = Camera.__new__(Camera)
            self.cam.cap = cv2.VideoCapture(source)
            self.cam.index = -1
            if not self.cam.cap.isOpened():
                raise RuntimeError(f"打不开视频 {source}")
            print(f"[source] 视频回放：{source}")

    def read(self):
        if self.is_image:
            return self.frame.copy()
        return self.cam.read()

    def release(self):
        if not self.is_image:
            self.cam.release()


def main():
    ap = argparse.ArgumentParser(description="ForkWorld 二维码配对识别服务")
    ap.add_argument("--backend", default=BACKEND_URL)
    ap.add_argument("--index", type=int, default=None, help="avfoundation 设备序号（默认按名字找 Link2）")
    ap.add_argument("--source", default=None, help="图片/视频回放（不开相机）")
    ap.add_argument("--show", action="store_true", help="弹预览窗口")
    ap.add_argument("--once", action="store_true", help="配对成功一次后退出")
    ap.add_argument("--dry-run", action="store_true", help="不上报后端，只打印事件")
    args = ap.parse_args()

    src = FrameSource(args.source, args.index)
    decoder = QRDecoder()
    print(f"[decoder] backend = {decoder.backend}")
    fsm = PairFSM()

    interval = 1.0 / DECODE_FPS
    image_feeds_left = 30 if src.is_image else None   # 图片回放喂 30 帧（约 2 秒）后自动退出
    try:
        while True:
            t0 = time.time()
            if image_feeds_left is not None:
                if image_feeds_left <= 0:
                    break
                image_feeds_left -= 1
            frame = src.read()
            if frame is None:
                if args.source:
                    break
                time.sleep(0.1)
                continue

            payloads = decoder.decode(frame)
            events = fsm.feed(payloads)

            for ev in events:
                if ev.kind == "waiting":
                    who = ev.payloads[0].removeprefix(QR_PREFIX)
                    print(f"[fsm] 检测到 agent {who}，等待另一位举起宠物…")
                elif ev.kind == "pair":
                    a, b = ev.payloads
                    print(f"[fsm] 触发配对：{a} + {b}", flush=True)
                    if args.dry_run:
                        if args.once:
                            return
                        continue
                    result = post_pair(args.backend, a, b)
                    if result:
                        print_pair_result(result)
                    if args.once:
                        return

            if args.show:
                vis = frame.copy()
                cv2.putText(vis, " ".join(payloads) or "no qr", (20, 40),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2)
                cv2.imshow("qr_pair", vis)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

            elapsed = time.time() - t0
            if elapsed < interval:
                time.sleep(interval - elapsed)
    finally:
        src.release()
        if args.show:
            cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
