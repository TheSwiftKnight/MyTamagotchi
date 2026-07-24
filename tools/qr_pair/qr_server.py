"""设备二维码展示服务（纯标准库 + qrcode，零额外依赖）。

任何设备浏览器访问：
  http://<本机IP>:8600/          → 选择 agent（卡片列表）
  http://<本机IP>:8600/qr/1      → agent 1 的全屏配对二维码页
                                    配对成功后页面自动翻转为结果页（轮询后端）
  http://<本机IP>:8600/qr/1.png  → 纯 PNG（板端/其他程序直接取图用）

用法：python qr_server.py [--port 8600] [--backend http://127.0.0.1:8000]
"""

import argparse
import io
import json
import re
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import urlopen

import qrcode

from config import BACKEND_URL, QR_PREFIX

# 页面模板用 __TOKEN__ 占位（不用 f-string，避免 CSS/JS 花括号转义地狱）
PAGE_QR = """<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="theme-color" content="#F5F0E8">
<title>__NAME__ · 合影配对</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { height: 100%; }
  body {
    font-family: "PingFang SC", -apple-system, "Noto Sans SC", sans-serif;
    background: #F5F0E8;
    background-image: radial-gradient(#E4DCCB 1px, transparent 1px);
    background-size: 22px 22px;
    color: #1C1911;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 22px; padding: 24px; overflow: hidden;
  }
  .who { text-align: center; }
  .who .av { width: 84px; height: 84px; object-fit: contain; display: block;
             margin: 0 auto 8px; border-radius: 50%; border: 2px solid #1C1911;
             background: #EFE9DD; animation: bob 2.4s ease-in-out infinite; }
  .who h1 { font-size: 26px; letter-spacing: 2px; }
  .who p  { font-size: 13px; color: #8B8578; margin-top: 4px; }
  @keyframes bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }

  .card {
    background: #fff; border: 2.5px solid #1C1911; border-radius: 18px;
    padding: 18px; box-shadow: 7px 7px 0 rgba(28,25,17,.9);
    transform: rotate(-1.2deg);
  }
  .card img { display: block; width: min(76vw, 52vh); height: auto; image-rendering: pixelated; }

  .status {
    display: flex; align-items: center; gap: 9px;
    background: #1C1911; color: #F5F0E8; font-size: 14px; letter-spacing: 1px;
    padding: 9px 18px; border-radius: 999px;
  }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: #7BC47F;
         animation: breath 1.6s ease-in-out infinite; }
  .dot.off { background: #D95D39; animation: none; }
  @keyframes breath { 0%,100% { opacity: .25; transform: scale(.8) } 50% { opacity: 1; transform: scale(1.15) } }
  .tip { font-size: 12px; color: #B0A897; }

  /* ---- 配对成功结果页 ---- */
  .result {
    position: fixed; inset: 0; background: #F5F0E8;
    background-image: radial-gradient(#E4DCCB 1px, transparent 1px); background-size: 22px 22px;
    display: none; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; padding: 26px; text-align: center;
    animation: rise .45s cubic-bezier(.2,.9,.3,1.2);
  }
  .result.show { display: flex; }
  @keyframes rise { from { transform: translateY(40px); opacity: 0 } to { transform: none; opacity: 1 } }
  .result .pairname { font-size: 19px; font-weight: 600; letter-spacing: 1px; }
  .score {
    font-size: 88px; font-weight: 800; line-height: 1; color: #D95D39;
    text-shadow: 4px 4px 0 rgba(28,25,17,.15);
  }
  .score small { font-size: 22px; font-weight: 600; color: #1C1911; }
  .reason { font-size: 15px; max-width: 320px; line-height: 1.6; }
  .topic {
    background: #fff; border: 2px solid #1C1911; border-radius: 14px;
    box-shadow: 4px 4px 0 rgba(28,25,17,.85);
    padding: 12px 18px; max-width: 320px; transform: rotate(1deg);
  }
  .topic b { display: block; font-size: 12px; color: #D95D39; letter-spacing: 2px; margin-bottom: 4px; }
  .topic span { font-size: 15px; }
  .chat { display: flex; flex-direction: column; gap: 8px; max-width: 330px; width: 100%;
          max-height: 26vh; overflow-y: auto; }
  .line { display: flex; gap: 8px; align-items: flex-start; text-align: left; }
  .line .e { width: 26px; height: 26px; flex: 0 0 26px; object-fit: contain;
             border-radius: 50%; border: 1.5px solid #1C1911; background: #EFE9DD; }
  .line .t { background: #fff; border: 1.5px solid #1C1911; border-radius: 4px 12px 12px 12px;
             padding: 7px 11px; font-size: 13.5px; line-height: 1.5; }
  .learned { font-size: 13px; background: #FBE8A6; border: 1.5px solid #1C1911;
             border-radius: 999px; padding: 7px 16px; }
  .again {
    margin-top: 4px; font-size: 15px; letter-spacing: 2px;
    background: #1C1911; color: #F5F0E8; border: none; border-radius: 999px;
    padding: 13px 34px; box-shadow: 4px 4px 0 rgba(217,93,57,.9);
    transition: transform .1s, box-shadow .1s;
  }
  .again:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 rgba(217,93,57,.9); }
</style>
</head>
<body>
  <div class="who">
    <img class="av" src="/avatar/__AGENT_ID__" alt="__NAME__">
    <h1>__NAME__</h1>
    <p>__OWNER__ 的搭子 · Agent #__AGENT_ID__</p>
  </div>

  <div class="card"><img src="/qr/__AGENT_ID__.png" alt="__PAYLOAD__"></div>

  <div class="status"><span class="dot" id="dot"></span><span id="stext">举到镜头前 · 等待合影</span></div>
  <div class="tip">屏幕亮度调到最高效果更好</div>

  <div class="result" id="result">
    <div class="pairname" id="r_pair"></div>
    <div class="score"><span id="r_score">0</span><small> / 100 灵魂契合</small></div>
    <div class="reason" id="r_reason"></div>
    <div class="topic"><b>值得聊的那件事</b><span id="r_topic"></span></div>
    <div class="chat" id="r_chat"></div>
    <div class="learned" id="r_learned" style="display:none"></div>
    <button class="again" onclick="dismiss()">继续配对</button>
  </div>

<script>
  const AGENT_ID = __AGENT_ID__;
  const BACKEND = location.protocol + "//" + location.hostname + ":8000";
  const FRESH_SEC = 90;           // 只展示 90 秒内的新配对，防止翻出旧结果
  let dismissed = localStorage.getItem("qr_dismissed") || "";

  if (navigator.wakeLock) navigator.wakeLock.request("screen").catch(() => {});

  function dismiss() {
    document.getElementById("result").classList.remove("show");
  }

  function countUp(el, target) {
    let v = 0; const step = Math.max(1, Math.round(target / 40));
    const t = setInterval(() => {
      v = Math.min(target, v + step);
      el.textContent = v;
      if (v >= target) clearInterval(t);
    }, 28);
  }

  function showResult(r) {
    const names = (r.agents || []).map(a => a.name).join("  ×  ");
    document.getElementById("r_pair").textContent = names;
    document.getElementById("r_reason").textContent = (r.resonance || {}).reason || "";
    document.getElementById("r_topic").textContent = (r.resonance || {}).topic || "";
    const chat = document.getElementById("r_chat");
    chat.innerHTML = "";
    (r.lines || []).forEach(l => {
      const d = document.createElement("div"); d.className = "line";
      // 头像走本服务的 /avatar 代理（同源），不直接拼后端 image URL
      d.innerHTML = '<img class="e" alt=""><span class="t"></span>';
      d.querySelector(".e").src = "/avatar/" + l.agent_id;
      d.querySelector(".t").textContent = l.name + "：" + l.text;
      chat.appendChild(d);
    });
    const lb = document.getElementById("r_learned");
    if (r.learned) {
      lb.style.display = "";
      lb.textContent = "✨ " + r.learned.learner + " 学会了「" + r.learned.skill + "」";
    } else lb.style.display = "none";
    document.getElementById("result").classList.add("show");
    countUp(document.getElementById("r_score"), (r.resonance || {}).score || 0);
    if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
  }

  async function poll() {
    try {
      const resp = await fetch(BACKEND + "/api/pair/latest/" + AGENT_ID, { cache: "no-store" });
      const r = await resp.json();
      document.getElementById("dot").classList.remove("off");
      document.getElementById("stext").textContent = "举到镜头前 · 等待合影";
      if (r && r.pair_id && r.pair_id !== dismissed
          && (Date.now() / 1000 - (r.ts || 0)) < FRESH_SEC) {
        dismissed = r.pair_id;
        localStorage.setItem("qr_dismissed", dismissed);
        showResult(r);
      }
    } catch (e) {
      document.getElementById("dot").classList.add("off");
      document.getElementById("stext").textContent = "后端连接中…";
    }
  }
  setInterval(poll, 2000); poll();
</script>
</body>
</html>"""

