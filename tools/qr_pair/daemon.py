"""qr_pair 主守护进程：Link2 采集 → 多码解码 → 配对状态机 → 上报后端 + 大屏直播。

实拍模式是双线程管线（关键：视频流不被解码拖慢）：
  - 采集线程：ffmpeg 管道满帧率读帧，只保留最新一帧
  - 推流循环：每来一帧就画框/镜像/编码/推 MJPEG —— 满 25fps
  - 解码线程：拿最新帧跑 WeChatQRCode（慢，~10fps），产出识别框与配对事件

用法：
  python daemon.py                          # 实拍模式（自动找 Insta360 Link 2）
  python daemon.py --index 0                # 指定 avfoundation 设备序号
  python daemon.py --source frame.png       # 图片回放（联调用，喂 30 帧后退出）
  python daemon.py --source clip.mp4        # 视频回放
  python daemon.py --show                   # 弹出预览窗口
  python daemon.py --once                   # 触发一次配对后退出（自测用）
  python daemon.py --serve-port 0           # 关闭大屏服务
"""

import argparse
import sys
import threading
import time

import cv2
import httpx

import stream_server
from capture import Camera
from config import (BACKEND_URL, CAMERA_NAME, DECODE_FPS, MIRROR_DISPLAY,
                    PAIR_ENDPOINT, QR_PREFIX)
from decoder import QRDecoder
from fsm import PairFSM

INK = (17, 25, 28)          # BGR：墨色
ACCENT = (57, 93, 217)      # BGR：#D95D39 朱红

RESULT_TTL = 0.6            # 识别框结果的有效期（秒），过期不再叠加


