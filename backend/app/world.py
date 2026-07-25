"""世界演化引擎（FastAPI 版）：对齐原 Node world-engine 的 WorldState 形状，
但事件由真实 agent + LLM 生成，并写回 agent 记忆。"""

import asyncio
import json
import random
from datetime import datetime, timezone

from sqlmodel import Session, select

from . import llm
from .db import commit_with_retry
from .models import Agent, Bond, Memory, Skill, User, WorldEventRow, WorldMeta, now

TICK_MINUTES = 30

ERAS = [(80, "活档案纪元", 5), (40, "复调时代", 4), (20, "城邦晨光", 3), (8, "编织纪元", 2), (0, "采集纪元", 1)]

WORLD_NAME = {
    "vitality-gym-town": "Vitality Gym Town",
    "learning-commons": "Learning Commons",
    "maker-harbor": "Maker Harbor",
    "plaza": "Public Plaza",
}
LOCATIONS = {
    "vitality-gym-town": ["脉搏健身房", "小广场", "补水站", "花园长椅"],
    "learning-commons": ["开放教室", "图书角", "同伴讲台"],
    "maker-harbor": ["创想工坊", "材料回收站", "原型试验台"],
    "plaza": ["同心广场", "喷泉旁", "技能锻造台"],
}
EVENT_TYPES = ["ritual", "discovery", "debate", "invention", "festival", "repair"]

# 羁绊活动：二维码配对过的两只 agent 的专属事件（visit 串门 / coop 合作用技能
# / hangout 约玩 / gift 送礼）。tick 时若存在羁绊，有 BOND_EVENT_P 概率走这条线。
BOND_EVENT_TYPES = {
    "visit": "一方去另一方的世界串门做客",
    "coop": "两人合作用彼此的技能做一件小事",
    "hangout": "约着在某个角落闲逛聊天",
    "gift": "一方给另一方准备了一份小礼物",
}
BOND_EVENT_P = 0.4

MOOD_WORDS = [(75, "愉快"), (50, "平静"), (30, "有点低落"), (0, "疲惫")]


def _mood_word(m: int) -> str:
    return next(w for t, w in MOOD_WORDS if m >= t)


def get_meta(session: Session) -> WorldMeta:
    meta = session.exec(select(WorldMeta)).first()
    if not meta:
        meta = WorldMeta()
        session.add(meta)
        session.commit()
        session.refresh(meta)
    return meta


def _era(tick: int) -> tuple[str, int]:
    for threshold, name, num in ERAS:
        if tick >= threshold:
            return name, num
    return "采集纪元", 1


def agent_world_view(a: Agent, session: Session) -> dict:
    memories = session.exec(
        select(Memory).where(Memory.agent_id == a.id).order_by(Memory.created_at.desc())
    ).all()[:12]
    profile = {}
    try:
        profile = json.loads(a.profile) if a.profile else {}
    except Exception:
        pass
    return {
        "id": f"agent-{a.id}",
        "name": a.name,
        "role": profile.get("role") or "伙伴",
        "world": WORLD_NAME.get(a.location, a.location),
        "color": "#E8634A",
        "location": random.Random(a.id).choice(LOCATIONS.get(a.location, ["小广场"])),
        "goal": profile.get("goal") or "陪伴主人，做一只快乐的小伙伴",
        "mood": _mood_word(a.mood),
        "energy": a.mood,
        "personalityVersion": 1,
        "lastActiveTick": 0,
        "memories": [
            {"id": f"mem-{m.id}", "tick": 0, "type": "episodic", "text": m.content,
             "importance": 3, "emotion": "平静", "participants": []}
            for m in memories
        ],
        "reflections": [],
        "relationships": {},
    }


def _event_out(e: WorldEventRow) -> dict:
    return {
        "id": f"event-{e.id:04d}",
        "tick": e.tick, "day": e.day, "minute": e.minute,
        "type": e.type, "location": e.location,
        "title": e.title, "summary": e.summary,
        "participants": json.loads(e.participants),
        "dialogue": json.loads(e.dialogue),
        "consequence": e.consequence,
        "createdAt": e.created_at.isoformat() if e.created_at else "",
    }


