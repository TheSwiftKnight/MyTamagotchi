/* ForkWorld 全局大地图 —— 摊位大屏模式
 * 整张 the Ville（140×100 tile / 4480×3200px）+ 所有用户世界分区挂牌
 * + 使者互访演出 + 灵魂连线 + 自动巡航镜头。
 * 数据：后端 GET /api/worlds（不可达回退 data/worlds.json）；
 * 每 3 秒轮询检测「刚发生的二维码配对」→ 两只当场走到一起、连线、从此结伴漫游。 */
(async function boot() {
  // 加载期日志缓冲（内嵌浏览器 console 捕获不到 load 阶段，落到 window.__LOG 自查）
  window.__LOG = [];
  const LOG = (...a) => { window.__LOG.push(a.join(" ")); };
  window.addEventListener("error", e => LOG("ERROR:", e.message, "@", (e.filename || "").split("/").pop() + ":" + e.lineno));
  const T = FW.T;
  const TILE = 32;
  const MAP_TW = 140, MAP_TH = 100;
  const MAP_W = MAP_TW * TILE, MAP_H = MAP_TH * TILE;
  // 设备像素比：画布按 DPR 渲染，视网膜屏才清晰（游戏坐标 = 设备像素）
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const REG = await FW.loadData(".");

  // 世界点缀色轮换（星空暗色系，与手机端同源）
  REG.worlds.forEach((w, i) => (w._color = FW.WORLD_ACCENTS[i % FW.WORLD_ACCENTS.length]));

  const px = t => t * TILE + TILE / 2; // tile -> 像素中心

  let scene, cam;
  const envoys = {};   // world_id -> envoy 状态机
  const beams = [];    // 灵魂连线（持久累积）
  let beamsGfx, uiEvents;

  // ── 镜头 / 巡航状态 ────────────────────────────────────────────
  const CruiseState = { mode: "manual", lastInput: Date.now(), idx: 0, phase: "pan", until: 0, followSprite: null };
  const IDLE_MS = 10000;

  function markManual() {
    CruiseState.mode = "manual";
    CruiseState.lastInput = Date.now();
    if (cam) {
      cam.panEffect.reset();
      cam.zoomEffect.reset();
      cam.stopFollow();
    }
    setCruiseLabel();
  }

  function setCruiseLabel() {
    const el = document.getElementById("cruise-state");
    if (!el) return;
    el.textContent = { manual: "手动", cruise: "巡航中", follow: "跟拍中" }[CruiseState.mode];
    el.style.color = CruiseState.mode === "manual" ? T.inkSoft : T.a1;
  }

  // ── Phaser 场景 ───────────────────────────────────────────────
  function preload() {
    // Gemini 手绘素材（建筑/角色/装饰）+ 程序化大地/道路
    LOG("preload start");
    FW.Paper.preloadAssets(this);
    // 真实形象：手机端生成的透明底宠物图（后端 /api/pets/...），与手机/配对大屏同一形象；
    // 加载失败时 textures.exists 不成立，自动回退手绘角色贴图
    this.load.crossOrigin = "anonymous";
    for (const w of REG.worlds) {
      if (w.image) this.load.image("agent_" + w.world_id, FW.API_BASE + w.image);
    }
    this.load.on("loaderror", f => LOG("loaderror:", f.key));
    this.load.on("complete", () => LOG("load complete"));
  }

  function create() {
    LOG("create start");
    try {
      createInner.call(this);
      LOG("create done");
    } catch (e) {
      LOG("CREATE FAIL:", e.message, e.stack ? e.stack.split("\n")[1] : "");
      throw e;
    }
  }

  function createInner() {
    scene = this;
    cam = this.cameras.main;
    uiEvents = new Phaser.Events.EventEmitter();

    // —— 手绘纸面大地：底 + 花草散布 + 区域外散布树丛 + 中心广场放射道路 ——
    FW.Paper.buildGround(this, MAP_W, MAP_H, REG);
    FW.Paper.buildRoads(this, REG, MAP_W, MAP_H);

    // —— 世界分区：草场底 + 建筑贴图密集摆放 + 挂牌 + 物品使者 ——
    for (const w of REG.worlds) {
      const [x0, y0, x1, y1] = w.region.bounds;
      const rx = x0 * TILE, ry = y0 * TILE, rw = (x1 - x0 + 1) * TILE, rh = (y1 - y0 + 1) * TILE;

      // 草场底 + 手绘虚线边框
      FW.Paper.buildRegion(this, w);

      // 点击分区 → 打开详情
      const zone = this.add.zone(rx + rw / 2, ry + rh / 2, rw, rh).setInteractive();
      zone.on("pointerup", p => { if (!p._wasDrag) openDetail(w); });

      // 地标 → Gemini 手绘建筑贴图（按 slot 摆放，深度按 y 排序）+ 名牌
      w._marks = [];
      for (const lm of w.world.landmarks) {
        const t = w.slot_tiles[String(lm.slot)];
        if (!t) continue;
        const bx = px(t[0]), by = px(t[1]);
        FW.Paper.placeSprite(this, FW.Paper.bldKey(lm.type), bx, by, 128);
        w._marks.push(makeLandmark(this, w, lm, bx, by - 92));
      }

      // 挂牌（世界名 + 主人）—— 顶层，屏幕恒定大小
      w._plate = makePlate(this, w, px(w.region.anchor[0]), y0 * TILE - 8);

      // 行走形象：优先真实宠物图（与手机端同一形象），缺失/加载失败回退手绘角色
      const [ax, ay] = w.region.anchor;
      const imgKey = "agent_" + w.world_id;
      const ck = this.textures.exists(imgKey) ? imgKey : FW.Paper.charKey(w.agent_kind);
      const spr = this.add.image(px(ax), px(ay), ck).setOrigin(0.5, 0.88);
      spr.setScale((ck === imgKey ? 68 : 60) / spr.height);
      spr.setDepth(Math.round(px(ay)) + 3);
      envoys[w.world_id] = {
        world: w, sprite: spr, key: ck, baseScale: spr.scaleX,
        tile: [ax, ay], path: [], speed: 90,
        onDone: null, visiting: false, nextWander: Date.now() + 2000 + Math.random() * 4000,
        bubble: null, dir: "down",
        showEpoch: 0, partner: null, isLeader: false,
      };
    }

    beamsGfx = this.add.graphics().setDepth(9000);

    // 历史羁绊开屏即连线（Bond 表持久化，后端重启不丢）
    for (const v of REG.visits || []) {
      const A = REG.byId[v.from], B = REG.byId[v.to];
      if (A && B) addBeam(A, B, v);
    }

    // —— 相机 ——（画布透明：地图外的留白透出页面星空底）
    cam.setBounds(0, 0, MAP_W, MAP_H);
    fitCamera(true);

    // 拖拽平移
    this.input.on("pointermove", p => {
      if (!p.isDown) return;
      p._wasDrag = (p._wasDrag || 0) + Math.abs(p.velocity.x) + Math.abs(p.velocity.y) > 2;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
      markManual();
    });
    this.input.on("pointerdown", p => { p._wasDrag = false; });
    // 滚轮缩放（以指针为中心）
    this.input.on("wheel", (p, _o, _dx, dy) => {
      const before = cam.getWorldPoint(p.x, p.y);
      const nz = Phaser.Math.Clamp(cam.zoom * (1 - dy * 0.0011), minZoom(), 2.2 * DPR);
      cam.setZoom(nz);
      const after = cam.getWorldPoint(p.x, p.y);
      cam.scrollX += before.x - after.x;
      cam.scrollY += before.y - after.y;
      markManual();
    });
    this.input.keyboard.on("keydown", markManual);

    // 互访事件 → 跟拍
    uiEvents.on("visit:start", ({ sprite }) => {
      if (CruiseState.mode !== "manual") {
        CruiseState.mode = "follow";
        CruiseState.followSprite = sprite;
        cam.panEffect.reset(); cam.zoomEffect.reset();
        cam.startFollow(sprite, false, 0.06, 0.06);
        cam.zoomTo(1.0 * DPR, 1500, "Sine.easeInOut");
        setCruiseLabel();
      }
    });
    uiEvents.on("visit:end", () => {
      if (CruiseState.mode === "follow") {
        cam.stopFollow();
        CruiseState.mode = "cruise";
        CruiseState.phase = "pan"; CruiseState.until = 0;
        setCruiseLabel();
      }
    });

    buildDomUI();
    visitLoop();
    setCruiseLabel();

    // 真实后端接入：记住已见过的配对，之后每 3 秒轮询检测新配对并即时开演
    snapshotVisits();
    setInterval(pollWorlds, 3000);

    // Scale.NONE：窗口缩放时手动把后备分辨率重设为 CSS×DPR，画布 CSS 保持逻辑像素
    const onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.scale.resize(Math.floor(w * DPR), Math.floor(h * DPR));
      const c = this.game.canvas;
      c.style.width = w + "px"; c.style.height = h + "px";
      cam.setSize(Math.floor(w * DPR), Math.floor(h * DPR));
      if (CruiseState.mode !== "manual") fitCamera(true);
    };
    window.addEventListener("resize", onResize);
    this.time.delayedCall(60, () => fitCamera(true));

    // 调试出口
    window.__FW = { scene, cam, envoys, beams, REG, CruiseState, fitCamera, minZoom,
                    playVisit, addBeam, playPairMeet, pollWorlds };
    console.log("[FW] create done. cam", cam.width, cam.height, "zoom", cam.zoom);
  }

  // 所有世界区域的包围盒（像素），初始/全景只框这里而非整张空旷大地图
  function worldsBBox() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const w of REG.worlds) {
      const [a, b, c, d] = w.region.bounds;
      x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d);
    }
    const pad = 5; // tile
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    return { x: x0 * TILE, y: y0 * TILE, w: (x1 - x0) * TILE, h: (y1 - y0) * TILE,
             cx: (x0 + x1) / 2 * TILE, cy: (y0 + y1) / 2 * TILE };
  }
  function minZoom() {
    const w = cam.width || window.innerWidth, h = cam.height || window.innerHeight;
    return Math.min(w / MAP_W, h / MAP_H) * 0.9;
  }
  function fitCamera(instant) {
    if (!cam.width || !cam.height) { scene.time.delayedCall(50, () => fitCamera(instant)); return; }
    const bb = worldsBBox();
    const z = Math.min(cam.width / bb.w, cam.height / bb.h) * 0.98;
    if (instant) { cam.setZoom(z); cam.centerOn(bb.cx, bb.cy); }
    else { cam.pan(bb.cx, bb.cy, 900, "Sine.easeInOut"); cam.zoomTo(z, 900, "Sine.easeInOut"); }
  }

  // ── 挂牌 / 地标 / 气泡（纸面手绘风，Phaser 容器实现） ──────────
  function makePlate(sc, w, x, y) {
    const title = sc.add.text(0, 0, w.world.world_name, {
      fontFamily: T.fontHand, fontSize: "26px", color: T.ink, fontStyle: "bold", resolution: DPR,
    }).setOrigin(0.5, 0);
    const sub = sc.add.text(0, 30, `${w.owner} · ${w.world.temperament}`, {
      fontFamily: T.fontHand, fontSize: "15px", color: "#6b6558", resolution: DPR,
    }).setOrigin(0.5, 0);
    const bw = Math.max(title.width, sub.width) + 36, bh = 56;
    const g = sc.add.graphics();
    g.fillStyle(0xfaf6ef, 0.96).fillRoundedRect(-bw / 2, -8, bw, bh, 12);
    g.lineStyle(2, Phaser.Display.Color.HexStringToColor(w._color).color, 0.9)
      .strokeRoundedRect(-bw / 2, -8, bw, bh, 12);
    const c = sc.add.container(x, y - 40, [g, title, sub]).setDepth(10000);
    c.setSize(bw, bh);
    c.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -8, bw, bh), Phaser.Geom.Rectangle.Contains);
    c.on("pointerup", p => { if (!p._wasDrag) openDetail(w); });
    return c;
  }

  function makeLandmark(sc, w, lm, x, y) {
    // 建筑贴图本身已是图标，这里只保留名牌（手绘纸签）
    const label = sc.add.text(0, 0, lm.name, {
      fontFamily: T.fontHand, fontSize: "14px", color: T.ink,
      backgroundColor: "rgba(250,246,239,0.92)", padding: { x: 7, y: 3 }, resolution: DPR,
    }).setOrigin(0.5, 1);
    const c = sc.add.container(x, y, [label]).setDepth(9500);
    c._label = label;
    return c;
  }

  function showBubble(env, text, ms) {
    if (env.bubble) { env.bubble.destroy(); env.bubble = null; }
    const sc = scene;
    const txt = sc.add.text(0, 0, text, {
      fontFamily: T.fontHand, fontSize: "16px", color: T.ink,
      wordWrap: { width: 240 }, align: "left", resolution: DPR,
    }).setOrigin(0.5, 1);
    const bw = txt.width + 24, bh = txt.height + 16;
    const g = sc.add.graphics();
    g.fillStyle(0xffffff, 0.97).fillRoundedRect(-bw / 2, -bh - 8, bw, bh, 10);
    g.lineStyle(2, 0x1c1911, 0.85).strokeRoundedRect(-bw / 2, -bh - 8, bw, bh, 10);
    g.fillTriangle(-5, -9, 5, -9, 0, 0).lineStyle(2, 0x1c1911, 0.85);
    txt.y = -16;
    const c = sc.add.container(env.sprite.x, env.sprite.y - 26, [g, txt]).setDepth(12000);
    env.bubble = c;
    sc.time.delayedCall(ms, () => { if (env.bubble === c) { c.destroy(); env.bubble = null; } });
  }

  function addBeam(A, B, v) {
    const r = v && v.resonance;
    if (!r || typeof r !== "object" || !r.hardware_feedback) return;   // 形状不对宁可不画
    const old = beams.find(b => b.v.visit_id === v.visit_id);
    if (old) {   // 同一对再次配对：分数/颜色就地更新
      old.v = v;
      old.color = Phaser.Display.Color.HexStringToColor(r.hardware_feedback.led_rgb).color;
      old.label.setText(`❤ ${r.score}`).setStyle({ color: r.hardware_feedback.led_rgb });
      return;
    }
    const label = scene.add.text(0, 0, `❤ ${v.resonance.score}`, {
      fontFamily: T.fontMono, fontSize: "18px", color: v.resonance.hardware_feedback.led_rgb,
      backgroundColor: "rgba(28,25,17,0.75)", padding: { x: 8, y: 3 }, resolution: DPR,
    }).setOrigin(0.5).setDepth(11000);
    const ax = px(A.region.anchor[0]), ay = px(A.region.anchor[1]);
    const bx = px(B.region.anchor[0]), by = px(B.region.anchor[1]);
    label.setPosition((ax + bx) / 2, (ay + by) / 2);
    beams.push({ v, a: [ax, ay], b: [bx, by], color: Phaser.Display.Color.HexStringToColor(v.resonance.hardware_feedback.led_rgb).color, label });
    updateStatus();
  }

  // ── 使者移动引擎 ──────────────────────────────────────────────
  function moveAlong(env, tiles, speed) {
    return new Promise(res => {
      env.path = tiles.slice();
      env.speed = speed;
      env.onDone = res;
      if (!env.path.length) { env.onDone = null; res(); }
    });
  }
  const delay = ms => new Promise(r => scene.time.delayedCall(ms, r));

  function stepEnvoys(dtMs) {
    const dt = dtMs / 1000;
    for (const id in envoys) {
      const env = envoys[id];
      // 漫游：单身在自家院里转，结伴的由 leader 领着满广场逛
      if (!env.visiting && !env.path.length && Date.now() > env.nextWander) {
        if (env.partner) {
          if (env.isLeader && !env.partner.visiting && !env.partner.path.length) {
            const [tx, ty] = randomPlazaTile();
            env.speed = env.partner.speed = 60;
            env.path = FW.walkSteps(env.tile, [tx, ty]);
            env.partner.path = FW.walkSteps(env.partner.tile, [tx + 1, ty]);   // 并排走
            env.nextWander = env.partner.nextWander = Date.now() + 4500 + Math.random() * 5000;
          }
        } else {
          const [x0, y0, x1, y1] = env.world.region.bounds;
          const tx = Phaser.Math.Between(x0 + 1, x1 - 1), ty = Phaser.Math.Between(y0 + 1, y1 - 1);
          env.speed = 60;
          env.path = FW.walkSteps(env.tile, [tx, ty]);
          env.nextWander = Date.now() + 3500 + Math.random() * 5000;
        }
      }
      if (env.path.length) {
        const [tx, ty] = env.path[0];
        const gx = px(tx), gy = px(ty);
        const dx = gx - env.sprite.x, dy = gy - env.sprite.y;
        const dist = Math.hypot(dx, dy), step = env.speed * dt;
        // 手绘风走路：左右朝向翻转 + 摇摆（agentWalk 语言）
        if (Math.abs(dx) > 2) env.sprite.setFlipX(dx < 0);
        env.sprite.rotation = Math.sin(Date.now() / 90) * 0.08;
        if (dist <= step) {
          env.sprite.setPosition(gx, gy);
          env.tile = env.path.shift();
          if (!env.path.length) {
            env.sprite.rotation = 0;
            const cb = env.onDone; env.onDone = null;
            cb && cb();
          }
        } else {
          env.sprite.x += (dx / dist) * step;
          env.sprite.y += (dy / dist) * step;
        }
        // 深度随 y 更新，正确遮挡建筑
        env.sprite.setDepth(Math.round(env.sprite.y) + 3);
      } else {
        // 驻留：轻微呼吸缩放（不改 y，避免累积漂移）
        env.sprite.rotation = 0;
        env.sprite.setScale(env.baseScale * (1 + Math.sin(Date.now() / 480 + env.tile[0]) * 0.02));
      }
      if (env.bubble) env.bubble.setPosition(env.sprite.x, env.sprite.y - 34 * (env.sprite.scaleY / env.baseScale));
    }
  }

  // ── 互访演出循环（历史羁绊的环境演出；配对实况优先，结伴中的不参加） ──
  async function visitLoop() {
    await delay(5000);
    let i = 0;
    while (true) {
      const vs = REG.visits || [];
      const v = vs.length ? vs[i % vs.length] : null;
      const A = v && REG.byId[v.from], B = v && REG.byId[v.to];
      const ea = A && envoys[A.world_id], eb = B && envoys[B.world_id];
      const idle = e => e && !e.visiting && !e.partner;
      if (v && idle(ea) && idle(eb) && !PairWatch.busy) {
        try { await playVisit(v); } catch (e) { console.error("visit error", e); }
      }
      await delay(9000);
      i++;
    }
  }

  async function playVisit(v) {
    const A = REG.byId[v.from], B = REG.byId[v.to];
    if (!A || !B) return;
    const env = envoys[A.world_id];
    const e0 = env.showEpoch;
    const gone = () => env.showEpoch !== e0;   // 被配对实况抢占 → 静默退场，镜头归新演出管
    env.visiting = true;
    env.path = [];
    uiEvents.emit("visit:start", { sprite: env.sprite, visit: v });
    showBubble(env, `🚀 出发！去「${B.world.world_name}」做客`, 2600);
    await delay(1200);
    if (gone()) return;
    await moveAlong(env, FW.walkSteps(env.tile, B.region.anchor), 300);
    if (gone()) return;

    const bySlot = {};
    (v.bubbles || []).forEach(b => (bySlot[b.slot] = b.text));
    for (const lm of [...B.world.landmarks].sort((a, b) => a.slot - b.slot)) {
      const t = B.slot_tiles[String(lm.slot)];
      if (!t) continue;
      await moveAlong(env, FW.walkSteps(env.tile, t), 240);
      if (gone()) return;
      const text = bySlot[lm.slot];
      showBubble(env, `${FW.landmarkIcon(lm.type)} ${text || "……"}`, text ? 3200 : 1200);
      await delay(text ? 3400 : 1300);
      if (gone()) return;
    }

    showBubble(env, `❤️ ${v.resonance.line}`, 4200);
    addBeam(A, B, v);
    await delay(4400);
    if (gone()) return;
    await moveAlong(env, FW.walkSteps(env.tile, A.region.anchor), 320);
    if (gone()) return;
    env.visiting = false;
    uiEvents.emit("visit:end");
  }

  // ── 配对实况：扫码成功 → 两只走到一起、当众交换台词、连线、从此结伴 ──
  function preempt(env) {
    // 抢占正在进行的演出：清走位、放行卡在 moveAlong 的 await，
    // 原 playVisit 靠 showEpoch 变化感知被抢占后静默退出
    env.showEpoch++;
    env.path = [];
    const cb = env.onDone; env.onDone = null; cb && cb();
    if (env.bubble) { env.bubble.destroy(); env.bubble = null; }
    env.visiting = false;
  }

  function couple(ea, eb) {
    if (ea.partner) uncouple(ea);
    if (eb.partner) uncouple(eb);
    ea.partner = eb; eb.partner = ea;
    ea.isLeader = true; eb.isLeader = false;
    ea.nextWander = eb.nextWander = Date.now() + 2500;
  }
  function uncouple(env) {
    const p = env.partner;
    if (!p) return;
    env.partner = p.partner = null;
    env.isLeader = p.isLeader = false;
  }

  function randomPlazaTile() {
    // 世界包围盒内随机逛（中央广场 + 各家门口），结伴环游全场
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const w of REG.worlds) {
      const [a, b, c, d] = w.region.bounds;
      x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d);
    }
    return [Phaser.Math.Between(x0 + 1, x1 - 2), Phaser.Math.Between(y0 + 1, y1 - 1)];
  }

  function spawnHearts(x, y, n) {
    const glyphs = ["❤️", "🧡", "💛", "💕"];
    for (let i = 0; i < n; i++) {
      const t = scene.add.text(x + Phaser.Math.Between(-70, 70), y + Phaser.Math.Between(-20, 20),
        glyphs[i % glyphs.length], { fontSize: "26px", resolution: DPR })
        .setOrigin(0.5).setDepth(12500)
        .setScale(Phaser.Math.Clamp(DPR / cam.zoom, DPR, 2.4 * DPR));
      scene.tweens.add({
        targets: t, y: t.y - Phaser.Math.Between(80, 150), alpha: 0,
        duration: 1900 + Math.random() * 800, delay: i * 150,
        ease: "Sine.easeOut", onComplete: () => t.destroy(),
      });
    }
  }

  async function playPairMeet(v) {
    const A = REG.byId[v.from], B = REG.byId[v.to];
    const ea = A && envoys[A.world_id], eb = B && envoys[B.world_id];
    if (!ea || !eb) return;
    preempt(ea); preempt(eb);
    ea.visiting = eb.visiting = true;

    const ma = A.region.anchor, mb = B.region.anchor;
    const mid = [Math.round((ma[0] + mb[0]) / 2), Math.round((ma[1] + mb[1]) / 2)];
    const side = ma[0] <= mb[0] ? 1 : -1;                       // A 在左则 A 站中点左侧
    const ta = [mid[0] - side, mid[1]], tb = [mid[0] + side, mid[1]];

    // 镜头：摊位高光时刻，直接切跟拍（观众手动拖动可随时夺回）
    cam.panEffect.reset(); cam.zoomEffect.reset(); cam.stopFollow();
    CruiseState.mode = "follow"; CruiseState.followSprite = ea.sprite; setCruiseLabel();
    cam.pan(px(mid[0]), px(mid[1]), 1400, "Sine.easeInOut");
    cam.zoomTo(0.85 * DPR, 1400, "Sine.easeInOut");

    showBubble(ea, `📷 刚才镜头前的是${B.character}！`, 2600);
    showBubble(eb, `📷 ${A.character}！过来一起走走！`, 2600);
    await delay(1200);
    await Promise.all([
      moveAlong(ea, FW.walkSteps(ea.tile, ta), 230),
      moveAlong(eb, FW.walkSteps(eb.tile, tb), 230),
    ]);
    ea.sprite.setFlipX(side < 0);                               // 面对面
    eb.sprite.setFlipX(side > 0);

    const cx = (px(ta[0]) + px(tb[0])) / 2, cy = px(mid[1]) - 30;
    spawnHearts(cx, cy, 8);
    const speakers = [ea, eb];
    const lines = (v.bubbles || []).slice(0, 3);
    for (let i = 0; i < lines.length; i++) {
      showBubble(speakers[i % 2], lines[i].text, 3300);
      await delay(3500);
    }

    // 结果揭晓：灵魂连线亮起 + 分数 + 双双起跳
    addBeam(A, B, v);
    spawnHearts(cx, cy, 12);
    showBubble(ea, `❤ 灵魂契合 ${v.resonance.score} 分！`, 3400);
    if (v.resonance.line) showBubble(eb, v.resonance.line, 3400);
    for (const env of speakers) {
      scene.tweens.add({ targets: env.sprite, y: env.sprite.y - 26, duration: 260,
        yoyo: true, repeat: 2, ease: "Quad.easeOut" });
    }
    await delay(3600);

    // 从此结伴在广场上漫游（新的配对会替换旧同伴）
    couple(ea, eb);
    ea.visiting = eb.visiting = false;
    uiEvents.emit("visit:end");
  }

  // ── 真实后端接入：轮询 /api/worlds，检测「刚发生的配对」并即时开演 ──
  const PairWatch = { seen: Object.create(null), queue: [], busy: false };
  function snapshotVisits() {
    for (const v of REG.visits || []) PairWatch.seen[v.visit_id] = v.pair_count || 1;
  }
  async function pollWorlds() {
    let reg;
    try { reg = await FW.fetchRegistry("."); } catch (e) { return; }   // 网络抖动，下轮再试
    if (reg.source !== "fastapi-live") return;                          // 静态回退无实时性
    // 世界名单变了（手机端捕获了新宠物）→ 重载重建整个场景
    const ids = ws => ws.map(x => x.world_id).join(",");
    if (ids(reg.worlds) !== ids(REG.worlds)) { location.reload(); return; }
    // 就地更新互访数据：详情卡与连线始终反映最新台词与分数
    REG.visits = reg.visits || [];
    for (const w of REG.worlds) w._visits = [];
    for (const v of REG.visits) {
      if (REG.byId[v.from]) REG.byId[v.from]._visits.push(v);
      if (REG.byId[v.to]) REG.byId[v.to]._visits.push(v);
      const cnt = v.pair_count || 1, prev = PairWatch.seen[v.visit_id];
      if (prev === undefined || cnt > prev) {   // 新羁绊，或同一对又碰了一次
        PairWatch.seen[v.visit_id] = cnt;
        PairWatch.queue.push(v);
      }
    }
    drainPairQueue();
  }
  async function drainPairQueue() {
    if (PairWatch.busy) return;
    PairWatch.busy = true;
    while (PairWatch.queue.length) {
      const v = PairWatch.queue.shift();
      try { await playPairMeet(v); } catch (e) { console.error("pair meet error", e); }
    }
    PairWatch.busy = false;
  }

  // ── 巡航 ──────────────────────────────────────────────────────
  function stepCruise() {
    const now = Date.now();
    if (CruiseState.mode === "manual" && now - CruiseState.lastInput > IDLE_MS) {
      CruiseState.mode = "cruise";
      CruiseState.phase = "pan";
      CruiseState.until = 0;
      setCruiseLabel();
    }
    if (CruiseState.mode !== "cruise") return;
    if (now < CruiseState.until) return;
    if (CruiseState.phase === "pan") {
      const w = REG.worlds[CruiseState.idx % REG.worlds.length];
      const [ax, ay] = w.region.anchor;
      cam.pan(px(ax), px(ay), 2600, "Sine.easeInOut");
      cam.zoomTo(0.8 * DPR, 2600, "Sine.easeInOut");
      CruiseState.phase = "dwell";
      CruiseState.until = now + 2600 + 5200;
    } else {
      CruiseState.idx++;
      // 每转完一圈，拉远看一次全景
      if (CruiseState.idx % REG.worlds.length === 0) {
        fitCamera(false);
        CruiseState.until = now + 900 + 4200;
      }
      CruiseState.phase = "pan";
    }
  }

  // ── 每帧 ──────────────────────────────────────────────────────
  function update(_t, dtMs) {
    stepEnvoys(dtMs);
    stepCruise();

    // 屏幕恒定大小元素：反向缩放（坐标系为设备像素，故用 DPR/zoom 保持 CSS 尺寸）
    const inv = Phaser.Math.Clamp(DPR / cam.zoom, DPR, 2.6 * DPR);
    for (const w of REG.worlds) {
      w._plate.setScale(inv * 0.92);
      const showLabels = cam.zoom >= 0.5 * DPR;
      for (const m of w._marks) {
        m.setScale(Phaser.Math.Clamp(DPR / cam.zoom, DPR, 2 * DPR));
        m._label.setVisible(showLabels);
      }
    }
    for (const id in envoys) {
      const env = envoys[id];
      if (env.bubble) env.bubble.setScale(Phaser.Math.Clamp(DPR / cam.zoom, DPR, 2.2 * DPR));
    }

    // 灵魂连线脉动
    beamsGfx.clear();
    const t = Date.now();
    beams.forEach((b, i) => {
      const pulse = 0.4 + 0.25 * Math.sin(t / 480 + i * 1.7);
      const lw = Phaser.Math.Clamp(DPR * (2.5 + b.v.resonance.score / 30) / cam.zoom, 3 * DPR, 14 * DPR);
      beamsGfx.lineStyle(lw, b.color, pulse);
      beamsGfx.lineBetween(b.a[0], b.a[1], b.b[0], b.b[1]);
      b.label.setScale(Phaser.Math.Clamp(DPR / cam.zoom, DPR, 2.4 * DPR));
    });
  }

  // ── DOM overlay ───────────────────────────────────────────────
  function buildDomUI() {
    const list = document.getElementById("world-list");
    list.innerHTML = "";
    for (const w of REG.worlds) {
      const el = document.createElement("div");
      el.className = "w-card";
      // 卡片左侧嵌入真实形象（与地图/手机端同源），无图回退手绘角色
      const icon = w.image ? FW.API_BASE + w.image : FW.Paper.charUrl(w.agent_kind);
      el.innerHTML = `<div class="w-char"><img src="${icon}" alt=""></div>
        <div class="w-name">${w.world.world_name}</div>
        <div class="w-meta">${w.owner} · ${w.world.climate}</div>`;
      el.onclick = () => {
        markManual();
        const [ax, ay] = w.region.anchor;
        cam.pan(px(ax), px(ay), 1100, "Sine.easeInOut");
        cam.zoomTo(0.85 * DPR, 1100, "Sine.easeInOut");
        openDetail(w);
      };
      list.appendChild(el);
    }
    document.getElementById("btn-zoom-in").onclick = () => { markManual(); cam.setZoom(Math.min(2.2 * DPR, cam.zoom * 1.25)); };
    document.getElementById("btn-zoom-out").onclick = () => { markManual(); cam.setZoom(Math.max(minZoom(), cam.zoom / 1.25)); };
    document.getElementById("btn-fit").onclick = () => { markManual(); fitCamera(true); };
    document.getElementById("btn-cruise").onclick = () => {
      CruiseState.mode = "cruise"; CruiseState.phase = "pan"; CruiseState.until = 0;
      CruiseState.lastInput = 0; setCruiseLabel();
    };
    document.getElementById("detail-close").onclick = () =>
      document.getElementById("detail").classList.remove("show");
    updateStatus();

    // 时钟
    const clock = document.getElementById("clock");
    setInterval(() => {
      clock.textContent = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }, 1000);
  }

  function updateStatus() {
    const el = document.getElementById("status-line");
    if (el) el.textContent = `${REG.worlds.length} 个世界 · ${beams.length} 条灵魂连线`;
  }

  function openDetail(w) {
    const d = document.getElementById("detail");
    const lms = w.world.landmarks.map(lm =>
      `<div class="d-lm"><span>${FW.landmarkIcon(lm.type)}</span><div><b>${lm.name}</b><i>${lm.from}</i></div></div>`).join("");
    const res = (w.world.residents || []).map(r => `<div class="d-res">🐾 ${r.name} —— ${r.personality}</div>`).join("");
    const visits = (w._visits || []).map(v => {
      const other = v.from === w.world_id ? REG.byId[v.to] : REG.byId[v.from];
      return `<div class="d-visit"><b>❤ ${v.resonance.score}</b> 与「${other.world.world_name}」<br><i>${v.resonance.line}</i></div>`;
    }).join("") || '<div class="d-visit-none">还没有互访记录</div>';
    d.querySelector("#detail-body").innerHTML = `
      <div class="d-title" style="color:${w._color}">${w.world.world_name}</div>
      <div class="d-owner">主人：${w.owner}</div>
      <div class="d-climate">🌤 ${w.world.climate}<br>✨ ${w.world.temperament}</div>
      <div class="d-sec">地标</div>${lms}
      <div class="d-sec">住民</div>${res}
      <div class="d-sec">灵魂连线</div>${visits}`;
    d.classList.add("show");
  }

  // ── 启动 ──────────────────────────────────────────────────────
  // ?bg=1：用 setTimeout 驱动主循环（RAF 在隐藏/被遮挡的窗口会被浏览器挂起——
  // 摊位大屏被别的窗口盖住或投屏采集时不至于冻结；平时默认 RAF 更顺滑）
  const bgMode = new URLSearchParams(location.search).has("bg");
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-container",
    // 后备分辨率 = 显示尺寸 × DPR（视网膜屏清晰）；坐标系随之为设备像素
    width: Math.floor(window.innerWidth * DPR),
    height: Math.floor(window.innerHeight * DPR),
    transparent: true,
    pixelArt: false,      // 手绘素材：开抗锯齿，缩小才平滑（原来 true 强制最近邻发糙）
    antialias: true,
    roundPixels: false,
    disableVisibilityChange: true,
    fps: bgMode ? { forceSetTimeOut: true, target: 30 } : undefined,
    scene: { preload, create, update },
    scale: { mode: Phaser.Scale.NONE },
    callbacks: {
      postBoot: g => {
        // 画布 CSS 显示尺寸保持逻辑像素，后备是 DPR 倍 → 浏览器不再放大 → 清晰
        const c = g.canvas;
        c.style.width = window.innerWidth + "px";
        c.style.height = window.innerHeight + "px";
      },
    },
  });
})();
