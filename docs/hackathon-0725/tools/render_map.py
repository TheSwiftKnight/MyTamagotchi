#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
render_map.py —— 把 Reverie 的 Tiled 地图离线合成为一张位图。
用于板子端"专属前端":地图是全程静态的,离线渲染一次,板子只做窗口显示。

用法:
  python3 render_map.py                      # 渲染整张地图 -> /tmp/ville_full.png
  python3 render_map.py --x0 58 --y0 14 --x1 127 --y1 64 --out /tmp/ville_region.png
"""
import argparse, json, os
from PIL import Image

BASE = "/Users/mychanging/Desktop/AdventureX/generative_agents/environment/frontend_server/static_dirs/assets/the_ville/visuals"
MAP = os.path.join(BASE, "the_ville_jan7.json")

# 只渲染这些"可见"图层,跳过碰撞/逻辑 block 层
VISIBLE = ["Bottom Ground", "Exterior Ground", "Exterior Decoration L1",
           "Exterior Decoration L2", "Interior Ground", "Wall",
           "Interior Furniture L1", "Interior Furniture L2 ",
           "Foreground L1", "Foreground L2"]

FLIP_MASK = 0x1FFFFFFF  # 去掉高位翻转标志


def load_tilesets(m):
    ts = []
    for t in m["tilesets"]:
        img = Image.open(os.path.join(BASE, t["image"])).convert("RGBA")
        tc = t.get("transparentcolor")
        if tc:
            r = int(tc[1:3], 16); g = int(tc[3:5], 16); b = int(tc[5:7], 16)
            px = img.getdata()
            img.putdata([(0, 0, 0, 0) if (p[0], p[1], p[2]) == (r, g, b) else p for p in px])
        ts.append({"firstgid": t["firstgid"], "cols": t["columns"],
                   "tw": t["tilewidth"], "th": t["tileheight"], "img": img,
                   "count": t["tilecount"]})
    ts.sort(key=lambda x: x["firstgid"])
    return ts


def find_ts(ts, gid):
    chosen = None
    for t in ts:
        if gid >= t["firstgid"]:
            chosen = t
        else:
            break
    return chosen


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--x0", type=int, default=0)
    ap.add_argument("--y0", type=int, default=0)
    ap.add_argument("--x1", type=int, default=None)  # 含
    ap.add_argument("--y1", type=int, default=None)
    ap.add_argument("--out", default="/tmp/ville_full.png")
    args = ap.parse_args()

    m = json.load(open(MAP))
    W, H, TW, TH = m["width"], m["height"], m["tilewidth"], m["tileheight"]
    x1 = args.x1 if args.x1 is not None else W - 1
    y1 = args.y1 if args.y1 is not None else H - 1
    rw, rh = (x1 - args.x0 + 1), (y1 - args.y0 + 1)

    ts = load_tilesets(m)
    canvas = Image.new("RGBA", (rw * TW, rh * TH), (60, 160, 70, 255))  # 草地底色

    layers = {l["name"]: l for l in m["layers"] if l["type"] == "tilelayer"}
    for name in VISIBLE:
        L = layers.get(name)
        if not L:
            continue
        data = L["data"]
        for ty in range(args.y0, y1 + 1):
            for tx in range(args.x0, x1 + 1):
                gid = data[ty * W + tx] & FLIP_MASK
                if gid == 0:
                    continue
                t = find_ts(ts, gid)
                if not t:
                    continue
                lid = gid - t["firstgid"]
                sx = (lid % t["cols"]) * t["tw"]
                sy = (lid // t["cols"]) * t["th"]
                tile = t["img"].crop((sx, sy, sx + t["tw"], sy + t["th"]))
                canvas.alpha_composite(tile, ((tx - args.x0) * TW, (ty - args.y0) * TH))

    canvas.convert("RGB").save(args.out)
    print(f"saved {args.out}  region tiles=({args.x0},{args.y0})-({x1},{y1})  px={rw*TW}x{rh*TH}")


if __name__ == "__main__":
    main()
