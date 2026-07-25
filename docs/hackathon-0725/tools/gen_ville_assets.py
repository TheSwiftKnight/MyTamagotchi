#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_ville_assets.py —— Reverie 像素小镇「板载原生前端」离线资产管线。

产物（直接写进固件工程 examples/multimedia/ville_native/）：
  1. src/ville_map.c + include/ville_map.h
       整个 agent 活动区(默认 tile x[58,127] y[14,64])离线合成 + 缩放的地图，
       导出为 LVGL v9 的 RGB565 lv_image_dsc_t（const，放 flash）。
  2. src/ville_sprites.c + include/ville_sprites.h
       Klaus / Isabella 两个角色的 down/left/right/up × 3 走路帧，
       ARGB8888 lv_image_dsc_t（带 alpha 透明），缩放到与地图 tile 同比例。
  3. src/ville_track.c + include/ville_track.h
       master_movement.json 里两个角色每步的地图像素坐标(int16)，编进固件，
       板子离线自播放，无需联网/串口。
  4. (可选) 一张预览 PNG，肉眼确认。

关键参数 MAP_TILE_PX：地图每 tile 渲染成多少像素。越大越清晰但 flash 越大。
  T5AI 代码分区 primary_cp_app ≈ 1360KB，地图 RGB565 会占其中一大块，
  10px → 700x510 ≈ 714KB；12px → 840x612 ≈ 1.0MB。默认 10 保守，编译通过后可上调。

用法：
  python3 gen_ville_assets.py                 # 用默认参数生成全部资产
  python3 gen_ville_assets.py --tile 12       # 换更大 tile
  python3 gen_ville_assets.py --preview       # 额外导出预览 PNG