def build_state(session: Session) -> dict:
    meta = get_meta(session)
    era, era_num = _era(meta.tick)
    agents = session.exec(select(Agent)).all()
    events = session.exec(select(WorldEventRow).order_by(WorldEventRow.id.desc())).all()[:40]
    metrics = json.loads(meta.metrics)
    skills_count = len(session.exec(select(Skill)).all())
    discoveries = [
        {"tick": e.tick, "title": e.title, "text": e.summary}
        for e in events if e.type in ("discovery", "invention")
    ][:6]
    milestones = [
        {"tick": e.tick, "title": e.title, "text": e.consequence}
        for e in events if e.type == "festival"
    ][:6]
    return {
        "meta": {
            "version": 2,
            "status": meta.status,
            "tick": meta.tick,
            "day": meta.day,
            "minute": meta.minute,
            "era": era,
            "eraNumber": era_num,
            "startedAt": meta.started_at.isoformat() if meta.started_at else "",
            "lastTickAt": meta.last_tick_at.isoformat() if meta.last_tick_at else None,
            "narrativeMode": "llm",
        },
        "civilization": {
            "name": "ForkWorld Commons",
            "stage": era,
            "credo": "每个小物件，都有鲜明人格。",
            "values": ["陪伴", "好奇", "共创"],
            "metrics": metrics,
            "resources": {"记忆": sum(len(json.loads(e.participants)) for e in events),
                          "技能": skills_count, "羁绊": max(0, len(events) * 2)},
            "institutions": [],
            "discoveries": discoveries,
            "milestones": milestones,
            "tensions": [],
        },
        "agents": [agent_world_view(a, session) for a in agents],
        "events": [_event_out(e) for e in events],
    }


_tick_lock = asyncio.Lock()


async def run_tick(session: Session, steps: int = 1) -> dict:
    async with _tick_lock:
        steps = max(1, min(5, steps))
        for _ in range(steps):
            # 有羁绊时按概率安排羁绊活动，否则走随机世界事件（原行为不变）
            bond_ids = session.exec(select(Bond.id)).all()
            session.rollback()
            if bond_ids and random.random() < BOND_EVENT_P:
                await run_bond_activity(session)
            else:
                await _generate_event(session)
        return build_state(session)


async def run_bond_activity_locked(session: Session, bond_id: int | None = None) -> dict | None:
    """API 手动触发用：拿 tick 锁再跑，避免与自动 tick 并发写。"""
    async with _tick_lock:
        return await run_bond_activity(session, bond_id)


