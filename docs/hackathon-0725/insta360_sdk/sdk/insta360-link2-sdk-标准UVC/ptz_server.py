#!/usr/bin/env python3
import json
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
GETTER = ROOT / "uvc_ptz_get"
SETTER = ROOT / "uvc_ptz_set"

PAN_MIN = -360000
PAN_MAX = 360000
TILT_MIN = -270000
TILT_MAX = 270000
DEFAULT_STEP = 36000
WAKE_PROCESS = None
JPEG_SOI = b"\xff\xd8"
JPEG_EOI = b"\xff\xd9"
CAMERA_PROCESS = None
CAMERA_THREAD = None
CAMERA_LOCK = threading.Lock()
FRAME_COND = threading.Condition(CAMERA_LOCK)
LATEST_FRAME = None
LATEST_FRAME_TIME = 0
CAMERA_SOURCE = ""
CAMERA_ERROR = ""


HTML = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Insta360 云台控制</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f6f7f8;
      color: #202124;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
    }
    main {
      width: min(980px, calc(100vw - 32px));
      padding: 28px;
      box-sizing: border-box;
    }
    h1 {
      margin: 0 0 18px;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .panel {
      background: #fff;
      border: 1px solid #d7dce1;
      border-radius: 8px;
      padding: 22px;
      box-shadow: 0 12px 34px rgba(0, 0, 0, 0.08);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(310px, 0.65fr);
      gap: 18px;
      align-items: start;
    }
    .video-wrap {
      overflow: hidden;
      background: #111418;
      border: 1px solid #c7cdd4;
      border-radius: 8px;
      aspect-ratio: 16 / 9;
    }
    .video-wrap img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(72px, 88px));
      grid-template-rows: repeat(3, 68px);
      gap: 10px;
      justify-content: center;
      margin: 18px 0 22px;
    }
    button {
      border: 1px solid #c7cdd4;
      background: #f7f8fa;
      color: #202124;
      border-radius: 8px;
      font-size: 28px;
      font-weight: 650;
      cursor: pointer;
      min-width: 0;
    }
    button:active {
      transform: translateY(1px);
      background: #e8edf2;
    }
    button.primary {
      background: #1d6f5f;
      border-color: #1d6f5f;
      color: white;
      font-size: 16px;
    }
    .controls {
      display: grid;
      gap: 14px;
    }
    label {
      display: grid;
      gap: 8px;
      font-size: 14px;
      color: #4b5560;
    }
    input[type="range"] {
      width: 100%;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    code {
      font: 14px ui-monospace, SFMono-Regular, Menlo, monospace;
      background: #eef1f4;
      padding: 4px 7px;
      border-radius: 6px;
    }
    .status {
      min-height: 24px;
      color: #4b5560;
      font-size: 14px;
    }
    @media (max-width: 820px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
    @media (prefers-color-scheme: dark) {
      :root { background: #111418; color: #eef1f4; }
      .panel { background: #191e24; border-color: #313943; box-shadow: none; }
      .video-wrap { border-color: #3a4450; }
      button { background: #222932; border-color: #3a4450; color: #eef1f4; }
      button:active { background: #2b3440; }
      code { background: #252c35; }
      label, .status { color: #a9b3bd; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Insta360 Link 2 云台控制</h1>
    <section class="layout">
      <div class="panel">
        <div class="video-wrap">
          <img id="video" src="/video.mjpg" alt="Insta360 实时画面">
        </div>
      </div>
      <div class="panel">
        <div class="row">
          <div>当前位置 <code id="pos">读取中...</code></div>
          <button class="primary" id="refresh">刷新</button>
        </div>
        <div class="row">
          <div>视频源 <code id="source">检测中...</code></div>
        </div>

        <div class="grid" aria-label="云台方向控制">
          <span></span><button data-move="up" title="上">↑</button><span></span>
          <button data-move="left" title="左">←</button><button class="primary" data-move="center">回中</button><button data-move="right" title="右">→</button>
          <span></span><button data-move="down" title="下">↓</button><span></span>
        </div>

        <div class="controls">
          <label>
            步长 <span><code id="stepLabel">36000</code></span>
            <input id="step" type="range" min="3600" max="144000" step="3600" value="36000">
          </label>
          <div class="status" id="status"></div>
        </div>
      </div>
    </section>
  </main>
  <script>
    const posEl = document.getElementById('pos');
    const statusEl = document.getElementById('status');
    const stepEl = document.getElementById('step');
    const stepLabel = document.getElementById('stepLabel');
    const videoEl = document.getElementById('video');
    const sourceEl = document.getElementById('source');

    function setStatus(text) {
      statusEl.textContent = text || '';
    }

    async function api(path, options) {
      const res = await fetch(path, options);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || res.statusText);
      return data;
    }

    function showPosition(data) {
      posEl.textContent = `pan ${data.pan}, tilt ${data.tilt}`;
    }

    async function refresh() {
      try {
        const data = await api('/api/position');
        showPosition(data);
        setStatus('');
        refreshCamera();
      } catch (err) {
        setStatus(err.message);
      }
    }

    async function refreshCamera() {
      try {
        const data = await api('/api/camera');
        sourceEl.textContent = data.source || '未连接';
        if (data.error) setStatus(data.error);
      } catch (err) {
        sourceEl.textContent = '未知';
      }
    }

    async function move(dir) {
      try {
        setStatus('发送中...');
        const step = Number(stepEl.value);
        const data = await api('/api/move', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({dir, step})
        });
        showPosition(data);
        setStatus('完成');
      } catch (err) {
        setStatus(err.message);
      }
    }

    stepEl.addEventListener('input', () => stepLabel.textContent = stepEl.value);
    document.getElementById('refresh').addEventListener('click', refresh);
    videoEl.addEventListener('error', () => setStatus('视频流未打开，刷新页面重试'));
    document.querySelectorAll('button[data-move]').forEach(button => {
      button.addEventListener('click', () => move(button.dataset.move));
    });
    refresh();
    setInterval(refreshCamera, 2000);
  </script>
</body>
</html>
"""


def clamp(value, low, high):
    return max(low, min(high, value))


def run_json(command):
    proc = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=3)
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or "command failed").strip())
    return json.loads(proc.stdout)


def current_position():
    return run_json([str(GETTER)])


def set_position(pan, tilt):
    proc = subprocess.run(
        [str(SETTER), str(int(pan)), str(int(tilt))],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=3,
    )
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or "set failed").strip())
    return current_position()


def move_position(direction, step):
    if direction == "center":
        return set_position(0, 0)

    pos = current_position()
    pan = int(pos["pan"])
    tilt = int(pos["tilt"])

    if direction == "left":
        pan -= step
    elif direction == "right":
        pan += step
    elif direction == "up":
        tilt += step
    elif direction == "down":
        tilt -= step
    else:
        raise ValueError("unknown direction")

    return set_position(clamp(pan, PAN_MIN, PAN_MAX), clamp(tilt, TILT_MIN, TILT_MAX))


def wake_running():
    global WAKE_PROCESS
    return WAKE_PROCESS is not None and WAKE_PROCESS.poll() is None


def set_wake(running):
    global WAKE_PROCESS
    if running:
        if not wake_running():
            WAKE_PROCESS = subprocess.Popen(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-f",
                    "avfoundation",
                    "-pixel_format",
                    "uyvy422",
                    "-framerate",
                    "30",
                    "-video_size",
                    "1280x720",
                    "-i",
                    avfoundation_device_spec(),
                    "-an",
                    "-f",
                    "null",
                    "-",
                ],
                cwd=ROOT,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                text=True,
            )
        return {"running": wake_running()}

    if wake_running():
        WAKE_PROCESS.terminate()
        try:
            WAKE_PROCESS.wait(timeout=2)
        except subprocess.TimeoutExpired:
            WAKE_PROCESS.kill()
            WAKE_PROCESS.wait(timeout=2)
    WAKE_PROCESS = None
    return {"running": False}


def avfoundation_device_spec():
    proc = subprocess.run(
        ["ffmpeg", "-f", "avfoundation", "-list_devices", "true", "-i", ""],
        text=True,
        capture_output=True,
        timeout=5,
    )
    output = f"{proc.stderr}\n{proc.stdout}"
    for line in output.splitlines():
        if "] Insta360 Link 2" not in line:
            continue
        end = line.find("] Insta360 Link 2")
        start = line.rfind("[", 0, end)
        if start >= 0:
            return f"{int(line[start + 1:end])}:none"
    raise RuntimeError("Insta360 Link 2 not found in AVFoundation device list")


def iter_jpegs(stream):
    data = b""
    while True:
        chunk = stream.read(16384)
        if not chunk:
            break
        data += chunk
        while True:
            start = data.find(JPEG_SOI)
            if start < 0:
                data = data[-2:]
                break
            end = data.find(JPEG_EOI, start + 2)
            if end < 0:
                data = data[start:]
                break
            end += 2
            yield data[start:end]
            data = data[end:]


def open_camera_process():
    last_error = ""
    for camera_input in [avfoundation_device_spec()]:
        proc = subprocess.Popen(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-f",
                "avfoundation",
                "-pixel_format",
                "uyvy422",
                "-framerate",
                "30",
                "-video_size",
                "1280x720",
                "-i",
                camera_input,
                "-an",
                "-vf",
                "fps=15",
                "-q:v",
                "5",
                "-f",
                "mjpeg",
                "pipe:1",
            ],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        deadline = time.monotonic() + 2.5
        data = b""
        while time.monotonic() < deadline and proc.poll() is None:
            chunk = proc.stdout.read(4096)
            if chunk:
                data += chunk
                if JPEG_SOI in data and JPEG_EOI in data:
                    return proc, camera_input, data
            else:
                time.sleep(0.03)
        try:
            last_error = proc.stderr.read().decode("utf-8", "replace").strip()
        except Exception:
            last_error = "camera open failed"
        proc.terminate()
        try:
            proc.wait(timeout=1)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=1)
    raise RuntimeError(last_error or "camera open failed")


def camera_worker():
    global CAMERA_PROCESS, CAMERA_SOURCE, CAMERA_ERROR, LATEST_FRAME, LATEST_FRAME_TIME
    while True:
        try:
            proc, source, buffered = open_camera_process()
            with CAMERA_LOCK:
                CAMERA_PROCESS = proc
                CAMERA_SOURCE = source
                CAMERA_ERROR = ""
                FRAME_COND.notify_all()

            def combined():
                yield buffered
                while True:
                    chunk = proc.stdout.read(16384)
                    if not chunk:
                        break
                    yield chunk

            data = b""
            for chunk in combined():
                data += chunk
                while True:
                    start = data.find(JPEG_SOI)
                    if start < 0:
                        data = data[-2:]
                        break
                    end = data.find(JPEG_EOI, start + 2)
                    if end < 0:
                        data = data[start:]
                        break
                    end += 2
                    frame = data[start:end]
                    data = data[end:]
                    with CAMERA_LOCK:
                        LATEST_FRAME = frame
                        LATEST_FRAME_TIME = time.time()
                        FRAME_COND.notify_all()
            proc.terminate()
        except Exception as err:
            with CAMERA_LOCK:
                CAMERA_PROCESS = None
                CAMERA_SOURCE = ""
                CAMERA_ERROR = str(err)
                FRAME_COND.notify_all()
            time.sleep(1)


def ensure_camera():
    global CAMERA_THREAD
    with CAMERA_LOCK:
        alive = CAMERA_THREAD is not None and CAMERA_THREAD.is_alive()
        if not alive:
            CAMERA_THREAD = threading.Thread(target=camera_worker, daemon=True)
            CAMERA_THREAD.start()


def camera_status():
    ensure_camera()
    with CAMERA_LOCK:
        return {
            "source": CAMERA_SOURCE,
            "error": CAMERA_ERROR,
            "age": round(time.time() - LATEST_FRAME_TIME, 2) if LATEST_FRAME_TIME else None,
        }


def stream_video(handler):
    set_wake(False)
    ensure_camera()
    handler.send_response(200)
    handler.send_header("content-type", "multipart/x-mixed-replace; boundary=frame")
    handler.send_header("cache-control", "no-store")
    handler.end_headers()

    last_sent = 0
    try:
        while True:
            with CAMERA_LOCK:
                FRAME_COND.wait_for(
                    lambda: (LATEST_FRAME is not None and LATEST_FRAME_TIME != last_sent) or CAMERA_ERROR,
                    timeout=5,
                )
                if CAMERA_ERROR and LATEST_FRAME is None:
                    raise RuntimeError(CAMERA_ERROR)
                jpg = LATEST_FRAME
                last_sent = LATEST_FRAME_TIME
            if not jpg:
                continue
            handler.wfile.write(b"--frame\r\n")
            handler.wfile.write(b"Content-Type: image/jpeg\r\n")
            handler.wfile.write(f"Content-Length: {len(jpg)}\r\n\r\n".encode("ascii"))
            handler.wfile.write(jpg)
            handler.wfile.write(b"\r\n")
            handler.wfile.flush()
    except (BrokenPipeError, ConnectionResetError):
        pass


def stream_video_old(handler):
    set_wake(False)
    proc = subprocess.Popen(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "avfoundation",
            "-pixel_format",
            "uyvy422",
            "-framerate",
            "30",
            "-video_size",
            "1280x720",
            "-i",
            "1:none",
            "-an",
            "-vf",
            "fps=15",
            "-q:v",
            "5",
            "-f",
            "mjpeg",
            "pipe:1",
        ],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    handler.send_response(200)
    handler.send_header("content-type", "multipart/x-mixed-replace; boundary=frame")
    handler.send_header("cache-control", "no-store")
    handler.end_headers()

    try:
        for jpg in iter_jpegs(proc.stdout):
            handler.wfile.write(b"--frame\r\n")
            handler.wfile.write(b"Content-Type: image/jpeg\r\n")
            handler.wfile.write(f"Content-Length: {len(jpg)}\r\n\r\n".encode("ascii"))
            handler.wfile.write(jpg)
            handler.wfile.write(b"\r\n")
            handler.wfile.flush()
    except (BrokenPipeError, ConnectionResetError):
        pass
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=2)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            body = HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("content-type", "text/html; charset=utf-8")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/video.mjpg":
            try:
                stream_video(self)
            except Exception:
                pass
            return
        if path == "/api/position":
            try:
                self.send_json(current_position())
            except Exception as err:
                self.send_json({"error": str(err)}, 500)
            return
        if path == "/api/wake":
            self.send_json({"running": wake_running()})
            return
        if path == "/api/camera":
            self.send_json(camera_status())
            return
        self.send_json({"error": "not found"}, 404)

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/wake":
            try:
                length = int(self.headers.get("content-length", "0"))
                payload = json.loads(self.rfile.read(length) or b"{}")
                self.send_json(set_wake(bool(payload.get("running"))))
            except Exception as err:
                self.send_json({"error": str(err)}, 500)
            return
        if path != "/api/move":
            self.send_json({"error": "not found"}, 404)
            return
        try:
            length = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            direction = str(payload.get("dir", ""))
            step = clamp(int(payload.get("step", DEFAULT_STEP)), 3600, 144000)
            self.send_json(move_position(direction, step))
        except Exception as err:
            self.send_json({"error": str(err)}, 500)


def main():
    port = 8787
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"PTZ control UI: http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
