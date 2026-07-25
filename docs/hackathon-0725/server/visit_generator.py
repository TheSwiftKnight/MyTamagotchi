#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
visit_generator —— 「世界互访」互访游记 + 灵魂契合生成组件

对应架构文档碰一碰时序里的两次 LLM 调用：
  Call 1（互访游记）×2 双向：访客画像 + 主人世界元素 → 地标气泡评论 + 游记正文
  Call 2（灵魂契合）×1：两份世界元素 → 契合度 + 共鸣解释 + 破冰话题 + 硬件指令

隐私红线（继承产品方案）：输出只引用「世界元素」，不引用画像原文——世界是防火墙。
三次调用并发发起（对齐「碰时生成」策略），用 20~30 秒互访演出动画做延迟掩护。

用法：
    python3 server/visit_generator.py --profile-a p1.json --world-a w1.json \
                                      --profile-b p2.json --world-b w2.json -o visit.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import httpx

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from profile_researcher import _extract_json  # noqa: E402

ZHIPU_CHAT_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
DEFAULT_MODEL = os.getenv("VISIT_LLM_MODEL", "glm-4-plus")

LED_PATTERNS = ("breath", "pulse", "calm")

TRAVELOGUE_PROMPT = """你是「世界互访」的使者——主人派你去参观另一个人的世界，回来后向主人汇报。

给你：访客（你主人）的画像，和你参观的世界的元素。
要求：
1. 只输出一个 JSON 对象，不要输出任何其他文字、不要用 markdown 代码块包裹。
2. 你的评论只能引用「对方世界的元素」（地标、居民、气候、气质）和你主人画像里的视角，
   禁止泄露主人画像里的具体个人信息（公司名、真名、网址等）——世界就是防火墙。
3. 语气：像一个有灵气的旅人，看到什么说什么，有感受、有联想，不吹捧、不尴尬。
4. JSON 结构：
{
  "bubbles": [{"slot": 0, "text": "走到这个地标前说的一句话，≤15字"}],
  "travelogue": "给主人的完整游记，≤150字，第一人称，要提到最打动你的1~2个地标"
}
5. bubbles 数量与地标数量一致，slot 与地标的 slot 一一对应。"""

RESONANCE_PROMPT = """你是「世界互访」的灵魂契合判官。给你两个人各自创造的世界，
你要判断这两个世界的「共鸣度」——不是看标签相不相同，而是看两个世界的气质深处
有没有同一种东西。

要求：
1. 只输出一个 JSON 对象，不要输出任何其他文字、不要用 markdown 代码块包裹。
2. 只引用两个世界的元素，不臆造世界之外的信息。
3. 共鸣解释要具体：指出哪两个元素遥相呼应，而不是「你们都很有趣」。
4. JSON 结构：
{
  "score": 0到100的整数,
  "line": "一句话共鸣解释，≤40字，格式参考：『你们的世界都把XX放在最显眼的位置』",
  "opener": "值得聊的那件事：给两人一个具体的破冰话题，≤30字",
  "hardware_feedback": {
    "led_rgb": "#RRGGBB，契合度越高越暖（高分橙金，中分青蓝，低分月白）",
    "pattern": "breath（高分同频呼吸）| pulse（中分轻脉冲）| calm（低分平缓）"
  }
}
5. score 要有区分度：明显的深共鸣才给 80+；只是领域相同给 50~70；气质相冲给 50 以下。"""


def _llm_call(system: str, user: str, model: str = DEFAULT_MODEL) -> dict:
    api_key = os.getenv("ZHIPU_API_KEY")
    if not api_key:
        raise RuntimeError("缺少环境变量 ZHIPU_API_KEY")
    last_err: Exception | None = None
    for _ in range(2):  # 失败重试 1 次（对齐架构文档策略）
        try:
            resp = httpx.post(
                ZHIPU_CHAT_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": 0.4,
                    "response_format": {"type": "json_object"},
                },
                timeout=60.0,
            )
            resp.raise_for_status()
            return _extract_json(resp.json()["choices"][0]["message"]["content"])
        except Exception as e:  # noqa: BLE001
            last_err = e
    raise RuntimeError(f"LLM 调用失败（重试1次后仍失败）：{last_err}")


def _world_brief(world: dict) -> str:
    return json.dumps(world, ensure_ascii=False)


def _profile_brief(profile: dict) -> str:
    return json.dumps(
        {k: profile.get(k) for k in ("one_liner", "intro", "tags", "personality")},
        ensure_ascii=False,
    )


def validate_travelogue(result: dict, world: dict) -> list[str]:
    errors = []
    bubbles = result.get("bubbles", [])
    slots = {lm.get("slot") for lm in world.get("landmarks", [])}
    if {b.get("slot") for b in bubbles} != slots:
        errors.append(f"bubbles 的 slot 与地标不对应: {[b.get('slot') for b in bubbles]} vs {sorted(slots)}")
    for b in bubbles:
        if len(b.get("text", "")) > 15:
            errors.append(f"气泡超长({len(b['text'])}字): {b['text']!r}")
    if len(result.get("travelogue", "")) > 160:
        errors.append(f"游记超长({len(result['travelogue'])}字)")
    return errors


