#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cast_wifi_server.py —— WiFi 投屏电脑端。开一个 TCP 服务器,板子连上来后
持续把浏览器 canvas 截图压成 JPEG,按帧协议推给板子。

帧协议(小端): [0xA5 0x5A 0x69 0x96][len uint32 LE][jpeg ...]

用法:
  python3 cast_wifi_server.py                 # 监听 0.0.0.0:9000
  python3 cast_wifi_server.py --port 9000 --rotate 90 --mode fill --fps 10
"""
import argparse, io, socket, struct, sys, time

MAGIC = bytes([0xA5, 0x5A, 0x69, 0x96])


def build_frame(j: bytes) -> bytes:
    return MAGIC + struct.pack("<I", len(j)) + j


def process_image(png_bytes, W, H, rotate, quality, mode):
    from PIL import Image
    img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    if rotate:
        img = img.rotate(-rotate, expand=True)
    if mode == "fill":
        sw, sh = img.size
        scale = max(W / sw, H / sh)
        nw, nh = int(sw * scale + 0.5), int(sh * scale + 0.5)
        img = img.resize((nw, nh), Image.LANCZOS)
        left, top = (nw - W) // 2, (nh - H) // 2
        img = img.crop((left, top, left + W, top + H))
    else:
        f = img.copy(); f.thumbnail((W, H), Image.LANCZOS)
        c = Image.new("RGB", (W, H), (0, 0, 0))
        c.paste(f, ((W - f.width) // 2, (H - f.height) // 2)); img = c
    buf = io.BytesIO(); img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8100/demo/world_visit_demo/1/3/")
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=9000)
    ap.add_argument("--width", type=int, default=320)
    ap.add_argument("--height", type=int, default=480)
    ap.add_argument("--rotate", type=int, default=90, choices=[0, 90, 180, 270])
    ap.add_argument("--mode", default="fill", choices=["fit", "fill"])
    ap.add_argument("--quality", type=int, default=72)
    ap.add_argument("--fps", type=float, default=10.0)
    args = ap.parse_args()

    from playwright.sync_api import sync_playwright

    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((args.host, args.port))
    srv.listen(1)
    print(f"[server] listening {args.host}:{args.port} — 等板子连接...", file=sys.stderr)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1500, "height": 850})
        print(f"[browser] loading {args.url}", file=sys.stderr)
        page.goto(args.url, wait_until="networkidle", timeout=60000)
        canvas_el = page.wait_for_selector("canvas", timeout=30000)
        time.sleep(3.0)
        print("[browser] world ready", file=sys.stderr)

        interval = 1.0 / args.fps if args.fps > 0 else 0
        while True:
            print("[server] 等待板子连接...", file=sys.stderr)
            conn, addr = srv.accept()
            conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            print(f"[server] 板子已连接: {addr}", file=sys.stderr)
            n = 0; t0 = time.time()
            try:
                while True:
                    png = canvas_el.screenshot(type="png")
                    jpeg = process_image(png, args.width, args.height,
                                         args.rotate, args.quality, args.mode)
                    conn.sendall(build_frame(jpeg))
                    n += 1
                    if n % 10 == 0:
                        print(f"[stream] frames={n} jpeg={len(jpeg)}B fps={n/(time.time()-t0):.1f}",
                              file=sys.stderr)
                    if interval:
                        time.sleep(interval)
            except (BrokenPipeError, ConnectionResetError, OSError) as e:
                print(f"[server] 板子断开 ({e}),等待重连", file=sys.stderr)
            finally:
                try: conn.close()
                except Exception: pass


if __name__ == "__main__":
    main()
