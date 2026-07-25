#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
world_generator —— 「世界互访」世界生成组件

输入画像 JSON（profile_researcher 的产物），生成世界元素 JSON（WorldJSON）。
这是终版头号风险「世界生成质量不稳定」的核心防线，策略对齐产品方案：
  - 地标只做「30 种预制类型选 N + 命名」，禁止自由生成贴图类型
  - Prompt 内置 3 个 few-shot 精修范例
  - 输出过 schema 校验，失败重试 1 次

用法：
    python3 server/world_generator.py <url>                    # URL → 画像 → 世界
    python3 server/world_generator.py --profile profile.json   # 直接用已有画像
    python3 server/world_generator.py --profile p.json -o world.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import httpx

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from profile_researcher import research, _extract_json  # noqa: E402

ZHIPU_CHAT_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
# A/B 实测：glm-4-flash 产出全是标签直译的「正确的废话」；
# glm-4-plus 能出有梗的世界（「企鹅守护者：只接受开源的代码审查」），且耗时更短。
DEFAULT_MODEL = os.getenv("WORLD_LLM_MODEL", "glm-4-plus")

# 30 种预制地标类型（与美术素材一一对应，D 出素材时以此为清单）
LANDMARK_TYPES = [
    "lab", "shelf", "statue", "garden", "observatory", "workshop",
    "cafe", "library", "lighthouse", "stage", "gym", "kitchen",
    "garage", "greenhouse", "dock", "campfire", "treehouse", "museum",
    "arcade", "studio", "radio_tower", "shrine", "market", "theater",
    "clocktower", "windmill", "pond", "mountain", "tunnel", "archive",
]

SYSTEM_PROMPT = """你是「世界互访」的世界建筑师。给你一个人的画像，你要为他设计一个
能代言他的虚拟小世界——他的朋友会通过参观这个世界来认识他。

严格要求：
1. 只输出一个 JSON 对象，不要输出任何其他文字、不要用 markdown 代码块包裹。
2. 世界要「像这个人」：每个地标必须能从画像的具体事实中找到出处，禁止空泛。
3. 地标类型只能从以下 30 种里选（type 字段原样使用，不要翻译）：
   lab, shelf, statue, garden, observatory, workshop, cafe, library, lighthouse,
   stage, gym, kitchen, garage, greenhouse, dock, campfire, treehouse, museum,
   arcade, studio, radio_tower, shrine, market, theater, clocktower, windmill,
   pond, mountain, tunnel, archive
4. JSON 结构如下：
{
  "world_name": "世界名，≤8个汉字，要有诗意或梗，不要叫『XX的世界』",
  "climate": "这个世界的气候/时间氛围，一句话，≤20字",
  "temperament": "这个世界的气质，一句话，≤20字",
  "landmarks": [
    {"type": "30种之一", "name": "地标名，≤12字，要具体有画面感", "from": "出处：画像里的哪个字段/事实", "slot": 0}
  ],
  "residents": [
    {"name": "居民名", "personality": "一句话性格，≤20字"}
  ]
}
5. landmarks 3~5 个，slot 从 0 开始递增；residents 1~2 个。
6. 画像信息稀薄时，宁可少放地标，也不要编造主人没有的经历。

范例 1：
画像：嵌入式工程师，喜欢 side project，家里有 47 个烂尾项目，第一块点亮的开发板对他意义非凡
输出：{"world_name": "熬夜实验室", "climate": "常年凌晨三点，星光很好", "temperament": "安静但门永远开着", "landmarks": [{"type": "lab", "name": "通宵亮灯的实验室", "from": "职业:嵌入式工程师", "slot": 0}, {"type": "shelf", "name": "堆着47个烂尾项目的架子", "from": "兴趣:side project", "slot": 1}, {"type": "statue", "name": "第一块开发板纪念碑", "from": "经历:第一块点亮的开发板", "slot": 2}], "residents": [{"name": "看门的猫", "personality": "替主人挡掉无聊的访客"}]}

范例 2：
画像：独立插画师，养了满阳台多肉，接稿养活自己，梦想是开一间只卖自己喜欢的书的店
输出：{"world_name": "多肉银行", "climate": "下午四点的阳光永远斜照", "temperament": "慢吞吞，但每片叶子都被照顾到", "landmarks": [{"type": "greenhouse", "name": "三百盆多肉的玻璃房", "from": "事实:满阳台多肉", "slot": 0}, {"type": "studio", "name": "堆满草稿的接稿画桌", "from": "职业:独立插画师", "slot": 1}, {"type": "market", "name": "只卖喜欢的书的空想书店", "from": "梦想:开书店", "slot": 2}], "residents": [{"name": "住在花盆里的蜗牛", "personality": "移动速度比截稿日还稳"}]}

范例 3：
画像：马拉松爱好者，白天是会计，周末跑山野，完赛奖牌挂满一面墙
输出：{"world_name": "四点半天亮前", "climate": "永远是需要头灯的清晨", "temperament": "数字归数字，山归山", "landmarks": [{"type": "archive", "name": "挂满完赛奖牌的墙", "from": "事实:奖牌挂满一面墙", "slot": 0}, {"type": "mountain", "name": "周末专属的训练野径", "from": "爱好:周末跑山野", "slot": 1}, {"type": "library", "name": "码着账本和跑表的书房", "from": "职业:会计", "slot": 2}], "residents": [{"name": "配速员兔子", "personality": "从不回头看掉队的人"}]}"""


