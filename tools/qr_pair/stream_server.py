"""大屏流媒体服务（daemon 内嵌，纯标准库）。

Link2 同一时刻只能有一个视频消费者（SDK 明确警告），所以由识别 daemon
独占相机，这里把带识别框的画面二次分发出去：

  GET /             → 摊位大屏页（bigscreen.html）
  GET /stream.mjpg  → MJPEG 实时画面（多客户端）
  GET /events       → SSE 事件流（waiting / pairing / pair）
"""

import json
import queue
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

_frame: bytes | None = None
_frame_seq = 0
_frame_cond = threading.Condition()

_clients: list[queue.Queue] = []
_clients_lock = threading.Lock()


def set_frame(jpeg: bytes):
    """daemon 每帧调用：更新最新画面并唤醒所有 MJPEG 客户端。"""
    global _frame, _frame_seq
    with _frame_cond:
        _frame = jpeg
        _frame_seq += 1
        _frame_cond.notify_all()


def broadcast(event: dict):
    """daemon 调用：向所有 SSE 客户端推事件。"""
    with _clients_lock:
        for q in _clients:
            try:
                q.put_nowait(event)
            except queue.Full:
                pass


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def handle(self):
        try:
            super().handle()
        except (ConnectionResetError, BrokenPipeError, TimeoutError):
            pass   # 客户端断开是常态，别刷 traceback

    def do_GET(self):
        # 忽略查询串：父页（六环大屏）用 ?t= 时间戳强制 iframe 重载做在线探测
        if self.path.split("?", 1)[0] in ("/", "/index.html"):
            body = (BASE_DIR / "bigscreen.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/stream.mjpg":
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            last_seq = -1
            last_send = 0.0
            try:
                while True:
                    with _frame_cond:
                        _frame_cond.wait_for(lambda: _frame_seq != last_seq, timeout=2.0)
                        if _frame_seq == last_seq:
                            continue          # 超时醒来的重复帧不发（省带宽）
                        jpeg, last_seq = _frame, _frame_seq
                    if jpeg is None:
                        continue
                    # 限流 ~15fps：不限流时 30fps 的 1080p MJPEG 会把浏览器解码队列
                    # 压爆，画面不是变快而是整体冻住（真实踩坑）
                    now = time.monotonic()
                    if now - last_send < 1.0 / 15:
                        continue
                    last_send = now
                    self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\n"
                                     + f"Content-Length: {len(jpeg)}\r\n\r\n".encode()
                                     + jpeg + b"\r\n")
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                return

        if self.path == "/events":
            q: queue.Queue = queue.Queue(maxsize=64)
            with _clients_lock:
                _clients.append(q)
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                while True:
                    try:
                        ev = q.get(timeout=15)
                        self.wfile.write(f"data: {json.dumps(ev, ensure_ascii=False)}\n\n".encode())
                    except queue.Empty:
                        self.wfile.write(b": heartbeat\n\n")   # 保活
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                return
            finally:
                with _clients_lock:
                    if q in _clients:
                        _clients.remove(q)

        self.send_response(404)
        self.send_header("Content-Length", "9")
        self.end_headers()
        self.wfile.write(b"not found")

    def log_message(self, fmt, *args):
        pass   # 静默访问日志，避免刷 daemon 输出


def start(port: int) -> ThreadingHTTPServer:
    srv = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv
