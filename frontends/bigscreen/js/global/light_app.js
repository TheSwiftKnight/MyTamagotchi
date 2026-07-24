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
  // 现有 Agent 各入住一圈；新增世界可以继续按空房顺序分配。
  registry.worlds.slice(0, RINGS.length).forEach((world, residentIndex) => {
    const ring = RINGS[residentIndex];
    const houseIndex = HOUSES.findIndex((house) => house.ringId === ring.id && house.slot === residentIndex * 3 % ring.capacity);
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
})();