"""
import argparse, json, os
from PIL import Image

# ---------------------------------------------------------------- 路径
REVERIE = "/Users/mychanging/Desktop/AdventureX/generative_agents/environment/frontend_server"
VIS = os.path.join(REVERIE, "static_dirs/assets/the_ville/visuals")
MAP_JSON = os.path.join(VIS, "the_ville_jan7.json")
CHAR_DIR = os.path.join(REVERIE, "static_dirs/assets/characters")
MOVE_JSON = os.path.join(REVERIE, "compressed_storage/world_visit_demo/master_movement.json")
META_JSON = os.path.join(REVERIE, "compressed_storage/world_visit_demo/meta.json")

FW = "/Users/mychanging/Desktop/AdventureX/TuyaOpen/examples/multimedia/ville_native"
SRC = os.path.join(FW, "src")
INC = os.path.join(FW, "include")

# agent 活动区（含边界）
REGION_X0, REGION_Y0, REGION_X1, REGION_Y1 = 58, 14, 127, 64

VISIBLE = ["Bottom Ground", "Exterior Ground", "Exterior Decoration L1",
           "Exterior Decoration L2", "Interior Ground", "Wall",
           "Interior Furniture L1", "Interior Furniture L2 ",
           "Foreground L1", "Foreground L2"]
FLIP_MASK = 0x1FFFFFFF

# 角色精灵 96x128 = 3列x4行(32px)。行 = down/left/right/up
DIR_ROW = {"down": 0, "left": 1, "right": 2, "up": 3}
DIR_ORDER = ["down", "left", "right", "up"]   # 与固件 enum 对齐
PERSONAS = [("Klaus Mueller", "Klaus_Mueller"),
            ("Isabella Rodriguez", "Isabella_Rodriguez")]


# ---------------------------------------------------------------- 地图渲染
def load_tilesets(m):
    ts = []
    for t in m["tilesets"]:
        img = Image.open(os.path.join(VIS, t["image"])).convert("RGBA")
        tc = t.get("transparentcolor")
        if tc:
            r = int(tc[1:3], 16); g = int(tc[3:5], 16); b = int(tc[5:7], 16)
            data = list(img.getdata())
            img.putdata([(0, 0, 0, 0) if (p[0], p[1], p[2]) == (r, g, b) else p for p in data])
        ts.append({"firstgid": t["firstgid"], "cols": t["columns"],
                   "tw": t["tilewidth"], "th": t["tileheight"], "img": img})
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


def render_region(m, ts):
    W, TW, TH = m["width"], m["tilewidth"], m["tileheight"]
    rw = REGION_X1 - REGION_X0 + 1
    rh = REGION_Y1 - REGION_Y0 + 1
    canvas = Image.new("RGBA", (rw * TW, rh * TH), (76, 175, 80, 255))  # 草地底色
    layers = {l["name"]: l for l in m["layers"] if l["type"] == "tilelayer"}
    for name in VISIBLE:
        L = layers.get(name)
        if not L:
            continue
        data = L["data"]
        for ty in range(REGION_Y0, REGION_Y1 + 1):
            for tx in range(REGION_X0, REGION_X1 + 1):
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
                canvas.alpha_composite(tile, ((tx - REGION_X0) * TW, (ty - REGION_Y0) * TH))
    return canvas.convert("RGB")


# ---------------------------------------------------------------- C 数组辅助
def rgb565_bytes(img):
    """RGB 图 -> RGB565 小端字节流 (LVGL LV_COLOR_FORMAT_RGB565)。"""
    px = img.load()
    w, h = img.size
    out = bytearray(w * h * 2)
    i = 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            v = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
            out[i] = v & 0xFF
            out[i + 1] = (v >> 8) & 0xFF
            i += 2
    return out


def argb8888_bytes(img):
    """RGBA 图 -> ARGB8888 字节流，内存序 B,G,R,A (LVGL LV_COLOR_FORMAT_ARGB8888)。"""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    out = bytearray(w * h * 4)
    i = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            out[i] = b; out[i + 1] = g; out[i + 2] = r; out[i + 3] = a
            i += 4
    return out


def emit_byte_array(f, name, data):
    f.write(f"const uint8_t {name}[{len(data)}] = {{\n")
    line = []
    for i, byte in enumerate(data):
        line.append(f"0x{byte:02x},")
        if len(line) == 16:
            f.write("    " + "".join(line) + "\n")
            line = []
    if line:
        f.write("    " + "".join(line) + "\n")
    f.write("};\n\n")


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tile", type=int, default=10, help="地图每 tile 渲染像素数")
    ap.add_argument("--step-ms", type=int, default=600, help="每步毫秒(固件插值时长)")
    ap.add_argument("--preview", action="store_true")
    args = ap.parse_args()

    os.makedirs(SRC, exist_ok=True)
    os.makedirs(INC, exist_ok=True)
    TILE = args.tile
    SPRITE = TILE  # 角色与 tile 同尺寸

    print(f"[1/4] 渲染地图区 tile=({REGION_X0},{REGION_Y0})-({REGION_X1},{REGION_Y1}) @ {TILE}px/tile ...")
    m = json.load(open(MAP_JSON))
    ts = load_tilesets(m)
    full = render_region(m, ts)              # 32px/tile
    rw = REGION_X1 - REGION_X0 + 1
    rh = REGION_Y1 - REGION_Y0 + 1
    map_w, map_h = rw * TILE, rh * TILE
    small = full.resize((map_w, map_h), Image.BILINEAR)
    if args.preview:
        prev = os.path.join(FW, "ville_map_preview.png")
        small.save(prev)
        print(f"      预览 PNG -> {prev}")

    print(f"      地图 {map_w}x{map_h}  RGB565 = {map_w*map_h*2} bytes")
    map_bytes = rgb565_bytes(small)

    # ---- ville_map.c/.h
    with open(os.path.join(SRC, "ville_map.c"), "w") as f:
        f.write('/* AUTO-GENERATED by tools/gen_ville_assets.py — do not edit. */\n')
        f.write('#include "ville_map.h"\n\n')
        emit_byte_array(f, "ville_map_data", map_bytes)
        f.write("const lv_image_dsc_t ville_map_dsc = {\n")
        f.write("    .header = { .magic = LV_IMAGE_HEADER_MAGIC, .cf = LV_COLOR_FORMAT_RGB565,\n")
        f.write("                .w = %d, .h = %d, .stride = %d },\n" % (map_w, map_h, map_w * 2))
        f.write("    .data = ville_map_data,\n")
        f.write("    .data_size = sizeof(ville_map_data),\n")
        f.write("};\n")
    with open(os.path.join(INC, "ville_map.h"), "w") as f:
        f.write("/* AUTO-GENERATED by tools/gen_ville_assets.py — do not edit. */\n")
        f.write("#ifndef __VILLE_MAP_H__\n#define __VILLE_MAP_H__\n")
        f.write('#include "lvgl.h"\n\n')
        f.write(f"#define VILLE_MAP_W        {map_w}\n")
        f.write(f"#define VILLE_MAP_H        {map_h}\n")
        f.write(f"#define VILLE_TILE_PX      {TILE}\n")
        f.write(f"#define VILLE_REGION_X0    {REGION_X0}\n")
        f.write(f"#define VILLE_REGION_Y0    {REGION_Y0}\n")
        f.write("extern const lv_image_dsc_t ville_map_dsc;\n")
        f.write("#endif\n")

    # ---- 角色精灵
    print(f"[2/4] 生成角色精灵 @ {SPRITE}px ...")
    sprite_c = open(os.path.join(SRC, "ville_sprites.c"), "w")
    sprite_c.write('/* AUTO-GENERATED by tools/gen_ville_assets.py — do not edit. */\n')
    sprite_c.write('#include "ville_sprites.h"\n\n')
    dsc_names = {}  # persona_idx -> {dir -> [dsc names per frame]}
    for pi, (_, fname) in enumerate(PERSONAS):
        sheet = Image.open(os.path.join(CHAR_DIR, fname + ".png")).convert("RGBA")
        dsc_names[pi] = {}
        for d in DIR_ORDER:
            row = DIR_ROW[d]
            names = []
            for frame in range(3):            # 三帧走路 (列 0,1,2)
                cell = sheet.crop((frame * 32, row * 32, frame * 32 + 32, row * 32 + 32))
                cell = cell.resize((SPRITE, SPRITE), Image.NEAREST)
                data = argb8888_bytes(cell)
                arr = f"spr_{pi}_{d}_{frame}"
                emit_byte_array(sprite_c, arr, data)
                dsc = arr + "_dsc"
                sprite_c.write(f"const lv_image_dsc_t {dsc} = {{\n")
                sprite_c.write("    .header = { .magic = LV_IMAGE_HEADER_MAGIC, .cf = LV_COLOR_FORMAT_ARGB8888,\n")
                sprite_c.write("                .w = %d, .h = %d, .stride = %d },\n" % (SPRITE, SPRITE, SPRITE * 4))
                sprite_c.write(f"    .data = {arr}, .data_size = sizeof({arr}),\n}};\n\n")
                names.append(dsc)
            dsc_names[pi][d] = names
    # 汇总表: [persona][dir][frame]
    sprite_c.write("const lv_image_dsc_t *ville_sprite[VILLE_NUM_PERSONA][VILLE_NUM_DIR][VILLE_WALK_FRAMES] = {\n")
    for pi in range(len(PERSONAS)):
        sprite_c.write("    { /* persona %d */\n" % pi)
        for d in DIR_ORDER:
            row = ", ".join("&" + n for n in dsc_names[pi][d])
            sprite_c.write("        { %s }, /* %s */\n" % (row, d))
        sprite_c.write("    },\n")
    sprite_c.write("};\n")
    sprite_c.close()
    with open(os.path.join(INC, "ville_sprites.h"), "w") as f:
        f.write("/* AUTO-GENERATED by tools/gen_ville_assets.py — do not edit. */\n")
        f.write("#ifndef __VILLE_SPRITES_H__\n#define __VILLE_SPRITES_H__\n")
        f.write('#include "lvgl.h"\n\n')
        f.write(f"#define VILLE_SPRITE_PX    {SPRITE}\n")
        f.write("#define VILLE_NUM_PERSONA  2\n")
        f.write("#define VILLE_NUM_DIR      4\n")
        f.write("#define VILLE_WALK_FRAMES  3\n")
        f.write("/* dir 枚举: 0=down 1=left 2=right 3=up (与生成器 DIR_ORDER 对齐) */\n")
        f.write("typedef enum { VILLE_DOWN=0, VILLE_LEFT=1, VILLE_RIGHT=2, VILLE_UP=3 } ville_dir_t;\n")
        f.write("extern const lv_image_dsc_t *ville_sprite[VILLE_NUM_PERSONA][VILLE_NUM_DIR][VILLE_WALK_FRAMES];\n")
        f.write("#endif\n")

    # ---- 轨迹
    print("[3/4] 抽取轨迹坐标 ...")
    move = json.load(open(MOVE_JSON))
    meta = json.load(open(META_JSON))
    steps = sorted(move.keys(), key=lambda x: int(x))
    nstep = len(steps)
    # 每步地图像素中心坐标
    def to_px(tx, ty):
        px = (tx - REGION_X0) * TILE + TILE // 2
        py = (ty - REGION_Y0) * TILE + TILE // 2
        return px, py
    xs = [[0] * nstep for _ in PERSONAS]
    ys = [[0] * nstep for _ in PERSONAS]
    for pi, (pname, _) in enumerate(PERSONAS):
        for si, s in enumerate(steps):
            tx, ty = move[s][pname]["movement"]
            px, py = to_px(tx, ty)
            xs[pi][si] = px; ys[pi][si] = py
    with open(os.path.join(SRC, "ville_track.c"), "w") as f:
        f.write('/* AUTO-GENERATED by tools/gen_ville_assets.py — do not edit. */\n')
        f.write('#include "ville_track.h"\n\n')
        for pi in range(len(PERSONAS)):
            f.write(f"static const int16_t track{pi}_x[VILLE_NUM_STEPS] = {{\n")
            f.write("    " + ",".join(str(v) for v in xs[pi]) + "\n};\n")
            f.write(f"static const int16_t track{pi}_y[VILLE_NUM_STEPS] = {{\n")
            f.write("    " + ",".join(str(v) for v in ys[pi]) + "\n};\n\n")
        f.write("const int16_t *ville_track_x[VILLE_NUM_PERSONA] = { track0_x, track1_x };\n")
        f.write("const int16_t *ville_track_y[VILLE_NUM_PERSONA] = { track0_y, track1_y };\n")
    with open(os.path.join(INC, "ville_track.h"), "w") as f:
        f.write("/* AUTO-GENERATED by tools/gen_ville_assets.py — do not edit. */\n")
        f.write("#ifndef __VILLE_TRACK_H__\n#define __VILLE_TRACK_H__\n")
        f.write("#include <stdint.h>\n\n")
        f.write("#define VILLE_NUM_PERSONA  2\n")
        f.write(f"#define VILLE_NUM_STEPS    {nstep}\n")
        f.write(f"#define VILLE_SEC_PER_STEP {meta.get('sec_per_step', 10)}\n")
        f.write(f"#define VILLE_STEP_MS      {args.step_ms}\n")
        f.write("extern const int16_t *ville_track_x[VILLE_NUM_PERSONA];\n")
        f.write("extern const int16_t *ville_track_y[VILLE_NUM_PERSONA];\n")
        f.write("#endif\n")

    print("[4/4] 完成。")
    print(f"      steps={nstep}  personas={len(PERSONAS)}  map={map_w}x{map_h}({map_w*map_h*2}B) sprite={SPRITE}px")
    print(f"      -> {SRC}/ville_map.c ville_sprites.c ville_track.c")


if __name__ == "__main__":
    main()
