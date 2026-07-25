"""visit_to_master_movement.py — VisitResult → 斯坦福 demo 前端 master_movement.json 转换器

把「世界互访」冻结契约(contracts/visit_result.schema.json)的访问结果,
转成斯坦福 generative_agents demo 前端可直接播放的 master_movement.json。
产物放到 environment/frontend_server/compressed_storage/<sim_code>/ 下,
即可用 http://localhost:8100/demo/<sim_code>/1/3/ 播放整场使者访问演出。

用法:
    python visit_to_master_movement.py visit_result.json world.json <sim_code> [--out <compressed_storage目录>]

说明:
- 地标 slot → 地图 tile 坐标的映射由 world.json 的 landmarks[].slot 配合
  本文件的 SLOT_TILES 给出(正式版应从 Tiled 地图的对象层导出,见文件尾)。
- 人物名必须是 static_dirs/assets/characters/ 里已有素材的名字(空格分隔),
  自制使者皮肤出图后改名即可,加载是模板循环自动完成的,零代码改动。
"""

import argparse
import json
import math
import os

# ---- 演出参数 -------------------------------------------------------------
WALK_STEPS_PER_TILE = 1      # 每步挪 1 tile(与原版 movement 语义一致)
BUBBLE_PAUSE_STEPS = 4       # 到每个地标停留几步(气泡展示时长)
SEC_PER_STEP = 10            # meta.json 字段,demo 页时钟用,不影响播放速度

# 使者/主人初始位置与地标槽位坐标(the_ville 地图 140x100,演示占位值。
# 正式版:从 Tiled 世界模板地图的对象层按 slot 导出。)
ENTRANCE_TILE = [58, 64]
HOST_HOME_TILE = [73, 14]
SLOT_TILES = {
    0: [73, 14],
    1: [80, 30],
    2: [62, 48],
    3: [90, 58],
    4: [110, 42],
    5: [127, 46],
}

# 默认人物(素材已存在于 assets/characters/;正式版替换为使者 IP 皮肤)
DEFAULT_ENVOY = "Klaus Mueller"
DEFAULT_HOST = "Isabella Rodriguez"


def _walk_steps(frm, to):
    """从 frm 到 to 的逐格路径(Chebyshev 距离,每步 1 格,返回含终点的坐标序列)。"""
    path = []
    x, y = frm
    tx, ty = to
    while (x, y) != (tx, ty):
        x += 0 if tx == x else (1 if tx > x else -1)
        y += 0 if ty == y else (1 if ty > y else -1)
        path.append([x, y])
    return path


def build_master_movement(visit_result, world, envoy_name=DEFAULT_ENVOY,
                          host_name=DEFAULT_HOST):
    """把 visit_result(contracts/visit_result.schema.json)+ world 转成
    {step_str: {persona_name: {movement, pronunciatio, description, chat}}}。"""
    world_name = world.get("world_name", "对方的世界")
    bubbles = {b["slot"]: b["text"]
               for b in visit_result["travelogue_a"]["bubbles"]}
    resonance_line = visit_result["resonance"]["line"]

    steps = {}        # step -> {envoy: {...}, host: {...}}
    step = 0
    pos = list(ENTRANCE_TILE)

    def put(envoy_tile, pron, desc, chat, host_pron="🏠", host_chat=None):
        nonlocal step
        steps[str(step)] = {
            envoy_name: {"movement": envoy_tile, "pronunciatio": pron,
                         "description": desc, "chat": chat},
            host_name: {"movement": HOST_HOME_TILE, "pronunciatio": host_pron,
                        "description": f"在{world_name}里日常 @ {world_name}",
                        "chat": host_chat},
        }
        step += 1

    # 出场:使者站门口
    put(pos, "🚪", f"抵达{world_name} @ {world_name}:入口", None)

    # 逐个地标走过去,到位冒气泡
    for slot in sorted(SLOT_TILES):
        target = SLOT_TILES[slot]
        for tile in _walk_steps(pos, target):
            put(tile, "🚶", f"走向地标 {slot} @ {world_name}", None)
        pos = target
        if slot in bubbles:
            for _ in range(BUBBLE_PAUSE_STEPS):
                put(pos, "💬", f"参观地标 {slot} @ {world_name}",
                    [[envoy_name, bubbles[slot]]])
        else:
            put(pos, "👀", f"参观地标 {slot} @ {world_name}", None)

    # 收尾:回到门口,亮出契合度那句话
    for tile in _walk_steps(pos, ENTRANCE_TILE):
        put(tile, "🚶", f"离开{world_name} @ {world_name}", None)
    for _ in range(BUBBLE_PAUSE_STEPS):
        put(ENTRANCE_TILE, "❤️", f"访问结束 @ {world_name}",
            [[envoy_name, resonance_line]], host_pron="❤️")

    return steps, step


def write_sim(visit_result, world, sim_code, out_dir,
              envoy_name=DEFAULT_ENVOY, host_name=DEFAULT_HOST):
    movements, last_step = build_master_movement(
        visit_result, world, envoy_name, host_name)
    sim_dir = os.path.join(out_dir, sim_code)
    os.makedirs(sim_dir, exist_ok=True)

    # step 0 必须包含全部人物(demo 视图从这里枚举 persona_names)
    with open(os.path.join(sim_dir, "master_movement.json"), "w") as f:
        json.dump(movements, f, ensure_ascii=False, indent=1)
    meta = {
        "fork_sim_code": "",
        "start_date": "July 23, 2026",
        "curr_time": "July 23, 2026, 12:00:00",
        "sec_per_step": SEC_PER_STEP,
        "maze_name": "the_ville",
        "persona_names": [envoy_name, host_name],
        "step": last_step - 1,
    }
    with open(os.path.join(sim_dir, "meta.json"), "w") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    return sim_dir, last_step


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("visit_result")
    ap.add_argument("world")
    ap.add_argument("sim_code")
    ap.add_argument("--out", default=os.path.join(
        os.path.dirname(__file__), "..", "generative_agents",
        "environment", "frontend_server", "compressed_storage"))
    args = ap.parse_args()

    with open(args.visit_result) as f:
        vr = json.load(f)
    with open(args.world) as f:
        wd = json.load(f)
    sim_dir, n = write_sim(vr, wd, args.sim_code, args.out)
    print(f"OK: {sim_dir}  共 {n} 步")
    print(f"播放: http://localhost:8100/demo/{args.sim_code}/1/3/")
