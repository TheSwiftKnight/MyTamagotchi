(async function () {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const stage = $("#stage");
  const viewport = $("#viewport");
  const hotspotLayer = $("#house-hotspots");
  const detail = $("#detail");
  const detailBody = $("#detail-body");
  const status = $("#status");
  const registry = await FW.loadData(".");
  const STAGE_WIDTH = 1672;
  const STAGE_HEIGHT = 941;

  // 六圈房区由内向外自动排布，容量随半径增大，避免继续维护手工坐标。
  const RINGS = [
    { id: 1, name: "一环 · 花庭", rx: 210, ry: 145, capacity: 12, offset: -90 },
    { id: 2, name: "二环 · 晴径", rx: 300, ry: 205, capacity: 16, offset: -90 },
    { id: 3, name: "三环 · 林荫", rx: 390, ry: 265, capacity: 20, offset: -90 },
    { id: 4, name: "四环 · 麦风", rx: 480, ry: 325, capacity: 24, offset: -90 },
    { id: 5, name: "五环 · 原野", rx: 570, ry: 385, capacity: 28, offset: -90 },
    { id: 6, name: "六环 · 远岚", rx: 660, ry: 430, capacity: 32, offset: -90 },
  ];
  const CENTER = { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 };
  const HOUSES = RINGS.flatMap((ring) =>
    Array.from({ length: ring.capacity }, (_, slot) => {
      const angle = (ring.offset + slot * 360 / ring.capacity) * Math.PI / 180;
      return {
        id: `R${ring.id}-${String(slot + 1).padStart(2, "0")}`,
        ringId: ring.id,
        ringName: ring.name,
        slot,
        x: CENTER.x + Math.cos(angle) * ring.rx,
        y: CENTER.y + Math.sin(angle) * ring.ry,
      };
    })
  );
  // 全部 Agent 依次绕环入住：原先是 slice(0, RINGS.length) 只放前 6 个，
  // 接上后端实时注册表后 agent 会超过 6 个（演示时观众每捕获一只就多一个），
  // 截断会让新住户永远不出现，所以改成轮流绕圈、撞位就顺延到下一间空房。
  registry.worlds.forEach((world, residentIndex) => {
    const ring = RINGS[residentIndex % RINGS.length];
    const lap = Math.floor(residentIndex / RINGS.length);      // 第几圈绕回来
    const slot = (residentIndex * 3 + lap * 5) % ring.capacity;
    const free = (house) => !Number.isInteger(house.residentIndex);
    let houseIndex = HOUSES.findIndex((h) => h.ringId === ring.id && h.slot === slot && free(h));
    if (houseIndex < 0) houseIndex = HOUSES.findIndex((h) => h.ringId === ring.id && free(h));
    if (houseIndex < 0) houseIndex = HOUSES.findIndex(free);   // 该环满了就用任意空房
    if (houseIndex >= 0) HOUSES[houseIndex].residentIndex = residentIndex;
  });
  const occupiedCount = HOUSES.filter((house) => Number.isInteger(house.residentIndex)).length;

  const state = {
    scale: 1, x: 0, y: 0, dragging: false, moved: false, px: 0, py: 0,
    activeHouse: null, cruise: false, cruiseIndex: 0,
  };

  // Integration contract. Product code can replace `enter` without changing the map:
  // window.ForkWorldHouseBridge.enter = ({ world, house }) => router.push(...).
  window.ForkWorldHouseBridge = window.ForkWorldHouseBridge || {
    enter(payload) {
      window.dispatchEvent(new CustomEvent("forkworld:enter-agent-world", { detail: payload }));
      console.info("[ForkWorld] Agent world entry requested:", payload.world.world_id);
    },
  };
  if (new URLSearchParams(location.search).has("debugHotspots")) {
    document.body.classList.add("debug-hotspots");
  }

  function applyTransform() {
    stage.style.transform = `translate3d(${state.x}px,${state.y}px,0) scale(${state.scale})`;
  }
  function fit() {
    const desktopFit = Math.min(innerWidth / STAGE_WIDTH, innerHeight / STAGE_HEIGHT);
    state.scale = innerWidth < 720 ? Math.max(.62, desktopFit) : desktopFit;
    state.x = (innerWidth - STAGE_WIDTH * state.scale) / 2;
    state.y = (innerHeight - STAGE_HEIGHT * state.scale) / 2;
    applyTransform();
  }
  function setScale(next, originX = innerWidth / 2, originY = innerHeight / 2) {
    const value = Math.max(.35, Math.min(2.2, next));
    const ratio = value / state.scale;
    state.x = originX - (originX - state.x) * ratio;
    state.y = originY - (originY - state.y) * ratio;
    state.scale = value;
    applyTransform();
  }
  function setActiveHouse(house) {
    state.activeHouse = house.id;
    document.querySelectorAll(".house-hotspot").forEach((element) => {
      element.classList.toggle("is-active", element.dataset.house === house.id);
    });
  }
  function openHouse(house) {
    setActiveHouse(house);
    const world = Number.isInteger(house.residentIndex) ? registry.worlds[house.residentIndex] : null;
    if (!world) {
      detailBody.innerHTML = `
        <div class="empty-house"><i>⌂</i><strong>${house.id} · 空房</strong>
        <p class="detail-owner">${house.ringName}</p>
        <p class="empty">目前没有 Agent 入住。未来有新世界加入时，可通过房屋分配接口写入此槽位。</p></div>`;
      status.textContent = `${house.ringName} · ${house.id} 暂无 Agent 入住`;
      detail.classList.add("show");
      return;
    }
    detailBody.innerHTML = `
      <h1>${world.world.world_name}</h1>
      <p class="detail-owner">${house.ringName} · ${house.id} · ${world.owner} · ${world.world.temperament}</p>
      <p class="detail-climate">${world.world.climate}</p>
      <h3>Agent 世界地标</h3>
      ${world.world.landmarks.map((landmark) => `<div class="landmark"><i>${FW.landmarkIcon(landmark.type)}</i><div><b>${landmark.name}</b><small>${landmark.from}</small></div></div>`).join("")}
      <h3>世界居民</h3>
      ${world.world.residents.map((resident) => `<div class="landmark"><i>◌</i><div><b>${resident.name}</b><small>${resident.personality}</small></div></div>`).join("")}
      <button class="enter-world" id="enter-world">进入 Agent 世界 →</button>`;
    $("#enter-world").addEventListener("click", () => {
      window.ForkWorldHouseBridge.enter({ world, house: { ...house } });
    });
    status.textContent = `${house.ringName} · ${house.id} 入住：${world.world.world_name}`;
    detail.classList.add("show");
  }
  function renderHouses() {
    HOUSES.forEach((house) => {
      const world = Number.isInteger(house.residentIndex) ? registry.worlds[house.residentIndex] : null;
      const button = document.createElement("button");
      button.className = `house-hotspot${world ? " is-occupied" : ""}`;
      button.dataset.house = house.id;
      button.style.left = `${house.x}px`;
      button.style.top = `${house.y}px`;
      button.style.setProperty("--accent", world ? FW.WORLD_ACCENTS[house.residentIndex % FW.WORLD_ACCENTS.length] : "#aaa69c");
      button.setAttribute("aria-label", world ? `${house.ringName} ${house.id}，已入住：${world.world.world_name}` : `${house.ringName} ${house.id}，空房`);
      button.innerHTML = `<span class="house-glyph"><i></i></span><span class="house-number">${house.id}${world ? ` · ${world.world.world_name}` : " · 空房"}</span>`;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!state.moved) openHouse(house);
      });
      hotspotLayer.append(button);
    });
    $("#occupied-count").textContent = occupiedCount;
    $("#empty-count").textContent = HOUSES.length - occupiedCount;
    $("#ring-count").textContent = RINGS.length;
    const ringList = $("#ring-list");
    RINGS.forEach((ring) => {
      const occupied = HOUSES.filter((house) => house.ringId === ring.id && Number.isInteger(house.residentIndex)).length;
      const item = document.createElement("button");
      item.className = "ring-item";
      item.innerHTML = `<b>${ring.id}</b><span>${ring.name.split(" · ")[1]}<small>${occupied}/${ring.capacity}</small></span>`;
      item.setAttribute("aria-label", `查看${ring.name}`);
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        const firstHouse = HOUSES.find((house) => house.ringId === ring.id);
        if (firstHouse) centerOnHouse(firstHouse);
        status.textContent = `${ring.name} · ${ring.capacity} 栋房屋`;
      });
      ringList.append(item);
    });
  }
  function centerOnHouse(house) {
    const targetScale = innerWidth < 720 ? .9 : Math.max(state.scale, .78);
    state.scale = targetScale;
    state.x = innerWidth / 2 - house.x * targetScale;
    state.y = innerHeight / 2 - house.y * targetScale;
    applyTransform();
  }

  viewport.addEventListener("pointerdown", (event) => {
    state.dragging = true; state.moved = false;
    state.px = event.clientX; state.py = event.clientY;
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    const dx = event.clientX - state.px, dy = event.clientY - state.py;
    if (Math.abs(dx) + Math.abs(dy) > 3) state.moved = true;
    state.x += dx; state.y += dy; state.px = event.clientX; state.py = event.clientY;
    applyTransform();
  });
  viewport.addEventListener("pointerup", () => { state.dragging = false; });
  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    setScale(state.scale * (event.deltaY > 0 ? .92 : 1.08), event.clientX, event.clientY);
  }, { passive: false });
  $("#zoom-in").addEventListener("click", () => setScale(state.scale * 1.15));
  $("#zoom-out").addEventListener("click", () => setScale(state.scale / 1.15));
  $("#fit").addEventListener("click", fit);
  $("#detail-close").addEventListener("click", () => detail.classList.remove("show"));
  $("#cruise").addEventListener("click", (event) => {
    state.cruise = !state.cruise;
    event.currentTarget.textContent = state.cruise ? "Ⅱ" : "▶";
    status.textContent = state.cruise ? "正在巡览六圈房区" : "手动浏览";
  });
  setInterval(() => {
    if (!state.cruise) return;
    const house = HOUSES[state.cruiseIndex++ % HOUSES.length];
    centerOnHouse(house); openHouse(house);
  }, 4500);
  setInterval(() => {
    $("#clock").textContent = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }, 1000);
  addEventListener("resize", fit);

  renderHouses();
  fit();
  status.textContent = `六圈共 ${HOUSES.length} 栋 · ${occupiedCount} 栋已入住 · ${HOUSES.length - occupiedCount} 栋空房`;

  // ── 广场居民 · 配对实况（真实后端驱动）──────────────────────────
  // 扫码配对成功 → 两只形象走到一块 → 当众交换真实配对台词 → 灵魂连线亮起 →
  // 从此结伴在广场上漫游。每 3 秒轮询 /api/worlds，检测到新配对
  // （新羁绊或同一对 pair_count 增加）即开演；历史羁绊开屏即连线。
  const beamSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  beamSvg.setAttribute("class", "beam-svg");
  beamSvg.setAttribute("viewBox", `0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`);
  stage.appendChild(beamSvg);
  const agentLayer = document.createElement("div");
  agentLayer.id = "agent-layer";
  stage.appendChild(agentLayer);
  const fxLayer = document.createElement("div");
  fxLayer.id = "fx-layer";
  stage.appendChild(fxLayer);

  const envoys = {};   // world_id -> 形象状态机
  const beams = [];    // 灵魂连线（持久累积）
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function homeAnchor(house) {
    // 家门口：从房屋标记朝广场中心退 46px，免得形象踩在房子上
    const dx = CENTER.x - house.x, dy = CENTER.y - house.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: house.x + dx / d * 46, y: house.y + dy / d * 46 };
  }

  HOUSES.forEach((house) => {
    if (!Number.isInteger(house.residentIndex)) return;
    const world = registry.worlds[house.residentIndex];
    const home = homeAnchor(house);
    const el = document.createElement("div");
    el.className = "agent-avatar";
    // 真实形象：手机端生成的透明底宠物图（后端 /api/pets/...），无图回退色块
    el.innerHTML = world.image
      ? `<img src="${FW.API_BASE + world.image}" alt="${world.character || ""}" draggable="false">`
      : `<span class="agent-fallback" style="background:${FW.WORLD_ACCENTS[house.residentIndex % FW.WORLD_ACCENTS.length]}">🐾</span>`;
    agentLayer.appendChild(el);
    envoys[world.world_id] = {
      world, home, el, img: el.firstChild,
      x: home.x, y: home.y, path: [], speed: 50, onDone: null,
      partner: null, isLeader: false, showEpoch: 0, busy: false,
      bubble: null, flip: 1, nextWander: Date.now() + 1500 + Math.random() * 4000,
    };
  });

  function moveAlong(env, points, speed) {
    return new Promise((resolve) => {
      env.path = points.slice(); env.speed = speed; env.onDone = resolve;
      if (!env.path.length) { env.onDone = null; resolve(); }
    });
  }

  function randomPlazaPoint() {
    // 椭圆广场范围内随机逛（中央广场 + 各家门口），结伴环游全场
    const angle = Math.random() * Math.PI * 2, radius = Math.sqrt(Math.random());
    return { x: CENTER.x + Math.cos(angle) * radius * 690, y: CENTER.y + Math.sin(angle) * radius * 375 };
  }

  function stepEnvoys(dtMs, now) {
    const dt = dtMs / 1000;
    const wall = Date.now();   // 漫游计时用墙钟：rAF 时间戳与 Date.now() 不同源
    for (const id in envoys) {
      const env = envoys[id];
      // 漫游：单身在自家门口转，结伴的由 leader 领着满广场逛
      if (!env.busy && !env.path.length && wall > env.nextWander) {
        if (env.partner) {
          if (env.isLeader && !env.partner.busy && !env.partner.path.length) {
            const target = randomPlazaPoint();
            env.speed = env.partner.speed = 52;
            env.path = [target];
            env.partner.path = [{ x: target.x + 64, y: target.y + 10 }];   // 并排走
            env.nextWander = env.partner.nextWander = wall + 4000 + Math.random() * 5000;
          }
        } else {
          const angle = Math.random() * Math.PI * 2, radius = Math.random() * 100;
          env.speed = 42;
          env.path = [{ x: env.home.x + Math.cos(angle) * radius, y: env.home.y + Math.sin(angle) * radius * .7 }];
          env.nextWander = wall + 3000 + Math.random() * 5000;
        }
      }
      if (env.path.length) {
        const target = env.path[0];
        const dx = target.x - env.x, dy = target.y - env.y;
        const dist = Math.hypot(dx, dy), step = env.speed * dt;
        if (Math.abs(dx) > 2) env.flip = dx < 0 ? -1 : 1;
        env.img.style.transform = `scaleX(${env.flip}) rotate(${Math.sin(now / 90) * 5}deg)`;   // 走路摇摆
        if (dist <= step) {
          env.x = target.x; env.y = target.y; env.path.shift();
          if (!env.path.length) {
            env.img.style.transform = `scaleX(${env.flip})`;
            const cb = env.onDone; env.onDone = null; cb && cb();
          }
        } else {
          env.x += dx / dist * step; env.y += dy / dist * step;
        }
      } else if (!env.img.classList.contains("jump")) {
        // 驻留：轻微呼吸（CSS 动画优先于内联样式，跳跃期间不写避免打架）
        env.img.style.transform = `scaleX(${env.flip}) scale(${1 + Math.sin(now / 480 + env.home.x) * .02})`;
      }
      env.el.style.left = env.x + "px";
      env.el.style.top = env.y + "px";
      env.el.style.zIndex = Math.round(env.y);   // 按纵深排序，低处形象盖高处
      if (env.bubble) {
        env.bubble.style.left = env.x + "px";
        env.bubble.style.top = (env.y - 84) + "px";
      }
    }
  }

  function showBubble(env, text, ms) {
    if (env.bubble) { env.bubble.remove(); env.bubble = null; }
    const bubble = document.createElement("div");
    bubble.className = "agent-bubble";
    bubble.textContent = text;
    bubble.style.left = env.x + "px";
    bubble.style.top = (env.y - 84) + "px";
    fxLayer.appendChild(bubble);
    env.bubble = bubble;
    setTimeout(() => { if (env.bubble === bubble) { bubble.remove(); env.bubble = null; } }, ms);
  }

  function spawnHearts(x, y, n) {
    const glyphs = ["❤️", "🧡", "💛", "💕"];
    for (let i = 0; i < n; i++) {
      const heart = document.createElement("span");
      heart.className = "agent-heart";
      heart.textContent = glyphs[i % glyphs.length];
      heart.style.left = (x + Math.random() * 140 - 70) + "px";
      heart.style.top = (y + Math.random() * 40 - 20) + "px";
      heart.style.animationDelay = (i * 0.15) + "s";
      fxLayer.appendChild(heart);
      setTimeout(() => heart.remove(), 3200 + i * 150);
    }
  }

  // ── 灵魂连线 ──────────────────────────────────────────────────
  function addBeam(v) {
    const r = v && v.resonance;
    if (!r || typeof r !== "object" || !r.hardware_feedback) return;   // 形状不对宁可不画
    const ea = envoys[v.from], eb = envoys[v.to];
    if (!ea || !eb) return;
    const color = r.hardware_feedback.led_rgb;
    const old = beams.find((b) => b.v.visit_id === v.visit_id);
    if (old) {   // 同一对再次配对：分数/颜色就地更新
      old.v = v;
      old.line.setAttribute("stroke", color);
      old.label.textContent = `❤ ${r.score}`;
      old.label.style.color = color;
      return;
    }
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-linecap", "round");
    beamSvg.appendChild(line);
    const label = document.createElement("div");
    label.className = "beam-label";
    label.textContent = `❤ ${r.score}`;
    label.style.color = color;
    fxLayer.appendChild(label);
    beams.push({ v, ea, eb, line, label, phase: beams.length * 1.7 });
  }

  function stepBeams(now) {
    for (const b of beams) {
      const x1 = b.ea.x, y1 = b.ea.y - 30, x2 = b.eb.x, y2 = b.eb.y - 30;
      b.line.setAttribute("x1", x1); b.line.setAttribute("y1", y1);
      b.line.setAttribute("x2", x2); b.line.setAttribute("y2", y2);
      b.line.setAttribute("stroke-opacity", 0.4 + 0.25 * Math.sin(now / 480 + b.phase));   // 脉动
      b.line.setAttribute("stroke-width", 2.5 + b.v.resonance.score / 30);
      b.label.style.left = ((x1 + x2) / 2) + "px";
      b.label.style.top = ((y1 + y2) / 2 - 14) + "px";
    }
  }

  // ── 镜头：配对高光时刻平滑推近中点，观众手动拖动随时夺回 ──────────
  let camTween = null;
  function cameraTo(cx, cy, scale, ms) {
    if (camTween) cancelAnimationFrame(camTween);
    const from = { x: state.x, y: state.y, s: state.scale };
    const to = { x: innerWidth / 2 - cx * scale, y: innerHeight / 2 - cy * scale, s: scale };
    const t0 = performance.now();
    const stepFn = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);   // easeOutCubic
      state.x = from.x + (to.x - from.x) * e;
      state.y = from.y + (to.y - from.y) * e;
      state.scale = from.s + (to.s - from.s) * e;
      applyTransform();
      if (k < 1) camTween = requestAnimationFrame(stepFn);
      else camTween = null;
    };
    camTween = requestAnimationFrame(stepFn);
  }
  viewport.addEventListener("pointerdown", () => {
    if (camTween) { cancelAnimationFrame(camTween); camTween = null; }
  });

  // ── 配对实况：两只走到一起、当众交换台词、连线、从此结伴 ──────────
  function preempt(env) {
    // 抢占正在进行的演出：清走位、放行卡在 moveAlong 的 await，
    // 原演出靠 showEpoch 变化感知被抢占后静默退出
    env.showEpoch++;
    env.path = [];
    const cb = env.onDone; env.onDone = null; cb && cb();
    if (env.bubble) { env.bubble.remove(); env.bubble = null; }
    env.busy = false;
  }
  function couple(ea, eb) {
    if (ea.partner) uncouple(ea);
    if (eb.partner) uncouple(eb);
    ea.partner = eb; eb.partner = ea;
    ea.isLeader = true; eb.isLeader = false;
    ea.nextWander = eb.nextWander = Date.now() + 2500;
  }
  function uncouple(env) {
    const partner = env.partner;
    if (!partner) return;
    env.partner = partner.partner = null;
    env.isLeader = partner.isLeader = false;
  }

  async function playPairMeet(v) {
    const ea = envoys[v.from], eb = envoys[v.to];
    if (!ea || !eb) return;
    preempt(ea); preempt(eb);
    ea.busy = eb.busy = true;
    const epoch = ea.showEpoch;
    const gone = () => ea.showEpoch !== epoch;

    const mid = { x: (ea.x + eb.x) / 2, y: (ea.y + eb.y) / 2 };
    const side = ea.x <= eb.x ? 1 : -1;   // A 在左则 A 站中点左侧
    const ta = { x: mid.x - side * 40, y: mid.y };
    const tb = { x: mid.x + side * 40, y: mid.y };

    cameraTo(mid.x, mid.y, Math.max(state.scale, 1.1), 1400);
    showBubble(ea, `📷 刚才镜头前的是${eb.world.character}！`, 2600);
    showBubble(eb, `📷 ${ea.world.character}！过来一起走走！`, 2600);
    await delay(1200);
    if (gone()) return;
    await Promise.all([moveAlong(ea, [ta], 160), moveAlong(eb, [tb], 160)]);
    if (gone()) return;
    ea.flip = side < 0 ? -1 : 1;   // 面对面
    eb.flip = -ea.flip;
    ea.img.style.transform = `scaleX(${ea.flip})`;
    eb.img.style.transform = `scaleX(${eb.flip})`;

    spawnHearts(mid.x, mid.y - 60, 8);
    const speakers = [ea, eb];
    const lines = (v.bubbles || []).slice(0, 3);
    for (let i = 0; i < lines.length; i++) {
      showBubble(speakers[i % 2], lines[i].text, 3300);
      await delay(3500);
      if (gone()) return;
    }

    // 结果揭晓：灵魂连线亮起 + 分数 + 双双起跳
    addBeam(v);
    spawnHearts(mid.x, mid.y - 60, 12);
    showBubble(ea, `❤ 灵魂契合 ${v.resonance.score} 分！`, 3400);
    if (v.resonance.line) showBubble(eb, v.resonance.line, 3400);
    for (const env of speakers) {
      env.img.classList.add("jump");
      setTimeout(() => env.img.classList.remove("jump"), 900);
    }
    await delay(3600);
    if (gone()) return;

    // 从此结伴在广场上漫游（新的配对会替换旧同伴）
    couple(ea, eb);
    ea.busy = eb.busy = false;
  }

  // ── 真实后端接入：轮询 /api/worlds，检测「刚发生的配对」并即时开演 ──
  const PairWatch = { seen: Object.create(null), queue: [], busy: false };
  for (const v of registry.visits || []) {
    PairWatch.seen[v.visit_id] = v.pair_count || 1;
    addBeam(v);   // 历史羁绊开屏即连线（Bond 表持久化，后端重启不丢）
  }
  async function pollWorlds() {
    let reg;
    try { reg = await FW.fetchRegistry("."); } catch (e) { return; }   // 网络抖动，下轮再试
    if (reg.source !== "fastapi-live") return;                          // 静态回退无实时性
    // 世界名单变了（手机端捕获了新宠物）→ 重载重建整个广场
    const ids = (ws) => ws.map((x) => x.world_id).join(",");
    if (ids(reg.worlds) !== ids(registry.worlds)) { location.reload(); return; }
    registry.visits = reg.visits || [];
    for (const v of registry.visits) {
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
  setInterval(pollWorlds, 3000);

  // ── 主循环 ────────────────────────────────────────────────────
  let lastFrame = performance.now();
  (function frame(now) {
    stepEnvoys(now - lastFrame, now);
    stepBeams(now);
    lastFrame = now;
    requestAnimationFrame(frame);
  })(lastFrame);

  // 调试出口
  window.__FW_LIGHT = { envoys, beams, playPairMeet, pollWorlds, cameraTo };
})();