async def run_bond_activity(session: Session, bond_id: int | None = None) -> dict | None:
    """为一对有羁绊的 agent 生成一次专属活动（串门/合作/约玩/送礼）。

    锁纪律与 _generate_event 完全一致：读快照 → rollback → 不持锁调 LLM → 短写。
    bond_id 为空时取「最久没活动」的一对，保证每对都轮得到。
    返回事件 dict（_event_out 形状），无羁绊时返回 None。
    """
    # ── PHASE 1：只读构造 prompt ──
    if bond_id is not None:
        bond = session.get(Bond, bond_id)
    else:
        bond = session.exec(select(Bond).order_by(Bond.last_activity_at)).first()
    if not bond:
        session.rollback()
        return None
    a = session.get(Agent, bond.agent_a)
    b = session.get(Agent, bond.agent_b)
    if not a or not b:
        session.rollback()
        return None
    a_skills = [s.name for s in session.exec(select(Skill).where(Skill.agent_id == a.id)).all()]
    b_skills = [s.name for s in session.exec(select(Skill).where(Skill.agent_id == b.id)).all()]
    etype, edesc = random.choice(list(BOND_EVENT_TYPES.items()))
    host = random.choice([a, b])                       # 串门去谁家 / 活动发生在谁的世界
    location = random.choice(LOCATIONS.get(host.location, ["小广场"]))
    p_data = [(x.id, x.name, x.trait, sk)
              for x, sk in ((a, a_skills), (b, b_skills))]
    bond_ctx = (f"两人通过「镜头前合影配对」结为伙伴，已相遇{bond.pair_count}次，"
                f"灵魂契合度{bond.score}（{bond.reason}），他们的共同话题：{bond.topic or '未知'}")
    bond_key = bond.id
    session.rollback()   # ★ 释放读快照——LLM 期间不持任何锁

    # ── PHASE 2：慢 LLM，不碰 DB ──
    brief = "\n".join(
        f"agent-{pid}: {pname}（性格：{ptrait}，技能：{'、'.join(psk) or '无'}）"
        for pid, pname, ptrait, psk in p_data
    )
    gen = await llm.chat_json([
        {"role": "system", "content": "你是像素小世界的叙事引擎，为一对有羁绊的物品 agent 生成一次专属活动。只输出 JSON。"},
        {"role": "user", "content": (
            f"活动类型：{edesc}；地点：{location}。\n{bond_ctx}\n参与者：\n{brief}\n"
            f"要求：活动要延续他们的契合点与共同话题，台词点到对方的性格/技能细节。\n"
            f'输出 JSON：{{"title": "10字内活动标题", "summary": "40字内摘要", '
            f'"dialogue": [{{"agentId": "agent-数字", "text": "25字内台词"}}]（3-5条，两人轮流）, '
            f'"consequence": "25字内后续影响"}}'
        )},
    ], max_tokens=800)
    if not isinstance(gen, dict):
        (a_id, a_name, *_), (b_id, b_name, *_) = p_data[0], p_data[1]
        gen = {
            "title": f"{location}的小聚",
            "summary": f"{a_name}去找{b_name}玩，两个伙伴在{location}消磨了一下午。",
            "dialogue": [
                {"agentId": f"agent-{a_id}", "text": "上次合影之后就一直想来找你！"},
                {"agentId": f"agent-{b_id}", "text": "来得正好，我们接着上次的话题聊。"},
            ],
            "consequence": "两位伙伴的羁绊加深了。",
        }
    valid_ids = {f"agent-{pid}" for pid, *_ in p_data}
    dialogue = [d for d in gen.get("dialogue", [])
                if isinstance(d, dict) and d.get("agentId") in valid_ids][:5]

    # ── PHASE 3：短写事务 ──
    meta = get_meta(session)
    meta.tick += 1
    meta.minute += TICK_MINUTES
    if meta.minute >= 24 * 60:
        meta.minute -= 24 * 60
        meta.day += 1
    meta.last_tick_at = now()
    row = WorldEventRow(
        tick=meta.tick, day=meta.day, minute=meta.minute,
        type=f"bond_{etype}", location=location,
        title=str(gen.get("title", ""))[:24], summary=str(gen.get("summary", ""))[:80],
        participants=json.dumps(sorted(valid_ids), ensure_ascii=False),
        dialogue=json.dumps(dialogue, ensure_ascii=False),
        consequence=str(gen.get("consequence", ""))[:60],
    )
    session.add(row)
    for pid, pname, *_ in p_data:
        other = p_data[1][1] if pid == p_data[0][0] else p_data[0][1]
        session.add(Memory(agent_id=pid, kind="bond",
                           content=f"[{row.title}] 和{other}：{row.summary}"))
    fresh_bond = session.get(Bond, bond_key)
    if fresh_bond:
        fresh_bond.last_activity_at = now()
        session.add(fresh_bond)
    metrics = json.loads(meta.metrics)
    metrics["cohesion"] = min(100, metrics.get("cohesion", 0) + random.randint(2, 4))
    meta.metrics = json.dumps(metrics)
    session.add(meta)
    await commit_with_retry(session)
    return _event_out(row)


