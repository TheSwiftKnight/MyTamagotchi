#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_forkworld_assets.py —— ForkWorld「板载原生前端」离线资产管线（T5AI 480x320）。

6 个世界逐个轮播版：把 6 个世界各渲染成一张场景位图，固件每 ~9s 交叉淡入切换。

产物（写进固件工程 examples/multimedia/forkworld_native/）：
  1. src/forkworld_scene.c + include/forkworld_scene.h
       6 张 ForkWorld 世界场景（纸面底 + 手绘建筑 + 装饰 + 烘焙标题），
       RGB565 lv_image_dsc_t 数组 fw_scene[FW_WORLD_N]（const，放 flash / AP 核）。
  2. src/forkworld_char.c + include/forkworld_char.h
       6 个世界各自的物品拟人角色（右/左朝向）。ARGB8888 数组
       fw_char_r[FW_WORLD_N] / fw_char_l[FW_WORLD_N]。
  3. src/forkworld_track.c + include/forkworld_track.h
       一条共享的环形走动路径（场景像素坐标 int16），板子离线循环走。

场景与角色素材来自 Gemini 手绘 sprites（forkworld/assets/sprites/*.png）。
标题中文直接用 PIL 烘焙进位图，免去 LVGL 内置 CJK 字体依赖。

用法：python3 gen_forkworld_assets.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

# ----------------------------------------------------------------- 路径
FWROOT = "/Users/mychanging/Desktop/AdventureX/generative_agents/environment/frontend_server/static_dirs/forkworld"
SPR = os.path.join(FWROOT, "assets/sprites")
FW = "/Users/mychanging/Desktop/AdventureX/TuyaOpen/examples/multimedia/forkworld_native"
SRC, INC = os.path.join(FW, "src"), os.path.join(FW, "include")

SCENE_W, SCENE_H = 520, 360          # 场景位图尺寸（>480x320，留平移余量）
CHAR_H = 56                          # 角色显示高度(px)
STEP_MS = 620                        # 每个路径点之间的插值时长

CN_FONT = "/System/Library/Fonts/STHeiti Medium.ttc"

# ----------------------------------------------------------------- 6 个世界配置
# 建筑摆位: (sprite, 底部中心x, 底部中心y, 目标高度)；场景 520 宽，三栋用 125/300/435
def blds3(a, b, c, ha=116, hb=150, hc=110):
    return [(a, 125, 236, ha), (b, 300, 262, hb), (c, 435, 238, hc)]

WORLDS = [
    {"name": "熬夜实验室", "sub": "阿鹏 · 常年凌晨三点", "char": "char_lamp.png",
     "accent": (232, 99, 74),
     "buildings": blds3("bld_shelf.png", "bld_lab.png", "bld_statue.png", 120, 150, 104)},
    {"name": "多肉银行", "sub": "小满 · 下午四点的阳光", "char": "char_book.png",
     "accent": (74, 127, 165),
     "buildings": blds3("bld_studio.png", "bld_greenhouse.png", "bld_market.png", 116, 148, 116)},
    {"name": "四点半天亮前", "sub": "老徐 · 数字归数字，山归山", "char": "char_headphones.png",
     "accent": (107, 158, 122),
     "buildings": blds3("bld_library.png", "bld_mountain.png", "bld_archive.png", 116, 150, 110)},
    {"name": "深夜电台", "sub": "Momo · 低声细语，信号满格", "char": "char_mic.png",
     "accent": (212, 168, 0),
     "buildings": [("bld_cafe.png", 100, 236, 104), ("bld_radiotower.png", 240, 260, 150),
                   ("bld_archive.png", 372, 240, 104), ("bld_pond.png", 452, 300, 58)]},
    {"name": "火山口食堂", "sub": "大飞 · 灶火常年不熄", "char": "char_mug.png",
     "accent": (200, 120, 180),
     "buildings": blds3("bld_market.png", "bld_kitchen.png", "bld_stage.png", 112, 150, 116)},
    {"name": "玩具复活站", "sub": "琪琪 · 旧物的第二次生命", "char": "char_plush.png",
     "accent": (0, 112, 243),
     "buildings": blds3("bld_museum.png", "bld_workshop.png", "bld_treehouse.png", 116, 146, 120)},
]

# 装饰（所有世界共用一套散布）
DECOS_BACK = [("dec_tree.png", 60, 320, 74), ("dec_tree.png", 476, 330, 70)]
DECOS_FRONT = [("dec_bush.png", 195, 340, 44), ("dec_flowers.png", 355, 338, 32),
               ("dec_lamppost.png", 458, 150, 66)]

# 角色环形走动路径（场景坐标，闭环）——前景开阔带，各世界建筑都避开
PATH = [
    (140, 296), (225, 318), (312, 312), (382, 290),
    (410, 260), (352, 248), (285, 264), (210, 258),
    (150, 270), (120, 292),
]

# ----------------------------------------------------------------- 工具
def paste_sprite(canvas, path, cx, by, target_h):
    im = Image.open(os.path.join(SPR, path)).convert("RGBA")
    s = target_h / im.height
    im = im.resize((max(1, round(im.width * s)), target_h), Image.LANCZOS)
    canvas.alpha_composite(im, (int(cx - im.width / 2), int(by - im.height)))

def draw_ground(d):
    d.rounded_rectangle([16, 64, SCENE_W - 16, SCENE_H - 14], radius=26,
                        fill=(188, 214, 164, 130))
    for i in range(6):
        y = 88 + i * 44
        d.line([(28, y), (SCENE_W - 28, y)], fill=(106, 152, 40, 70), width=1)

def draw_title(canvas, name, sub, accent):
    d = ImageDraw.Draw(canvas)
    try:
        f1 = ImageFont.truetype(CN_FONT, 30)
        f2 = ImageFont.truetype(CN_FONT, 15)
    except Exception:
        f1 = ImageFont.load_default(); f2 = f1
    # 纸卡宽度按标题字数自适应
    tw = max(200, 30 + len(name) * 30 + 20, 30 + int(len(sub) * 8.2) + 20)
    tw = min(tw, SCENE_W - 32)
    d.rounded_rectangle([16, 14, 16 + tw, 62], radius=12,
                        fill=(250, 246, 239, 236), outline=accent + (255,), width=2)
    d.text((30, 18), name, font=f1, fill=(28, 25, 17))
    d.text((31, 46), sub, font=f2, fill=(107, 101, 88))

# ----------------------------------------------------------------- C 数组
def rgb565_bytes(img):
    px = img.load(); w, h = img.size
    out = bytearray(w * h * 2); i = 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            v = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
            out[i] = v & 0xFF; out[i + 1] = (v >> 8) & 0xFF; i += 2
    return out

def argb8888_bytes(img):
    img = img.convert("RGBA"); px = img.load(); w, h = img.size
    out = bytearray(w * h * 4); i = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            out[i] = b; out[i+1] = g; out[i+2] = r; out[i+3] = a; i += 4
    return out

def emit_arr(f, name, data):
    f.write(f"const uint8_t {name}[{len(data)}] = {{\n")
    line = []
    for byte in data:
        line.append(f"0x{byte:02x},")
        if len(line) == 20:
            f.write("".join(line) + "\n"); line = []
    if line:
        f.write("".join(line) + "\n")
    f.write("};\n\n")

def emit_dsc(f, dsc, arr, cf, w, h, stride):
    f.write(f"const lv_image_dsc_t {dsc} = {{\n")
    f.write(f"    .header = {{ .magic = LV_IMAGE_HEADER_MAGIC, .cf = {cf},\n")
    f.write(f"                .w = {w}, .h = {h}, .stride = {stride} }},\n")
    f.write(f"    .data = {arr}, .data_size = sizeof({arr}),\n}};\n\n")

# ----------------------------------------------------------------- main
def main():
    os.makedirs(SRC, exist_ok=True); os.makedirs(INC, exist_ok=True)
    N = len(WORLDS)

    # ---------- 1) 6 张场景 ----------
    print(f"[1/3] 合成 {N} 个世界场景 @ {SCENE_W}x{SCENE_H} ...")
    scene_c = open(os.path.join(SRC, "forkworld_scene.c"), "w")
    scene_c.write('/* AUTO-GENERATED by tools/gen_forkworld_assets.py */\n#include "forkworld_scene.h"\n\n')
    total = 0
    _previews = []
    for wi, W in enumerate(WORLDS):
        scene = Image.new("RGBA", (SCENE_W, SCENE_H), (245, 240, 232, 255))
        draw_ground(ImageDraw.Draw(scene))
        for path, cx, by, h in DECOS_BACK:
            paste_sprite(scene, path, cx, by, h)
        for path, cx, by, h in sorted(W["buildings"], key=lambda b: b[2]):
            paste_sprite(scene, path, cx, by, h)
        for path, cx, by, h in DECOS_FRONT:
            paste_sprite(scene, path, cx, by, h)
        draw_title(scene, W["name"], W["sub"], W["accent"])
        rgb = scene.convert("RGB")
        _previews.append(rgb)
        if wi == 0:
            rgb.save(os.path.join(FW, "forkworld_scene_preview.png"))
        data = rgb565_bytes(rgb)
        total += len(data)
        emit_arr(scene_c, f"fw_scene{wi}_data", data)
        emit_dsc(scene_c, f"fw_scene{wi}_dsc", f"fw_scene{wi}_data",
                 "LV_COLOR_FORMAT_RGB565", SCENE_W, SCENE_H, SCENE_W * 2)
        print(f"      [{wi}] {W['name']}  {len(data)//1024}KB")
    scene_c.write(f"const lv_image_dsc_t *fw_scene[FW_WORLD_N] = {{\n    ")
    scene_c.write(", ".join(f"&fw_scene{i}_dsc" for i in range(N)))
    scene_c.write("\n};\n")
    scene_c.close()
    with open(os.path.join(INC, "forkworld_scene.h"), "w") as f:
        f.write('#ifndef __FW_SCENE_H__\n#define __FW_SCENE_H__\n#include "lvgl.h"\n\n')
        f.write(f"#define FW_SCENE_W  {SCENE_W}\n#define FW_SCENE_H  {SCENE_H}\n")
        f.write(f"#define FW_WORLD_N  {N}\n")
        f.write("extern const lv_image_dsc_t *fw_scene[FW_WORLD_N];\n#endif\n")
    # 6 世界拼图（供核验，非固件用）：2 列 x 3 行，每张缩半
    mw, mh = SCENE_W // 2, SCENE_H // 2
    montage = Image.new("RGB", (mw * 2 + 12, mh * 3 + 16), (30, 30, 30))
    for i, im in enumerate(_previews):
        thumb = im.resize((mw, mh), Image.LANCZOS)
        montage.paste(thumb, ((i % 2) * (mw + 4) + 4, (i // 2) * (mh + 4) + 4))
    montage.save(os.path.join(FW, "forkworld_all6_montage.png"))
    print(f"      场景合计 {total//1024}KB  拼图: forkworld_all6_montage.png")

    # ---------- 2) 6 个角色（右/左朝向）----------
    print(f"[2/3] 烘焙 {N} 个角色 @ {CHAR_H}px 高 ...")
    char_c = open(os.path.join(SRC, "forkworld_char.c"), "w")
    char_c.write('/* AUTO-GENERATED by tools/gen_forkworld_assets.py */\n#include "forkworld_char.h"\n\n')
    widths = []
    for wi, W in enumerate(WORLDS):
        ch = Image.open(os.path.join(SPR, W["char"])).convert("RGBA")
        s = CHAR_H / ch.height
        ch = ch.resize((max(1, round(ch.width * s)), CHAR_H), Image.LANCZOS)
        cw = ch.size[0]; widths.append(cw)
        emit_arr(char_c, f"fw_char{wi}_r_data", argb8888_bytes(ch))
        emit_dsc(char_c, f"fw_char{wi}_r_dsc", f"fw_char{wi}_r_data",
                 "LV_COLOR_FORMAT_ARGB8888", cw, CHAR_H, cw * 4)
        chl = ch.transpose(Image.FLIP_LEFT_RIGHT)
        emit_arr(char_c, f"fw_char{wi}_l_data", argb8888_bytes(chl))
        emit_dsc(char_c, f"fw_char{wi}_l_dsc", f"fw_char{wi}_l_data",
                 "LV_COLOR_FORMAT_ARGB8888", cw, CHAR_H, cw * 4)
    char_c.write("const lv_image_dsc_t *fw_char_r[FW_WORLD_N] = {\n    ")
    char_c.write(", ".join(f"&fw_char{i}_r_dsc" for i in range(N)))
    char_c.write("\n};\n")
    char_c.write("const lv_image_dsc_t *fw_char_l[FW_WORLD_N] = {\n    ")
    char_c.write(", ".join(f"&fw_char{i}_l_dsc" for i in range(N)))
    char_c.write("\n};\n")
    char_c.write(f"const int16_t fw_char_w[FW_WORLD_N] = {{ {','.join(str(w) for w in widths)} }};\n")
    char_c.close()
    with open(os.path.join(INC, "forkworld_char.h"), "w") as f:
        f.write('#ifndef __FW_CHAR_H__\n#define __FW_CHAR_H__\n#include "lvgl.h"\n#include "forkworld_scene.h"\n\n')
        f.write(f"#define FW_CHAR_H  {CHAR_H}\n")
        f.write("extern const lv_image_dsc_t *fw_char_r[FW_WORLD_N];\n")
        f.write("extern const lv_image_dsc_t *fw_char_l[FW_WORLD_N];\n")
        f.write("extern const int16_t fw_char_w[FW_WORLD_N];\n#endif\n")

    # ---------- 3) 共享路径 ----------
    print("[3/3] 写入走动路径 ...")
    n = len(PATH)
    with open(os.path.join(SRC, "forkworld_track.c"), "w") as f:
        f.write('/* AUTO-GENERATED by tools/gen_forkworld_assets.py */\n#include "forkworld_track.h"\n\n')
        f.write(f"const int16_t fw_path_x[FW_PATH_N] = {{ {','.join(str(p[0]) for p in PATH)} }};\n")
        f.write(f"const int16_t fw_path_y[FW_PATH_N] = {{ {','.join(str(p[1]) for p in PATH)} }};\n")
    with open(os.path.join(INC, "forkworld_track.h"), "w") as f:
        f.write('#ifndef __FW_TRACK_H__\n#define __FW_TRACK_H__\n#include <stdint.h>\n\n')
        f.write(f"#define FW_PATH_N   {n}\n#define FW_STEP_MS  {STEP_MS}\n")
        f.write("extern const int16_t fw_path_x[FW_PATH_N];\n")
        f.write("extern const int16_t fw_path_y[FW_PATH_N];\n#endif\n")

    print(f"完成。{N} 世界 · 场景合计 {total//1024}KB · 角色宽 {widths} · 路径 {n} 点")
    print(f"预览(世界0): {FW}/forkworld_scene_preview.png")


if __name__ == "__main__":
    main()
