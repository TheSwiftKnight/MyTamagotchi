/* ForkWorld 数据层 —— 加载 worlds.json 注册表并建索引。
 * 正式版把 fetch 目标换成后端 GET /worlds 即可，数据结构同构。 */
window.FW = window.FW || {};

// 后端注册表接口；不可达（网络错/非 200）时回退本地静态 worlds.json，离线也能跑。
// 依页面 hostname 推导而非写死 localhost：大屏常在另一台机器投屏打开，
// 写死 localhost 会去连那台机器自己。file:// 直开时 hostname 为空，退回 127.0.0.1。
FW.API_BASE = location.hostname
  ? `${location.protocol}//${location.hostname}:8000`
  : "http://127.0.0.1:8000";
FW.API_URL = FW.API_BASE + "/api/worlds";

FW.fetchRegistry = async function (base) {
  // 1) 优先后端
  try {
    const r = await fetch(FW.API_URL, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } catch (e) {
    // 2) 回退本地（与旧行为一致：带时间戳破缓存）
    console.warn("[FW] 后端不可用，回退本地 worlds.json：", e && e.message);
    const r = await fetch(base + "/data/worlds.json?v=" + Date.now());
    if (!r.ok) throw new Error("worlds.json HTTP " + r.status);
    return await r.json();
  }
};

FW.loadData = async function (base) {
  base = base || ".";
  const reg = await FW.fetchRegistry(base);
  const byId = {};
  for (const w of reg.worlds) byId[w.world_id] = w;
  reg.byId = byId;
  // 每个世界参与的互访
  for (const w of reg.worlds) w._visits = [];
  for (const v of reg.visits || []) {
    if (byId[v.from]) byId[v.from]._visits.push(v);
    if (byId[v.to]) byId[v.to]._visits.push(v);
  }
  return reg;
};

/* Chebyshev 逐格直线路径（与 server/visit_to_master_movement.py 的 _walk_steps 一致） */
FW.walkSteps = function (frm, to) {
  const path = [];
  let [x, y] = frm;
  const [tx, ty] = to;
  while (x !== tx || y !== ty) {
    x += x === tx ? 0 : (tx > x ? 1 : -1);
    y += y === ty ? 0 : (ty > y ? 1 : -1);
    path.push([x, y]);
  }
  return path;
};