async def _generate_event(session: Session, meta: WorldMeta | None = None) -> None:
    # ── PHASE 1：只读，构造 prompt。读完立刻 rollback 释放快照，绝不持写锁调 LLM ──
    # （旧实现在这里已持写锁，然后 await LLM 几十秒，把 /chat 全挡死 → 掉兜底。）
    meta = get_meta(session)
    agents = session.exec(select(Agent)).all()

    def _advance_clock(m: WorldMeta) -> None:
        m.tick += 1
        m.minute += TICK_MINUTES
        if m.minute >= 24 * 60:
            m.minute -= 24 * 60
            m.day += 1
        m.last_tick_at = now()

    if len(agents) < 2:
        _advance_clock(meta)
        session.add(meta)
        await commit_with_retry(session)
        return
    world_key = random.choice([a.location for a in agents])
    pool = [a for a in agents if a.location == world_key] or agents
    participants = random.sample(pool, min(len(pool), random.choice([2, 2, 3])))
    location = random.choice(LOCATIONS.get(world_key, ["小广场"]))
    etype = random.choice(EVENT_TYPES)
    # rollback 后 ORM 对象会过期，先把要用的字段抓成纯数据
    p_data = [(a.id, a.name, a.trait, a.mood) for a in participants]
    brief = "\n".join(
        f"agent-{pid}: {pname}（性格：{ptrait}，心情：{_mood_word(pmood)}）"
        for pid, pname, ptrait, pmood in p_data
    )
    session.rollback()   # ★ 释放读快照——下面调 LLM 期间不持任何锁

    # ── PHASE 2：慢 LLM，全程不碰 DB（不持锁）──
    gen = await llm.chat_json([
        {"role": "system", "content": "你是像素小世界的叙事引擎，为几个物品 agent 生成一段小事件。只输出 JSON。"},
        {"role": "user", "content": (
            f"地点：{location}；事件类型：{etype}。参与者：\n{brief}\n"
            f'输出 JSON：{{"title": "10字内事件标题", "summary": "40字内摘要", '
            f'"dialogue": [{{"agentId": "agent-数字", "text": "25字内台词"}}]（3-5条，agentId 只能取参与者）, '
            f'"consequence": "25字内后续影响"}}'
        )},
    ], max_tokens=800)
    if not isinstance(gen, dict):
        (a_id, a_name, *_), (b_id, b_name, *_) = p_data[0], p_data[1]
        gen = {
            "title": f"{location}的偶遇",
            "summary": f"{a_name}和{b_name}在{location}碰面，聊起了各自的主人。",
            "dialogue": [
                {"agentId": f"agent-{a_id}", "text": "今天的风很舒服呀。"},
                {"agentId": f"agent-{b_id}", "text": "是啊，要不要一起散散步？"},
            ],
            "consequence": "两位伙伴的羁绊加深了。",
        }
    valid_ids = {f"agent-{pid}" for pid, *_ in p_data}
    dialogue = [d for d in gen.get("dialogue", [])
                if isinstance(d, dict) and d.get("agentId") in valid_ids][:5]

    # ── PHASE 3：短写事务（带重试）。到这里才拿写锁，耗时 <50ms ──
    meta = get_meta(session)
    _advance_clock(meta)
    row = WorldEventRow(
        tick=meta.tick, day=meta.day, minute=meta.minute,
        type=etype, location=location,
        title=str(gen.get("title", ""))[:24], summary=str(gen.get("summary", ""))[:80],
        participants=json.dumps(sorted(valid_ids), ensure_ascii=False),
        dialogue=json.dumps(dialogue, ensure_ascii=False),
        consequence=str(gen.get("consequence", ""))[:60],
    )
    session.add(row)
    for pid, *_ in p_data:
        session.add(Memory(agent_id=pid, kind="world",
                           content=f"[{row.title}] {row.summary}"))
    metrics = json.loads(meta.metrics)
    bump = {"ritual": "cohesion", "discovery": "knowledge", "debate": "knowledge",
            "invention": "creativity", "festival": "cohesion", "repair": "stewardship"}[etype]
    metrics[bump] = min(100, metrics[bump] + random.randint(1, 3))
    meta.metrics = json.dumps(metrics)
    session.add(meta)
    await commit_with_retry(session)


def reset(session: Session) -> None:
    for e in session.exec(select(WorldEventRow)).all():
        session.delete(e)
    meta = get_meta(session)
    meta.status = "running"
    meta.tick = 0
    meta.day = 1
    meta.minute = 8 * 60
    meta.started_at = now()
    meta.last_tick_at = None
    meta.metrics = '{"cohesion": 52, "knowledge": 48, "creativity": 50, "stewardship": 46}'
    session.add(meta)
    session.commit()