PAGE_INDEX = """<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#F5F0E8">
<title>ForkWorld · 合影配对</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body {
    font-family: "PingFang SC", -apple-system, "Noto Sans SC", sans-serif;
    background: #F5F0E8;
    background-image: radial-gradient(#E4DCCB 1px, transparent 1px); background-size: 22px 22px;
    color: #1C1911; min-height: 100vh; padding: 34px 22px 40px;
    display: flex; flex-direction: column; align-items: center;
  }
  h1 { font-size: 24px; letter-spacing: 3px; }
  .sub { font-size: 13px; color: #8B8578; margin: 8px 0 26px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 16px; width: 100%; max-width: 560px; }
  a.card {
    text-decoration: none; color: inherit; background: #fff;
    border: 2px solid #1C1911; border-radius: 16px; padding: 18px 12px;
    box-shadow: 5px 5px 0 rgba(28,25,17,.9); text-align: center;
    transition: transform .12s;
  }
  a.card:active { transform: translate(3px, 3px); box-shadow: 2px 2px 0 rgba(28,25,17,.9); }
  a.card:nth-child(odd) { transform: rotate(-1deg); }
  a.card:nth-child(even) { transform: rotate(1deg); }
  .av { width: 64px; height: 64px; object-fit: contain; display: block; margin: 0 auto 8px;
        border-radius: 50%; border: 2px solid #1C1911; background: #EFE9DD; }
  .name { font-size: 17px; font-weight: 600; }
  .owner { font-size: 12px; color: #8B8578; margin-top: 4px; }
  .empty { font-size: 14px; color: #8B8578; margin-top: 30px; text-align: center; line-height: 1.8; }
</style>
</head>
<body>
  <h1>ForkWorld 合影配对</h1>
  <div class="sub">选你的 agent → 把二维码举到镜头前</div>
  <div class="grid">__CARDS__</div>
  __EMPTY__
</body>
</html>"""