def annotate(frame, results, mirror: bool = MIRROR_DISPLAY):
    """生成大屏显示帧：可选镜像（像镜子）+ 识别框 + 载荷标签。

    识别永远在原始帧上做（镜像的二维码解不出来），只有显示做翻转，
    识别框坐标同步做 x 翻转，标签文字保持正向可读。
    """
    vis = cv2.flip(frame, 1) if mirror else frame.copy()
    w = frame.shape[1]
    for text, pts in results:
        label = text.removeprefix(QR_PREFIX)
        if pts is None:
            continue
        p = pts.astype(int).reshape(-1, 2).copy()
        if mirror:
            p[:, 0] = w - 1 - p[:, 0]
        cv2.polylines(vis, [p], True, ACCENT, 4)
        x, y = int(p[:, 0].min()), int(p[:, 1].min())
        tag = f"AGENT {label}"
        (tw, th), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
        cv2.rectangle(vis, (x, y - th - 18), (x + tw + 16, y - 2), ACCENT, -1)
        cv2.putText(vis, tag, (x + 8, y - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
    return vis


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
        print(f"  {line.get('name')}: {line.get('text')}")
    learned = result.get("learned")
    if learned:
        print(f"  ✨ {learned['learner']} 向 {learned['teacher']} 学会了「{learned['skill']}」")
    print("=" * 40 + "\n", flush=True)


def pair_worker(backend: str, payload_a: str, payload_b: str):
    """后台线程完成配对上报 + 大屏广播，不阻塞视频/解码。"""
    result = post_pair(backend, payload_a, payload_b)
    if result:
        print_pair_result(result)
        stream_server.broadcast({"type": "pair", "result": result})
    else:
        stream_server.broadcast({"type": "pair_failed"})


def handle_events(events, args) -> tuple[bool, threading.Thread | None]:
    """处理状态机事件：打印 + 大屏广播 + 触发配对。返回 (是否触发配对, 配对线程)。"""
    paired = False
    pair_thread = None
    for ev in events:
        if ev.kind == "waiting":
            who = ev.payloads[0].removeprefix(QR_PREFIX)
            print(f"[fsm] 检测到 agent {who}，等待另一位举起宠物…", flush=True)
            stream_server.broadcast({"type": "waiting",
                                     "agent_id": int(who) if who.isdigit() else who})
        elif ev.kind == "pair":
            a, b = ev.payloads
            paired = True
            print(f"[fsm] 触发配对：{a} + {b}", flush=True)
            if args.dry_run:
                continue
            ia, ib = a.removeprefix(QR_PREFIX), b.removeprefix(QR_PREFIX)
            stream_server.broadcast({"type": "pairing",
                                     "a": int(ia) if ia.isdigit() else ia,
                                     "b": int(ib) if ib.isdigit() else ib})
            pair_thread = threading.Thread(
                target=pair_worker, args=(args.backend, a, b), daemon=True)
            pair_thread.start()
    return paired, pair_thread


class Grabber:
    """采集线程：满帧率读帧，只保留最新一帧（旧帧直接丢，保证低延迟）。"""

    def __init__(self, cam: Camera):
        self.cam = cam
        self.frame = None
        self.seq = 0
        self.cond = threading.Condition()
        self.error: Exception | None = None
        self._stop = False
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        while not self._stop:
            try:
                f = self.cam.read()
            except Exception as e:
                with self.cond:
                    self.error = e
                    self.cond.notify_all()
                return
            with self.cond:
                self.frame = f
                self.seq += 1
                self.cond.notify_all()

    def get(self, last_seq: int, timeout: float = 2.0):
        """等到比 last_seq 新的帧，返回 (frame, seq)；超时返回 (None, last_seq)。"""
        with self.cond:
            self.cond.wait_for(lambda: self.seq > last_seq or self.error, timeout=timeout)
            if self.error:
                raise self.error
            if self.seq <= last_seq:
                return None, last_seq
            return self.frame, self.seq

    def stop(self):
        self._stop = True


def run_live(args, decoder: QRDecoder, fsm: PairFSM):
    """实拍模式：采集线程 + 解码线程 + 推流主循环。"""
    cam = Camera(index=args.index)
    print(f"[camera] 已打开「{CAMERA_NAME}」ffmpeg avfoundation index={cam.index}", flush=True)
    grab = Grabber(cam)

    latest = {"results": [], "ts": 0.0}
    res_lock = threading.Lock()

    def decode_loop():
        last_seq = 0
        min_interval = 1.0 / DECODE_FPS
        while True:
            frame, last_seq = grab.get(last_seq)
            if frame is None:
                continue
            t0 = time.time()
            results = decoder.decode_points(frame)
            with res_lock:
                latest["results"] = results
                latest["ts"] = time.time()
            handle_events(fsm.feed([t for t, _ in results]), args)
            dt = time.time() - t0
            if dt < min_interval:
                time.sleep(min_interval - dt)

    threading.Thread(target=decode_loop, daemon=True).start()

    last_seq = 0
    try:
        while True:
            frame, last_seq = grab.get(last_seq)
            if frame is None:
                continue
            with res_lock:
                results = latest["results"] if time.time() - latest["ts"] < RESULT_TTL else []
            vis = annotate(frame, results)
            if args.serve_port:
                ok, jpg = cv2.imencode(".jpg", vis, [cv2.IMWRITE_JPEG_QUALITY, 80])
                if ok:
                    stream_server.set_frame(jpg.tobytes())
            if args.show:
                cv2.imshow("qr_pair", vis)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
    finally:
        grab.stop()
        cam.release()
        if args.show:
            cv2.destroyAllWindows()


def run_playback(args, decoder: QRDecoder, fsm: PairFSM):
    """回放模式（图片/视频）：联调用，单线程足够。"""
    if args.source.lower().endswith((".png", ".jpg", ".jpeg")):
        base = cv2.imread(args.source)
        if base is None:
            raise RuntimeError(f"读不到图片 {args.source}")
        print(f"[source] 图片回放：{args.source}")
        frames = (base.copy() for _ in range(30))          # 约 2 秒
    else:
        vid = cv2.VideoCapture(args.source)
        if not vid.isOpened():
            raise RuntimeError(f"打不开视频 {args.source}")
        print(f"[source] 视频回放：{args.source}")

        def _vid_frames():
            while True:
                ok, f = vid.read()
                if not ok:
                    return
                yield f
        frames = _vid_frames()

    interval = 1.0 / DECODE_FPS
    for frame in frames:
        t0 = time.time()
        results = decoder.decode_points(frame)
        if args.serve_port:
            ok, jpg = cv2.imencode(".jpg", annotate(frame, results),
                                   [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ok:
                stream_server.set_frame(jpg.tobytes())
        paired, pair_thread = handle_events(fsm.feed([t for t, _ in results]), args)
        if paired and args.once:
            if pair_thread:
                pair_thread.join()
            return
        dt = time.time() - t0
        if dt < interval:
            time.sleep(interval - dt)


def main():
    ap = argparse.ArgumentParser(description="ForkWorld 二维码配对识别服务")
    ap.add_argument("--backend", default=BACKEND_URL)
    ap.add_argument("--index", type=int, default=None, help="avfoundation 设备序号（默认按名字找 Link2）")
    ap.add_argument("--source", default=None, help="图片/视频回放（不开相机）")
    ap.add_argument("--show", action="store_true", help="弹预览窗口")
    ap.add_argument("--once", action="store_true", help="配对成功一次后退出（回放模式）")
    ap.add_argument("--dry-run", action="store_true", help="不上报后端，只打印事件")
    ap.add_argument("--serve-port", type=int, default=8700,
                    help="大屏服务端口（MJPEG+SSE+页面），0 关闭")
    args = ap.parse_args()

    decoder = QRDecoder()
    print(f"[decoder] backend = {decoder.backend}")
    fsm = PairFSM()

    if args.serve_port:
        stream_server.start(args.serve_port)
        print(f"[bigscreen] 大屏页 http://0.0.0.0:{args.serve_port}/ （摄像头直播 + 配对演出）",
              flush=True)

    if args.source:
        run_playback(args, decoder, fsm)
    else:
        run_live(args, decoder, fsm)


if __name__ == "__main__":
    main()
