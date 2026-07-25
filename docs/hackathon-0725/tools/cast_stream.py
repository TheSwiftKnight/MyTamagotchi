#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cast_stream.py —— 把浏览器里的 Reverie 世界(canvas)实时投到 T5AI-Board 串口屏。

流程: Playwright 无头浏览器打开 demo -> 定时抓 canvas 像素 ->
       裁/缩到面板尺寸(默认 320x480) -> JPEG 压缩 -> 串口按帧协议发出。

帧协议(小端): [0xA5 0x5A 0x69 0x96][len uint32 LE][jpeg ...]

用法:
  # 先看一眼处理后的单帧长什么样(不连串口,存成 png)
  python3 cast_stream.py --once --save /tmp/frame.png

  # 正式投屏
  python3 cast_stream.py --port /dev/cu.usbmodem5AAE1671641
"""
import argparse, base64, io, struct, sys, time

MAGIC = bytes([0xA5, 0x5A, 0x69, 0x96])


def build_frame(jpeg_bytes: bytes) -> bytes:
    return MAGIC + struct.pack("<I", len(jpeg_bytes)) + jpeg_bytes


def process_image(png_bytes: bytes, W: int, H: int, rotate: int, quality: int,
                  mode: str) -> bytes:
    from PIL import Image
    img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    if rotate:
        img = img.rotate(-rotate, expand=True)  # 顺时针

    if mode == "fill":
        # 铺满:等比放大后中心裁剪到 WxH
        sw, sh = img.size
        scale = max(W / sw, H / sh)
        nw, nh = int(sw * scale + 0.5), int(sh * scale + 0.5)
        img = img.resize((nw, nh), Image.LANCZOS)
        left, top = (nw - W) // 2, (nh - H) // 2
        img = img.crop((left, top, left + W, top + H))
    else:  # fit: 等比缩放,黑边填充,完整显示
        img_fit = img.copy()
        img_fit.thumbnail((W, H), Image.LANCZOS)
        canvas = Image.new("RGB", (W, H), (0, 0, 0))
        canvas.paste(img_fit, ((W - img_fit.width) // 2, (H - img_fit.height) // 2))
        img = canvas

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8100/demo/world_visit_demo/1/3/")
    ap.add_argument("--port", default=None, help="串口设备,如 /dev/cu.usbmodem5AAE1671641")
    ap.add_argument("--baud", type=int, default=921600)
    ap.add_argument("--width", type=int, default=320, help="面板帧缓冲宽")
    ap.add_argument("--height", type=int, default=480, help="面板帧缓冲高")
    ap.add_argument("--rotate", type=int, default=90, choices=[0, 90, 180, 270])
    ap.add_argument("--mode", default="fit", choices=["fit", "fill"])
    ap.add_argument("--quality", type=int, default=72)
    ap.add_argument("--fps", type=float, default=8.0)
    ap.add_argument("--once", action="store_true", help="只抓一帧")
    ap.add_argument("--save", default=None, help="把处理后的帧另存为图片(调试用)")
    args = ap.parse_args()

    from playwright.sync_api import sync_playwright

    ser = None
    if args.port:
        import serial
        ser = serial.Serial(args.port, args.baud, timeout=1)
        print(f"[serial] {args.port} @ {args.baud}", file=sys.stderr)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1500, "height": 850})
        print(f"[browser] loading {args.url}", file=sys.stderr)
        page.goto(args.url, wait_until="networkidle", timeout=60000)
        canvas_el = page.wait_for_selector("canvas", timeout=30000)
        time.sleep(3.0)  # 等世界渲染出来

        interval = 1.0 / args.fps if args.fps > 0 else 0
        n = 0
        t0 = time.time()
        try:
            while True:
                # WebGL 画布必须用 screenshot(走合成器),toDataURL 会是黑的
                png = canvas_el.screenshot(type="png")
                jpeg = process_image(png, args.width, args.height,
                                     args.rotate, args.quality, args.mode)

                if args.save:
                    with open(args.save, "wb") as f:
                        f.write(jpeg)
                    print(f"[saved] {args.save} ({len(jpeg)} bytes JPEG)", file=sys.stderr)

                if ser:
                    ser.write(build_frame(jpeg))
                    ser.flush()

                n += 1
                if n % 10 == 0:
                    fps = n / (time.time() - t0)
                    print(f"[stream] frames={n} jpeg={len(jpeg)}B avg_fps={fps:.1f}",
                          file=sys.stderr)

                if args.once:
                    break
                if interval:
                    time.sleep(interval)
        except KeyboardInterrupt:
            print("\n[stop]", file=sys.stderr)
        finally:
            browser.close()
            if ser:
                ser.close()


if __name__ == "__main__":
    main()