CARD = """<a class="card" href="/qr/__ID__">
  <img class="av" src="/avatar/__ID__" alt="__NAME__">
  <div class="name">__NAME__</div>
  <div class="owner">__OWNER__ 的搭子</div>
</a>"""


FALLBACK_AVATAR = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
    '<circle cx="50" cy="50" r="47" fill="#EFE9DD" stroke="#1C1911" stroke-width="3"/>'
    '<text x="50" y="52" font-size="44" text-anchor="middle" '
    'dominant-baseline="central">🐾</text></svg>'
).encode()


def fetch_agents(backend: str) -> dict[int, dict]:
    try:
        with urlopen(backend + "/api/agents", timeout=5) as resp:
            return {a["id"]: a for a in json.load(resp)}
    except Exception:
        return {}


def make_qr_png(payload: str) -> bytes:
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M,
                       box_size=16, border=4)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def lan_ip() -> str:
    # 优先物理网卡（代理软件的 fake-ip 网段 198.18.x 会污染默认路由探测）
    import subprocess
    for iface in ("en0", "en1"):
        r = subprocess.run(["ipconfig", "getifaddr", iface], capture_output=True, text=True)
        ip = r.stdout.strip()
        if ip and not ip.startswith("198.18."):
            return ip
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


class Handler(BaseHTTPRequestHandler):
    backend = BACKEND_URL

    def _send(self, code: int, body: bytes, ctype: str):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        m_png = re.fullmatch(r"/qr/(\d+)\.png", self.path)
        m_page = re.fullmatch(r"/qr/(\d+)", self.path)
        m_avatar = re.fullmatch(r"/avatar/(\d+)", self.path)

        if m_png:
            payload = f"{QR_PREFIX}{m_png.group(1)}"
            self._send(200, make_qr_png(payload), "image/png")
            return

        if m_avatar:
            # 头像代理：agent.image 是后端的相对 URL，手机直连 127.0.0.1 不通，
            # 由本服务转一手做成同源；取不到就给纸墨风占位图，绝不出现裂图。
            agent = fetch_agents(self.backend).get(int(m_avatar.group(1)), {})
            url = agent.get("image") or ""
            if url.startswith("/"):
                url = self.backend.rstrip("/") + url
            if url:
                try:
                    with urlopen(url, timeout=5) as resp:
                        self._send(200, resp.read(),
                                   resp.headers.get("Content-Type", "image/png"))
                        return
                except Exception:
                    pass
            self._send(200, FALLBACK_AVATAR, "image/svg+xml")
            return

        if m_page:
            aid = m_page.group(1)
            agent = fetch_agents(self.backend).get(int(aid), {})
            html = (PAGE_QR
                    .replace("__AGENT_ID__", aid)
                    .replace("__PAYLOAD__", f"{QR_PREFIX}{aid}")
                    .replace("__NAME__", agent.get("name", f"Agent {aid}"))
                    .replace("__OWNER__", agent.get("owner_name", "?")))
            self._send(200, html.encode(), "text/html; charset=utf-8")
            return

        if self.path == "/":
            agents = fetch_agents(self.backend)
            cards = "".join(
                CARD.replace("__ID__", str(aid))
                    .replace("__NAME__", a.get("name", "?"))
                    .replace("__OWNER__", a.get("owner_name", "?"))
                for aid, a in sorted(agents.items())
            )
            empty = "" if cards else '<div class="empty">后端未启动<br>也可以直接访问 /qr/&lt;agent_id&gt;</div>'
            html = PAGE_INDEX.replace("__CARDS__", cards).replace("__EMPTY__", empty)
            self._send(200, html.encode(), "text/html; charset=utf-8")
            return

        self._send(404, b"not found", "text/plain")

    def log_message(self, fmt, *args):
        print(f"[qr_server] {self.client_address[0]} {fmt % args}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8600)
    ap.add_argument("--backend", default=BACKEND_URL)
    args = ap.parse_args()

    Handler.backend = args.backend
    srv = ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
    ip = lan_ip()
    print(f"[qr_server] 已启动：http://{ip}:{args.port}/  （设备访问 /qr/<agent_id>）", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
