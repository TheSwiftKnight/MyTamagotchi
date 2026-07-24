"""世界演化引擎（FastAPI 版）：对齐原 Node world-engine 的 WorldState 形状，
但事件由真实 agent + LLM 生成，并写回 agent 记忆。"""

import asyncio
import json
import random
from datetime import datetime, timezone

from sqlmodel import Session, select

from . import llm
from .models import Agent, Memory, Skill, User, WorldEventRow, WorldMeta, now

TICK_MINUTES = 30

ERAS = [(80, "活档案纪元", 5), (40, "复调时代", 4), (20, "城邦晨光", 3), (8, "编织纪元", 2), (0, "采集纪元", 1)]

WORLD_NAME = {"everyday": "Memory Town", "stardom": "Stardom", "future": "Future Colony"}
LOCATIONS = {
    "everyday": ["记忆咖啡馆", "小广场", "邮筒旁", "花园长椅"],
    "stardom": ["霓虹舞台", "后台休息室", "星光大道"],
    "future": ["湖畔观测站", "温室穹顶", "数据水井"],
}
EVENT_TYPES = ["ritual", "discovery", "debate", "invention", "festival", "repair"]

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
        "role": profile.get("role") or a.category,
        "world": WORLD_NAME.get(a.world, a.world),
        "color": "#E8634A",
        "location": random.Random(a.id).choice(LOCATIONS.get(a.world, ["小广场"])),
        "goal": profile.get("goal") or f"陪伴主人，做一只快乐的{a.category}",
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


async def _commit_with_retry(session: Session, attempts: int = 6) -> None:
    """SQLite 写提交带退避重试：即便偶发 BUSY 也不至于 500。"""
    from sqlalchemy.exc import OperationalError
    for i in range(attempts):
        try:
            session.commit()
            return
        except OperationalError:
            session.rollback()
            if i == attempts - 1:
                raise
            await asyncio.sleep(0.3)


async def run_tick(session: Session, steps: int = 1) -> dict:
    async with _tick_lock:
        steps = max(1, min(5, steps))
        for _ in range(steps):
            await _generate_event(session)
        return build_state(session)


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
        await _commit_with_retry(session)
        return

    world_key = random.choice([a.world for a in agents])
    pool = [a for a in agents if a.world == world_key] or agents
    participants = random.sample(pool, min(len(pool), random.choice([2, 2, 3])))
    location = random.choice(LOCATIONS.get(world_key, ["小广场"]))
    etype = random.choice(EVENT_TYPES)
    # rollback 后 ORM 对象会过期，先把要用的字段抓成纯数据
    p_data = [(a.id, a.name, a.category, a.trait, a.mood) for a in participants]
    brief = "\n".join(
        f"agent-{pid}: {pname}（{pcat}，性格：{ptrait}，心情：{_mood_word(pmood)}）"
        for pid, pname, pcat, ptrait, pmood in p_data
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
    await _commit_with_retry(session)


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
