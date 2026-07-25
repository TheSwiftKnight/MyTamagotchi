/* ForkWorld 数据层 —— 加载 worlds.json 注册表并建索引。
 * 正式版把 fetch 目标换成后端 GET /worlds 即可，数据结构同构。 */
window.FW = window.FW || {};

FW.loadData = async function (base) {
  base = base || ".";
  const reg = await (await fetch(base + "/data/worlds.json?v=" + Date.now())).json();
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