def validate_resonance(result: dict) -> list[str]:
    errors = []
    score = result.get("score")
    if not isinstance(score, int) or not (0 <= score <= 100):
        errors.append(f"score 非法: {score!r}")
    for field in ("line", "opener"):
        if not result.get(field):
            errors.append(f"{field} 缺失")
    hw = result.get("hardware_feedback", {})
    if hw.get("pattern") not in LED_PATTERNS:
        errors.append(f"led pattern 非法: {hw.get('pattern')!r}")
    rgb = hw.get("led_rgb", "")
    if not (isinstance(rgb, str) and rgb.startswith("#") and len(rgb) == 7):
        errors.append(f"led_rgb 非法: {rgb!r}")
    return errors


def _normalize(result: dict) -> dict:
    """宽容归一化常见偏差：实测 GLM 会把 led_rgb 输出成 'FF8C00'（缺 #）。"""
    hw = result.get("hardware_feedback")
    if isinstance(hw, dict):
        rgb = hw.get("led_rgb")
        if isinstance(rgb, str) and len(rgb) == 6 and not rgb.startswith("#"):
            hw["led_rgb"] = "#" + rgb
    return result


def generate_visit(profile_a: dict, world_a: dict, profile_b: dict, world_b: dict) -> dict:
    """三次 LLM 调用并发：双向游记 + 契合。返回完整 VisitResult。

    对齐架构文档时序第 6 步：校验失败重试 1 次，再失败抛给上层取 20 组兜底。
    """
    t0 = time.time()
    travelogue_a = travelogue_b = resonance = None
    errors: list[str] = []
    for _ in range(2):
        with ThreadPoolExecutor(max_workers=3) as pool:
            fut_ta = pool.submit(
                _llm_call, TRAVELOGUE_PROMPT,
                f"你主人的画像：{_profile_brief(profile_a)}\n\n你参观的世界：{_world_brief(world_b)}")
            fut_tb = pool.submit(
                _llm_call, TRAVELOGUE_PROMPT,
                f"你主人的画像：{_profile_brief(profile_b)}\n\n你参观的世界：{_world_brief(world_a)}")
            fut_res = pool.submit(
                _llm_call, RESONANCE_PROMPT,
                f"世界甲：{_world_brief(world_a)}\n\n世界乙：{_world_brief(world_b)}")

            travelogue_a = fut_ta.result()  # A 的使者从 B 的世界回来
            travelogue_b = fut_tb.result()
            resonance = _normalize(fut_res.result())

        errors = (validate_travelogue(travelogue_a, world_b)
                  + validate_travelogue(travelogue_b, world_a)
                  + validate_resonance(resonance))
        if not errors:
            break
    if errors:
        raise ValueError("VisitResult 校验失败（重试1次后仍失败）: " + "; ".join(errors))

    resonance["hardware_feedback"]["epoch_ms"] = int(time.time() * 1000)
    return {
        "travelogue_a": travelogue_a,
        "travelogue_b": travelogue_b,
        "resonance": resonance,
        "elapsed_s": round(time.time() - t0, 1),
    }


def render_text(visit: dict, name_a: str = "A", name_b: str = "B") -> str:
    r = visit["resonance"]
    lines = [
        f"⏱ 三次 LLM 并发总耗时: {visit['elapsed_s']}s",
        f"💞 灵魂契合度: {r['score']} —— {r['line']}",
        f"🗣 值得聊的那件事: {r['opener']}",
        f"💡 硬件指令: {r['hardware_feedback']['led_rgb']} / {r['hardware_feedback']['pattern']}",
        "",
        f"📜 {name_a} 的使者从 {name_b} 的世界回来:",
        visit["travelogue_a"]["travelogue"],
        f"   气泡: {' / '.join(b['text'] for b in visit['travelogue_a']['bubbles'])}",
        "",
        f"📜 {name_b} 的使者从 {name_a} 的世界回来:",
        visit["travelogue_b"]["travelogue"],
        f"   气泡: {' / '.join(b['text'] for b in visit['travelogue_b']['bubbles'])}",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="两份画像+世界 → 互访游记 + 灵魂契合")
    parser.add_argument("--profile-a", required=True)
    parser.add_argument("--world-a", required=True)
    parser.add_argument("--profile-b", required=True)
    parser.add_argument("--world-b", required=True)
    parser.add_argument("-o", "--output")
    args = parser.parse_args()

    load = lambda p: json.load(open(p, encoding="utf-8"))  # noqa: E731
    pa, wa = load(args.profile_a), load(args.world_a)
    pb, wb = load(args.profile_b), load(args.world_b)

    visit = generate_visit(pa, wa, pb, wb)
    print(render_text(visit, wa["world_name"], wb["world_name"]))
    print("\n--- JSON ---")
    print(json.dumps(visit, ensure_ascii=False, indent=2))

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(visit, f, ensure_ascii=False, indent=2)
        print(f"\n已写入 {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
