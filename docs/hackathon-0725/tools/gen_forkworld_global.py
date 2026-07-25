#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_forkworld_global.py —— ForkWorld「板载原生前端·全局环形大地图」资产管线（T5AI）。

高度复刻网页 global.html：6 个世界六边形环绕中心广场 + 放射道路 + 世界名牌 +
灵魂连线，全部烘焙成一张大地图位图（RGB565）。角色走动 + 巡航相机由固件动态渲染。

产物（写进 examples/multimedia/forkworld_native/）：
  1. src/forkworld_scene.c + include/forkworld_scene.h —— 大地图 fw_map_dsc + FW_MAP_W/H
  2. src/forkworld_char.c  + include/forkworld_char.h  —— 6 角色 fw_char_r/l[6] + 宽度
  3. src/forkworld_track.c + include/forkworld_track.h —— 每世界 anchor(地图px) + 走动环 + 巡航顺序

布局数据直接读自网页同一份 worlds.json，保证与网页全局图一致。
用法：python3 gen_forkworld_global.py
"""
import os, json, math
from PIL import Image, ImageDraw, ImageFont

FWROOT = "/Users/mychanging/Desktop/AdventureX/generative_agents/environment/frontend_server/static_dirs/forkworld"
SPR = os.path.join(FWROOT, "assets/sprites")
WORLDS_JSON = os.path.join(FWROOT, "data/worlds.json")
FW = "/Users/mychanging/Desktop/AdventureX/TuyaOpen/examples/multimedia/forkworld_native"
SRC, INC = os.path.join(FW, "src"), os.path.join(FW, "include")
CN_FONT = "/System/Library/Fonts/STHeiti Medium.ttc"

PXPT = 13                      # 每 tile 像素（14→13 为触屏详情卡腾 flash）
MARGIN = 6                     # 地图四周留白(tile)
CHAR_H = 46                    # 角色高度(px)
LOOP_N = 8                     # 每个世界的走动环点数
STEP_MS = 640

# 建筑类型 → 显示高度(px) 与 素材
BLD = {
    "lab": ("bld_lab.png", 104), "shelf": ("bld_shelf.png", 96), "statue": ("bld_statue.png", 82),
    "greenhouse": ("bld_greenhouse.png", 104), "studio": ("bld_studio.png", 92), "market": ("bld_market.png", 92),
    "archive": ("bld_archive.png", 88), "mountain": ("bld_mountain.png", 104), "library": ("bld_library.png", 92),
    "radio_tower": ("bld_radiotower.png", 112), "cafe": ("bld_cafe.png", 84), "pond": ("bld_pond.png", 50),
    "kitchen": ("bld_kitchen.png", 104), "stage": ("bld_stage.png", 92),
    "workshop": ("bld_workshop.png", 92), "museum": ("bld_museum.png", 96), "treehouse": ("bld_treehouse.png", 104),
}
CHAR_SPRITE = {"lamp": "char_lamp.png", "book": "char_book.png", "headphones": "char_headphones.png",
               "mic": "char_mic.png", "mug": "char_mug.png", "plush": "char_plush.png"}
ACCENTS = [(232,99,74),(74,127,165),(107,158,122),(212,168,0),(200,120,180),(0,112,243)]

# ----------------------------------------------------------------- 加载布局
REG = json.load(open(WORLDS_JSON))
WORLDS = REG["worlds"]
VISITS = REG.get("visits", [])
byid = {w["world_id"]: i for i, w in enumerate(WORLDS)}

allx = [b for w in WORLDS for b in (w["region"]["bounds"][0], w["region"]["bounds"][2])]
ally = [b for w in WORLDS for b in (w["region"]["bounds"][1], w["region"]["bounds"][3])]
MINX, MAXX = min(allx) - MARGIN, max(allx) + MARGIN
MINY, MAXY = min(ally) - MARGIN, max(ally) + MARGIN
MAP_W = (MAXX - MINX) * PXPT
MAP_H = (MAXY - MINY) * PXPT

def X(tx): return int((tx - MINX) * PXPT)
def Y(ty): return int((ty - MINY) * PXPT)
CX, CY = X(70), Y(50)   # 中心广场

# ----------------------------------------------------------------- 绘制
def paste_sprite(canvas, name, cx, by, target_h):
    im = Image.open(os.path.join(SPR, name)).convert("RGBA")
    s = target_h / im.height
    im = im.resize((max(1, round(im.width * s)), target_h), Image.LANCZOS)
    canvas.alpha_composite(im, (int(cx - im.width / 2), int(by - im.height)))

def draw_paper_decos(base):
    d = ImageDraw.Draw(base)
    import hashlib
    # 稳定伪随机散布花草（不依赖 random，保证可复现）
    def h(i, s): return int(hashlib.md5(f"{i}{s}".encode()).hexdigest(), 16)
    for i in range(90):
        x = h(i, "x") % MAP_W; y = h(i, "y") % MAP_H
        if abs(x - CX) < 130 and abs(y - CY) < 130:
            continue
        if h(i, "t") % 3 == 0:  # 小花
            for a in range(0, 360, 60):
                rad = math.radians(a)
                d.ellipse([x+math.cos(rad)*5-2, y+math.sin(rad)*4-1.5,
                           x+math.cos(rad)*5+2, y+math.sin(rad)*4+1.5], outline=(28,25,17,90))
        else:  # 草丛
            for dx in (-5, 0, 5):
                d.line([(x+dx, y), (x+dx*1.4, y-9)], fill=(28,25,17,60), width=1)

def draw_roads(base):
    d = ImageDraw.Draw(base, "RGBA")
    # 中心广场
    d.ellipse([CX-72, CY-72, CX+72, CY+72], fill=(200,194,180,255), outline=(28,25,17,45), width=2)
    d.ellipse([CX-54, CY-54, CX+54, CY+54], outline=(255,255,255,110), width=2)
    for w in WORLDS:
        ax, ay = X(w["region"]["anchor"][0]), Y(w["region"]["anchor"][1])
        dist = math.hypot(ax-CX, ay-CY); n = max(14, int(dist/40))
        nx, ny = -(ay-CY)/dist, (ax-CX)/dist
        pts = []
        for i in range(n+1):
            t = i/n
            wob = math.sin(t*math.pi*2.2)*20*math.sin(t*math.pi)
            pts.append((CX+(ax-CX)*t+nx*wob, CY+(ay-CY)*t+ny*wob))
        d.line(pts, fill=(200,194,180,255), width=26, joint="curve")
        for i in range(0, len(pts)-1, 2):
            d.line([pts[i], pts[i+1]], fill=(255,255,255,120), width=2)

def draw_region(base, w, accent):
    d = ImageDraw.Draw(base, "RGBA")
    x0,y0,x1,y1 = w["region"]["bounds"]
    rx0,ry0,rx1,ry1 = X(x0),Y(y0),X(x1),Y(y1)
    d.rounded_rectangle([rx0,ry0,rx1,ry1], radius=20, fill=(184,212,160,120))
    waves = max(4, (ry1-ry0)//30)
    for i in range(waves):
        yy = ry0 + (i+0.5)*(ry1-ry0)/waves
        d.line([(rx0+8,yy),(rx1-8,yy)], fill=(106,152,40,70), width=1)
    d.rounded_rectangle([rx0,ry0,rx1,ry1], radius=20, outline=accent+(180,), width=3)

def draw_buildings(base, w):
    slots = {lm["slot"]: lm["type"] for lm in w["world"]["landmarks"]}
    items = []
    for slot, typ in slots.items():
        t = w["slot_tiles"][str(slot)]
        name, h = BLD.get(typ, ("bld_statue.png", 84))
        items.append((Y(t[1]), name, X(t[0]), Y(t[1])+8, h))
    for _, name, cx, by, h in sorted(items):  # 按 y 深度排序
        paste_sprite(base, name, cx, by, h)

def draw_plate(base, w, accent):
    d = ImageDraw.Draw(base)
    try:
        f1 = ImageFont.truetype(CN_FONT, 26); f2 = ImageFont.truetype(CN_FONT, 15)
    except Exception:
        f1 = ImageFont.load_default(); f2 = f1
    name = w["world"]["world_name"]; sub = f"{w['owner']}"
    x0,y0,x1,_ = w["region"]["bounds"]
    px = (X(x0)+X(x1))//2
    py = Y(y0) - 46
    tw = max(120, len(name)*27+24)
    d.rounded_rectangle([px-tw//2, py, px+tw//2, py+42], radius=11,
                        fill=(250,246,239,240), outline=accent+(255,), width=2)
    d.text((px-tw//2+12, py+5), name, font=f1, fill=(28,25,17))
    d.text((px-tw//2+12, py+30), sub, font=f2, fill=(107,101,88))

def draw_beams(base):
    d = ImageDraw.Draw(base, "RGBA")
    try:
        ff = ImageFont.truetype(CN_FONT, 18)
    except Exception:
        ff = ImageFont.load_default()
    for v in VISITS:
        a, b = byid.get(v["from"]), byid.get(v["to"])
        if a is None or b is None: continue
        ax,ay = X(WORLDS[a]["region"]["anchor"][0]), Y(WORLDS[a]["region"]["anchor"][1])
        bx,by = X(WORLDS[b]["region"]["anchor"][0]), Y(WORLDS[b]["region"]["anchor"][1])
        col = v["resonance"]["hardware_feedback"]["led_rgb"].lstrip("#")
        rgb = tuple(int(col[i:i+2],16) for i in (0,2,4))
        lw = 4 + v["resonance"]["score"]//30
        d.line([(ax,ay),(bx,by)], fill=rgb+(180,), width=lw)
        mx,my = (ax+bx)//2, (ay+by)//2
        d.rounded_rectangle([mx-28,my-14,mx+28,my+14], radius=8, fill=(28,25,17,205))
        # 手绘小红心（emoji 在黑体缺字形，改画）
        hx, hy = mx-18, my
        d.pieslice([hx-8,hy-8,hx,hy], 180, 360, fill=rgb)
        d.pieslice([hx,hy-8,hx+8,hy], 180, 360, fill=rgb)
        d.polygon([(hx-8,hy-3),(hx+8,hy-3),(hx,hy+8)], fill=rgb)
        d.text((mx-8,my-11), str(v['resonance']['score']), font=ff, fill=rgb)

# ----------------------------------------------------------------- C 数组
def rgb565_bytes(img):
    px = img.load(); w,h = img.size
    out = bytearray(w*h*2); i=0
    for y in range(h):
        for x in range(w):
            r,g,b = px[x,y][:3]
            v = ((r&0xF8)<<8)|((g&0xFC)<<3)|(b>>3)
            out[i]=v&0xFF; out[i+1]=(v>>8)&0xFF; i+=2
    return out

def argb8888_bytes(img):
    img=img.convert("RGBA"); px=img.load(); w,h=img.size
    out=bytearray(w*h*4); i=0
    for y in range(h):
        for x in range(w):
            r,g,b,a=px[x,y]; out[i]=b;out[i+1]=g;out[i+2]=r;out[i+3]=a; i+=4
    return out

def emit_arr(f,name,data):
    f.write(f"const uint8_t {name}[{len(data)}] = {{\n")
    line=[]
    for byte in data:
        line.append(f"0x{byte:02x},")
        if len(line)==20: f.write("".join(line)+"\n"); line=[]
    if line: f.write("".join(line)+"\n")
    f.write("};\n\n")

def emit_dsc(f,dsc,arr,cf,w,h,stride):
    f.write(f"const lv_image_dsc_t {dsc} = {{\n")
    f.write(f"    .header = {{ .magic = LV_IMAGE_HEADER_MAGIC, .cf = {cf},\n")
    f.write(f"                .w = {w}, .h = {h}, .stride = {stride} }},\n")
    f.write(f"    .data = {arr}, .data_size = sizeof({arr}),\n}};\n\n")

# ----------------------------------------------------------------- main
def main():
    os.makedirs(SRC, exist_ok=True); os.makedirs(INC, exist_ok=True)
    N = len(WORLDS)
    print(f"[1/3] 渲染全局环形大地图 {MAP_W}x{MAP_H} ({N} 世界) ...")

    base = Image.new("RGBA", (MAP_W, MAP_H), (245,240,232,255))
    draw_paper_decos(base)
    draw_roads(base)
    for wi, w in enumerate(WORLDS):
        draw_region(base, w, ACCENTS[wi % len(ACCENTS)])
    for wi, w in enumerate(WORLDS):
        draw_buildings(base, w)
    draw_beams(base)
    for wi, w in enumerate(WORLDS):
        draw_plate(base, w, ACCENTS[wi % len(ACCENTS)])

    rgb = base.convert("RGB")
    rgb.save(os.path.join(FW, "forkworld_global_preview.png"))
    data = rgb565_bytes(rgb)
    print(f"      地图 RGB565 = {len(data)//1024}KB")
    with open(os.path.join(SRC, "forkworld_scene.c"), "w") as f:
        f.write('/* AUTO-GENERATED by tools/gen_forkworld_global.py */\n#include "forkworld_scene.h"\n\n')
        emit_arr(f, "fw_map_data", data)
        emit_dsc(f, "fw_map_dsc", "fw_map_data", "LV_COLOR_FORMAT_RGB565", MAP_W, MAP_H, MAP_W*2)
    with open(os.path.join(INC, "forkworld_scene.h"), "w") as f:
        f.write('#ifndef __FW_SCENE_H__\n#define __FW_SCENE_H__\n#include "lvgl.h"\n\n')
        f.write(f"#define FW_MAP_W  {MAP_W}\n#define FW_MAP_H  {MAP_H}\n#define FW_WORLD_N {N}\n")
        f.write("extern const lv_image_dsc_t fw_map_dsc;\n#endif\n")

    # 角色
    print(f"[2/3] 烘焙 {N} 角色 @ {CHAR_H}px ...")
    cc = open(os.path.join(SRC, "forkworld_char.c"), "w")
    cc.write('/* AUTO-GENERATED by tools/gen_forkworld_global.py */\n#include "forkworld_char.h"\n\n')
    widths=[]
    for wi, w in enumerate(WORLDS):
        ch = Image.open(os.path.join(SPR, CHAR_SPRITE[w["agent_kind"]])).convert("RGBA")
        s = CHAR_H/ch.height; ch = ch.resize((max(1,round(ch.width*s)), CHAR_H), Image.LANCZOS)
        cw = ch.size[0]; widths.append(cw)
        emit_arr(cc, f"fw_c{wi}r", argb8888_bytes(ch)); emit_dsc(cc, f"fw_c{wi}r_dsc", f"fw_c{wi}r", "LV_COLOR_FORMAT_ARGB8888", cw, CHAR_H, cw*4)
        chl = ch.transpose(Image.FLIP_LEFT_RIGHT)
        emit_arr(cc, f"fw_c{wi}l", argb8888_bytes(chl)); emit_dsc(cc, f"fw_c{wi}l_dsc", f"fw_c{wi}l", "LV_COLOR_FORMAT_ARGB8888", cw, CHAR_H, cw*4)
    cc.write("const lv_image_dsc_t *fw_char_r[FW_WORLD_N] = {" + ",".join(f"&fw_c{i}r_dsc" for i in range(N)) + "};\n")
    cc.write("const lv_image_dsc_t *fw_char_l[FW_WORLD_N] = {" + ",".join(f"&fw_c{i}l_dsc" for i in range(N)) + "};\n")
    cc.write("const int16_t fw_char_w[FW_WORLD_N] = {" + ",".join(str(x) for x in widths) + "};\n")
    cc.close()
    with open(os.path.join(INC, "forkworld_char.h"), "w") as f:
        f.write('#ifndef __FW_CHAR_H__\n#define __FW_CHAR_H__\n#include "lvgl.h"\n#include "forkworld_scene.h"\n\n')
        f.write(f"#define FW_CHAR_H  {CHAR_H}\n")
        f.write("extern const lv_image_dsc_t *fw_char_r[FW_WORLD_N];\n")
        f.write("extern const lv_image_dsc_t *fw_char_l[FW_WORLD_N];\n")
        f.write("extern const int16_t fw_char_w[FW_WORLD_N];\n#endif\n")

    # 每世界 anchor(地图px) + 走动环 + 巡航顺序
    print("[3/3] 写世界表(anchor/走动环/巡航) ...")
    anchors = [(X(w["region"]["anchor"][0]), Y(w["region"]["anchor"][1])) for w in WORLDS]
    loops_x = []; loops_y = []
    for wi, w in enumerate(WORLDS):
        ax, ay = anchors[wi]
        x0,y0,x1,y1 = w["region"]["bounds"]
        rw = (X(x1)-X(x0)); rh = (Y(y1)-Y(y0))
        cxp, cyp = ax, Y(y1) - int(rh*0.28)     # 环中心偏下（前景走动）
        rxr, ryr = int(rw*0.32), int(rh*0.22)
        lx=[]; ly=[]
        for k in range(LOOP_N):
            a = 2*math.pi*k/LOOP_N
            lx.append(int(cxp + math.cos(a)*rxr)); ly.append(int(cyp + math.sin(a)*ryr))
        loops_x.append(lx); loops_y.append(ly)
    # 巡航顺序：按环形相邻（上→右上→右下→下→左下→左上）
    order = list(range(N))
    # 互访数据（用于固件演出：使者跨世界旅行 + 连线脉动）
    vis = []
    for v in VISITS:
        a, b = byid.get(v["from"]), byid.get(v["to"])
        if a is None or b is None: continue
        col = v["resonance"]["hardware_feedback"]["led_rgb"].lstrip("#")
        rgb = int(col, 16)
        vis.append((a, b, v["resonance"]["score"], rgb))
    with open(os.path.join(SRC, "forkworld_track.c"), "w") as f:
        f.write('/* AUTO-GENERATED by tools/gen_forkworld_global.py */\n#include "forkworld_track.h"\n\n')
        f.write("const int16_t fw_anchor_x[FW_WORLD_N] = {" + ",".join(str(a[0]) for a in anchors) + "};\n")
        f.write("const int16_t fw_anchor_y[FW_WORLD_N] = {" + ",".join(str(a[1]) for a in anchors) + "};\n")
        f.write("const int16_t fw_loop_x[FW_WORLD_N][FW_LOOP_N] = {\n")
        for lx in loops_x: f.write("  {" + ",".join(str(v) for v in lx) + "},\n")
        f.write("};\n")
        f.write("const int16_t fw_loop_y[FW_WORLD_N][FW_LOOP_N] = {\n")
        for ly in loops_y: f.write("  {" + ",".join(str(v) for v in ly) + "},\n")
        f.write("};\n")
        f.write("const int16_t fw_cruise[FW_WORLD_N] = {" + ",".join(str(o) for o in order) + "};\n")
        # 世界区域矩形（地图px）——触屏命中检测
        f.write("const int16_t fw_region_x0[FW_WORLD_N] = {" + ",".join(str(X(w['region']['bounds'][0])) for w in WORLDS) + "};\n")
        f.write("const int16_t fw_region_y0[FW_WORLD_N] = {" + ",".join(str(Y(w['region']['bounds'][1])) for w in WORLDS) + "};\n")
        f.write("const int16_t fw_region_x1[FW_WORLD_N] = {" + ",".join(str(X(w['region']['bounds'][2])) for w in WORLDS) + "};\n")
        f.write("const int16_t fw_region_y1[FW_WORLD_N] = {" + ",".join(str(Y(w['region']['bounds'][3])) for w in WORLDS) + "};\n\n")
        f.write("const int16_t fw_visit_from[FW_VISIT_N]  = {" + ",".join(str(v[0]) for v in vis) + "};\n")
        f.write("const int16_t fw_visit_to[FW_VISIT_N]    = {" + ",".join(str(v[1]) for v in vis) + "};\n")
        f.write("const int16_t fw_visit_score[FW_VISIT_N] = {" + ",".join(str(v[2]) for v in vis) + "};\n")
        f.write("const uint32_t fw_visit_rgb[FW_VISIT_N]  = {" + ",".join(f"0x{v[3]:06X}" for v in vis) + "};\n")
    with open(os.path.join(INC, "forkworld_track.h"), "w") as f:
        f.write('#ifndef __FW_TRACK_H__\n#define __FW_TRACK_H__\n#include <stdint.h>\n#include "forkworld_scene.h"\n\n')
        f.write(f"#define FW_LOOP_N   {LOOP_N}\n#define FW_STEP_MS  {STEP_MS}\n")
        f.write(f"#define FW_VISIT_N  {len(vis)}\n")
        f.write("extern const int16_t fw_anchor_x[FW_WORLD_N];\n")
        f.write("extern const int16_t fw_anchor_y[FW_WORLD_N];\n")
        f.write("extern const int16_t fw_loop_x[FW_WORLD_N][FW_LOOP_N];\n")
        f.write("extern const int16_t fw_loop_y[FW_WORLD_N][FW_LOOP_N];\n")
        f.write("extern const int16_t fw_cruise[FW_WORLD_N];\n")
        f.write("extern const int16_t fw_region_x0[FW_WORLD_N];\n")
        f.write("extern const int16_t fw_region_y0[FW_WORLD_N];\n")
        f.write("extern const int16_t fw_region_x1[FW_WORLD_N];\n")
        f.write("extern const int16_t fw_region_y1[FW_WORLD_N];\n")
        f.write("extern const int16_t fw_visit_from[FW_VISIT_N];\n")
        f.write("extern const int16_t fw_visit_to[FW_VISIT_N];\n")
        f.write("extern const int16_t fw_visit_score[FW_VISIT_N];\n")
        f.write("extern const uint32_t fw_visit_rgb[FW_VISIT_N];\n#endif\n")

    # ---------- 4) 互访台词气泡 ----------
    print("[4/4] 烘焙互访台词气泡 ...")
    def bake_bubble(text):
        try: f = ImageFont.truetype(CN_FONT, 16)
        except Exception: f = ImageFont.load_default()
        tmp = ImageDraw.Draw(Image.new("RGBA", (4, 4)))
        bb = tmp.textbbox((0, 0), text, font=f)
        tw, th = bb[2]-bb[0], bb[3]-bb[1]
        padx, pady, tail = 10, 6, 7
        W, H = tw + padx*2, th + pady*2 + tail
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rounded_rectangle([0, 0, W-1, H-tail-1], radius=8, fill=(255,255,255,247), outline=(28,25,17,255), width=2)
        cx = W//2
        d.polygon([(cx-6, H-tail-1), (cx+6, H-tail-1), (cx, H-1)], fill=(255,255,255,247))
        d.line([(cx-6, H-tail-1), (cx, H-1)], fill=(28,25,17,255), width=2)
        d.line([(cx+6, H-tail-1), (cx, H-1)], fill=(28,25,17,255), width=2)
        d.text((padx-bb[0], pady-bb[1]), text, font=f, fill=(28,25,17))
        return im

    bc = open(os.path.join(SRC, "forkworld_bubble.c"), "w")
    bc.write('/* AUTO-GENERATED by tools/gen_forkworld_global.py */\n#include "forkworld_bubble.h"\n\n')
    dsc_names, bub_mx, bub_my, v_start, v_cnt = [], [], [], [], []
    gi = 0
    for v in VISITS:
        a, b = byid.get(v["from"]), byid.get(v["to"])
        if a is None or b is None:
            continue
        B = WORLDS[b]
        v_start.append(gi); cnt = 0
        for bub in v.get("bubbles", []):
            tile = B["slot_tiles"].get(str(bub["slot"]))
            if not tile:
                continue
            im = bake_bubble(bub["text"])
            w, h = im.size
            emit_arr(bc, f"bub{gi}", argb8888_bytes(im))
            emit_dsc(bc, f"bub{gi}_dsc", f"bub{gi}", "LV_COLOR_FORMAT_ARGB8888", w, h, w*4)
            dsc_names.append(f"&bub{gi}_dsc")
            bub_mx.append(X(tile[0])); bub_my.append(Y(tile[1]) + 44)
            gi += 1; cnt += 1
        v_cnt.append(cnt)
    NB = gi
    bc.write(f"const lv_image_dsc_t *fw_bub[FW_BUB_N] = {{ {','.join(dsc_names)} }};\n")
    bc.write(f"const int16_t fw_bub_mx[FW_BUB_N] = {{ {','.join(str(x) for x in bub_mx)} }};\n")
    bc.write(f"const int16_t fw_bub_my[FW_BUB_N] = {{ {','.join(str(y) for y in bub_my)} }};\n")
    bc.write(f"const int16_t fw_visit_bub0[FW_VISIT_N] = {{ {','.join(str(x) for x in v_start)} }};\n")
    bc.write(f"const int16_t fw_visit_bubn[FW_VISIT_N] = {{ {','.join(str(x) for x in v_cnt)} }};\n")
    bc.close()
    with open(os.path.join(INC, "forkworld_bubble.h"), "w") as f:
        f.write('#ifndef __FW_BUBBLE_H__\n#define __FW_BUBBLE_H__\n#include "lvgl.h"\n#include "forkworld_track.h"\n\n')
        f.write(f"#define FW_BUB_N  {NB}\n")
        f.write("extern const lv_image_dsc_t *fw_bub[FW_BUB_N];\n")
        f.write("extern const int16_t fw_bub_mx[FW_BUB_N];\n")
        f.write("extern const int16_t fw_bub_my[FW_BUB_N];\n")
        f.write("extern const int16_t fw_visit_bub0[FW_VISIT_N];\n")
        f.write("extern const int16_t fw_visit_bubn[FW_VISIT_N];\n#endif\n")

    # ---------- 5) 触屏世界详情卡 ----------
    print(f"[5/5] 烘焙 {N} 张世界详情卡 ...")
    CARDW = 252
    def bake_detail(w, accent):
        try:
            fT = ImageFont.truetype(CN_FONT, 22); fM = ImageFont.truetype(CN_FONT, 13)
            fB = ImageFont.truetype(CN_FONT, 15); fL = ImageFont.truetype(CN_FONT, 12)
        except Exception:
            fT = fM = fB = fL = ImageFont.load_default()
        wd = w["world"]; lms = wd["landmarks"]; res = wd.get("residents", [])
        pad = 14; y = pad
        rows = []  # (font, color, text, indent)
        rows.append((fT, accent, wd["world_name"], 0));
        rows.append((fM, (107,101,88), f"{w['owner']} · {wd['climate']}", 0))
        rows.append((fM, (60,56,48), wd["temperament"], 0))
        rows.append(("hr", accent, "", 0))
        rows.append((fL, (150,120,60), "地标", 0))
        for lm in lms: rows.append((fB, (28,25,17), lm["name"], 1))
        if res:
            rows.append((fL, (150,120,60), "住民", 0))
            for r in res: rows.append((fB, (28,25,17), r["name"], 1))
        # 逐行量高
        heights = []
        for font, col, txt, ind in rows:
            if font == "hr": heights.append(12); continue
            bb = ImageDraw.Draw(Image.new("RGBA",(4,4))).textbbox((0,0), txt, font=font)
            heights.append((bb[3]-bb[1]) + (10 if font is fT else 7))
        H = pad*2 + sum(heights)
        im = Image.new("RGB", (CARDW, H), (250,246,239)); d = ImageDraw.Draw(im)
        d.rectangle([0,0,CARDW-1,H-1], outline=accent, width=3)
        d.rectangle([2,2,CARDW-3,H-3], outline=(28,25,17), width=1)
        y = pad
        for (font, col, txt, ind), hh in zip(rows, heights):
            if font == "hr":
                d.line([(pad, y+5),(CARDW-pad, y+5)], fill=(210,204,190), width=1); y += hh; continue
            if ind:  # 地标/住民 项：前面画个 accent 圆点
                d.ellipse([pad+2, y+6, pad+8, y+12], fill=accent)
                d.text((pad+16, y), txt, font=font, fill=col)
            else:
                d.text((pad, y), txt, font=font, fill=col)
            y += hh
        return im

    dc = open(os.path.join(SRC, "forkworld_detail.c"), "w")
    dc.write('/* AUTO-GENERATED by tools/gen_forkworld_global.py */\n#include "forkworld_detail.h"\n\n')
    dnames, dtot = [], 0
    for wi, w in enumerate(WORLDS):
        card = bake_detail(w, ACCENTS[wi % len(ACCENTS)])
        cw, chh = card.size
        d565 = rgb565_bytes(card); dtot += len(d565)
        emit_arr(dc, f"fw_det{wi}", d565)
        emit_dsc(dc, f"fw_det{wi}_dsc", f"fw_det{wi}", "LV_COLOR_FORMAT_RGB565", cw, chh, cw*2)
        dnames.append(f"&fw_det{wi}_dsc")
    dc.write("const lv_image_dsc_t *fw_detail[FW_WORLD_N] = {" + ",".join(dnames) + "};\n")
    dc.close()
    with open(os.path.join(INC, "forkworld_detail.h"), "w") as f:
        f.write('#ifndef __FW_DETAIL_H__\n#define __FW_DETAIL_H__\n#include "lvgl.h"\n#include "forkworld_scene.h"\n\n')
        f.write("extern const lv_image_dsc_t *fw_detail[FW_WORLD_N];\n#endif\n")

    print(f"完成。地图 {MAP_W}x{MAP_H} ({len(data)//1024}KB) · {N} 世界 · {len(vis)} 互访 · {NB} 气泡 · 详情卡 {dtot//1024}KB · 角色宽 {widths}")
    print(f"预览: {FW}/forkworld_global_preview.png")


if __name__ == "__main__":
    main()