def validate_world(world: dict) -> list[str]:
    """按冻结的 WorldJSON 契约校验，返回错误列表（空 = 通过）。"""
    errors = []
    name = world.get("world_name", "")
    if not name or len(name) > 8:
        errors.append(f"world_name 缺失或超长({len(name)}字): {name!r}")
    for field in ("climate", "temperament"):
        if not world.get(field):
            errors.append(f"{field} 缺失")
    landmarks = world.get("landmarks", [])
    if not (1 <= len(landmarks) <= 6):
        errors.append(f"landmarks 数量异常: {len(landmarks)}")
    for i, lm in enumerate(landmarks):
        if lm.get("type") not in LANDMARK_TYPES:
            errors.append(f"landmarks[{i}].type 不在 30 种之内: {lm.get('type')!r}")
        if not lm.get("name") or len(lm.get("name", "")) > 12:
            errors.append(f"landmarks[{i}].name 缺失或超长: {lm.get('name')!r}")
        if not lm.get("from"):
            errors.append(f"landmarks[{i}].from 缺失（无法溯源画像）")
    if not world.get("residents"):
        errors.append("residents 缺失")
    return errors


def generate_world(profile: dict, model: str = DEFAULT_MODEL) -> dict:
    """画像 → WorldJSON。schema 校验失败重试 1 次（对齐架构文档策略）。"""
    api_key = os.getenv("ZHIPU_API_KEY")
    if not api_key:
        raise RuntimeError("缺少环境变量 ZHIPU_API_KEY")

    profile_brief = json.dumps(
        {k: profile.get(k) for k in
         ("name", "title", "one_liner", "intro", "tags", "skills_or_works", "personality", "facts")},
        ensure_ascii=False,
    )
    last_err: Exception | None = None
    for attempt in range(2):
        try:
            resp = httpx.post(
                ZHIPU_CHAT_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": f"画像：{profile_brief}"},
                    ],
                    "temperature": 0.3,
                    "response_format": {"type": "json_object"},
                },
                timeout=60.0,
            )
            resp.raise_for_status()
            world = _extract_json(resp.json()["choices"][0]["message"]["content"])
            errors = validate_world(world)
            if not errors:
                return world
            last_err = ValueError("schema 校验失败: " + "; ".join(errors))
        except Exception as e:  # noqa: BLE001
            last_err = e
    raise RuntimeError(f"世界生成失败（重试1次后仍失败）：{last_err}")


def render_text(world: dict) -> str:
    lines = [
        f"🌍 {world['world_name']}",
        f"   气候：{world['climate']}",
        f"   气质：{world['temperament']}",
        "   地标：",
    ]
    lines += [f"     [{lm['type']}] {lm['name']}（出自：{lm['from']}）" for lm in world["landmarks"]]
    lines.append("   居民：")
    lines += [f"     {r['name']} —— {r['personality']}" for r in world["residents"]]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="画像 → 世界元素 JSON")
    parser.add_argument("url", nargs="?", help="个人主页 URL（先跑画像再生成世界）")
    parser.add_argument("--profile", help="已有的画像 JSON 文件")
    parser.add_argument("-o", "--output", help="把 WorldJSON 写入文件")
    args = parser.parse_args()

    if args.profile:
        with open(args.profile, encoding="utf-8") as f:
            profile = json.load(f)
    elif args.url:
        profile = research(args.url)
    else:
        parser.error("需要提供 url 或 --profile")

    world = generate_world(profile)
    print(render_text(world))
    print("\n--- JSON ---")
    print(json.dumps(world, ensure_ascii=False, indent=2))

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(world, f, ensure_ascii=False, indent=2)
        print(f"\n已写入 {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
