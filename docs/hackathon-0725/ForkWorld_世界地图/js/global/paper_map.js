/* ForkWorld 手绘纸面地图渲染库 —— Gemini 生成的手绘素材 + 程序化大地/道路
 * 学斯坦福小镇：等距建筑贴图密集摆放 + 角色行走 + 深度按 y 排序。
 * 逻辑坐标系不变：140×100 tile × 32px。 */
window.FW = window.FW || {};
FW.Paper = (function () {
  const TILE = 32;
  const INK = 0x1c1911;
  // 相对路径（相对 global.html）：Django /static/forkworld/ 与独立静态服务器都适用
  const ASSET = "assets/sprites";

  const BLDS = ["archive","cafe","greenhouse","kitchen","lab","library","market",
                "mountain","museum","pond","radiotower","shelf","stage","statue",
                "studio","treehouse","workshop"];
  const CHARS = ["book","headphones","lamp","mic","mug","plush"];
  const DECO = ["bush","flowers","lamppost","tree"];
  // 每次加载都变的版本号：彻底绕过浏览器对旧坏图的缓存
  const VER = "?v=" + Date.now();

  // landmark type → 建筑贴图 key（去下划线：radio_tower→radiotower）
  function bldKey(type) {
    const k = (type || "").replace(/_/g, "");
    if (BLDS.includes(k)) return "bld_" + k;
    // 兜底：未生成的类型用近似替代
    const FALLBACK = { garden: "greenhouse", observatory: "radiotower", garage: "workshop",
      dock: "cafe", campfire: "kitchen", arcade: "studio", shrine: "statue",
      theater: "stage", clocktower: "museum", windmill: "mountain", tunnel: "archive",
      lighthouse: "radiotower" };
    return "bld_" + (FALLBACK[type] || "library");
  }
  function charKey(kind) { return "char_" + (CHARS.includes(kind) ? kind : "mug"); }
  function charUrl(kind) { return `${ASSET}/${charKey(kind)}.png${VER}`; }

  function preloadAssets(scene) {
    BLDS.forEach(b => scene.load.image("bld_" + b, `${ASSET}/bld_${b}.png${VER}`));
    CHARS.forEach(c => scene.load.image("char_" + c, `${ASSET}/char_${c}.png${VER}`));
    DECO.forEach(d => scene.load.image("dec_" + d, `${ASSET}/dec_${d}.png${VER}`));
  }

  // 放置一张贴图，按目标高度等比缩放，锚点在底部中心，深度按 y 排序
  function placeSprite(scene, key, x, y, targetH, depthBias) {
    const img = scene.add.image(x, y, key).setOrigin(0.5, 0.88);
    const s = targetH / img.height;
    img.setScale(s);
    img.setDepth(Math.round(y) + (depthBias || 0));
    return img;
  }

  // ── 大地：纸面底 + 花草散布（tileSprite 平铺）+ 区域外散布树丛 ─────────
  function buildGround(scene, MAP_W, MAP_H, REG) {
    const size = 640;
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0xf5f0e8, 1).fillRect(0, 0, size, size);
    const flowers = [[60,80],[210,50],[420,140],[560,90],[120,300],[330,260],[520,330],[80,480],[260,540],[470,500],[610,420],[180,180]];
    for (const [fx, fy] of flowers) drawFlower(g, fx, fy, 5);
    const tufts = [[140,120],[300,90],[500,200],[70,240],[230,380],[400,420],[560,560],[100,560],[350,560],[600,250],[40,380],[520,60]];
    for (const [tx, ty] of tufts) drawTuft(g, tx, ty);
    g.fillStyle(INK, 0.05);
    for (const [sx, sy] of [[180,450],[450,300],[90,150],[550,480],[300,200]]) g.fillEllipse(sx, sy, 14, 5);
    g.generateTexture("paper_ground", size, size);
    g.destroy();
    scene.add.tileSprite(0, 0, MAP_W, MAP_H, "paper_ground").setOrigin(0).setDepth(-4);

    // 区域外散布手绘树/灌木（避开世界分区），让大地更饱满（学斯坦福密集装饰）
    const inRegion = (x, y) => REG.worlds.some(w => {
      const [x0, y0, x1, y1] = w.region.bounds;
      return x >= x0 - 3 && x <= x1 + 3 && y >= y0 - 3 && y <= y1 + 3;
    });
    let seed = 20260723;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    let placed = 0;
    for (let i = 0; i < 220 && placed < 90; i++) {
      const tx = Math.floor(rnd() * 140), ty = Math.floor(rnd() * 100);
      if (inRegion(tx, ty)) continue;
      const r = rnd();
      const key = r < 0.5 ? "dec_tree" : r < 0.8 ? "dec_bush" : r < 0.92 ? "dec_flowers" : "dec_lamppost";
      const h = key === "dec_tree" ? 66 : key === "dec_lamppost" ? 60 : key === "dec_bush" ? 40 : 30;
      placeSprite(scene, key, tx * TILE + 16, ty * TILE + 16, h);
      placed++;
    }
  }

  function drawFlower(g, x, y, r) {
    g.lineStyle(1, INK, 0.4);
    for (let a = 0; a < 360; a += 60) {
      const rad = (a * Math.PI) / 180;
      g.strokeEllipse(x + Math.cos(rad) * r * 1.1, y + Math.sin(rad) * r * 1.1, r * 1.1, r * 0.76);
    }
    g.strokeCircle(x, y, r * 0.35);
    g.lineBetween(x, y + r * 1.6, x, y + r * 3.2);
  }
  function drawTuft(g, x, y) {
    g.lineStyle(1, INK, 0.28);
    g.lineBetween(x - 5, y, x - 8, y - 8);
    g.lineBetween(x, y, x, y - 10);
    g.lineBetween(x + 5, y, x + 8, y - 8);
  }

  // ── 世界分区：柔和草场底 + 手绘虚线边框（建筑贴图另行摆放）────────────
  function buildRegion(scene, w) {
    const [x0, y0, x1, y1] = w.region.bounds;
    const rx = x0 * TILE, ry = y0 * TILE, rw = (x1 - x0 + 1) * TILE, rh = (y1 - y0 + 1) * TILE;
    const accent = Phaser.Display.Color.HexStringToColor(w._color).color;
    const g = scene.add.graphics().setDepth(-3);
    // 草场底（柔和）
    g.fillStyle(0xbcd6a4, 0.42).fillRoundedRect(rx, ry, rw, rh, 26);
    // 波浪纹理
    g.lineStyle(1.2, 0x6a9828, 0.28);
    const waves = Math.max(4, Math.round(rh / 70));
    for (let i = 0; i < waves; i++) {
      const wy = ry + ((i + 0.5) * rh) / waves;
      g.beginPath(); g.moveTo(rx + 10, wy);
      for (let sx = 0; sx <= rw - 20; sx += 22) g.lineTo(rx + 10 + sx, wy + Math.sin(sx / 44) * 4);
      g.strokePath();
    }
    // 手绘虚线边框（世界点缀色）
    g.lineStyle(2.5, accent, 0.55);
    dashedRoundRect(g, rx, ry, rw, rh, 26, 16, 10);
  }

  function dashedRoundRect(g, x, y, w, h, r, dash, gap) {
    const seg = (x1, y1, x2, y2) => {
      const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.floor(len / (dash + gap)));
      for (let i = 0; i < n; i++) {
        const t0 = (i * (dash + gap)) / len, t1 = Math.min(1, t0 + dash / len);
        g.lineBetween(x1 + (x2 - x1) * t0, y1 + (y2 - y1) * t0, x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1);
      }
    };
    seg(x + r, y, x + w - r, y);
    seg(x + w, y + r, x + w, y + h - r);
    seg(x + w - r, y + h, x + r, y + h);
    seg(x, y + h - r, x, y + r);
  }

  // ── 中心广场 + 放射微弯土路（保留程序化，观感已好）──────────────────
  function buildRoads(scene, REG, MAP_W, MAP_H) {
    const g = scene.add.graphics().setDepth(-2);
    const cx = MAP_W / 2, cy = MAP_H / 2;
    g.fillStyle(0xc8c2b4, 1).fillCircle(cx, cy, 110);
    g.lineStyle(2, INK, 0.16).strokeCircle(cx, cy, 110);
    g.lineStyle(1.5, 0xffffff, 0.4).strokeCircle(cx, cy, 84);
    for (const w of REG.worlds) {
      const ax = w.region.anchor[0] * TILE + 16, ay = w.region.anchor[1] * TILE + 16;
      roadPath(g, cx, cy, ax, ay);
    }
    return g;
  }
  function roadPath(g, x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const segs = Math.max(14, Math.round(dist / 60));
    const nx = -(y2 - y1) / dist, ny = (x2 - x1) / dist;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const wob = Math.sin(t * Math.PI * 2.3) * 26 * Math.sin(t * Math.PI);
      pts.push([x1 + (x2 - x1) * t + nx * wob, y1 + (y2 - y1) * t + ny * wob]);
    }
    g.lineStyle(26, 0xc8c2b4, 1);
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (const [px, py] of pts) g.lineTo(px, py);
    g.strokePath();
    g.lineStyle(1.2, INK, 0.12);
    for (const off of [-13, 13]) {
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1] + off);
      for (const [px, py] of pts) g.lineTo(px, py + off);
      g.strokePath();
    }
    g.lineStyle(1.6, 0xffffff, 0.5);
    for (let i = 0; i < pts.length - 1; i += 2) g.lineBetween(pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]);
  }

  // ── 物品拟人角色 SVG（保留，作为 DOM/兜底备用）────────────────────────
  function agentSvg(kind, accent) {
    const A = accent, K = "#1C1911";
    const dot = `<circle cx="0" cy="0" r="20" fill="${A}" stroke="${K}" stroke-width="2"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -24 48 48">${dot}</svg>`;
  }

  return { preloadAssets, buildGround, buildRegion, buildRoads, placeSprite, bldKey, charKey, charUrl, agentSvg, TILE };
})();
