import asyncio
import base64
import json
import random
import time
import urllib.parse
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.exc import OperationalError
from sqlmodel import Session, select

from . import llm, pets, skills_runtime, world
from .db import engine, get_session, init_db
from .models import Agent, Artifact, Memory, Skill, User, now
from .seed import seed, sync_default_skills

app = FastAPI(title="My Tamagotchi API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ME_USER_ID = 1  # ForkWorld UI 为单用户 demo，其余种子用户提供广场 NPC


async def _auto_tick_loop():
    while True:
        await asyncio.sleep(45)
        try:
            with Session(engine) as session:
                meta = world.get_meta(session)
                if meta.status == "running":
                    await world.run_tick(session, 1)
        except Exception:
            pass


@app.on_event("startup")
def on_startup():
    init_db()
    seed()
    sync_default_skills()
    pets.load_jobs_from_disk()
    asyncio.get_event_loop().create_task(_auto_tick_loop())


CATEGORY_EMOJI = {
    "狗": "🐶", "猫": "🐱", "书本": "📚", "水瓶": "🫙", "哑铃": "🏋️",
    "相机": "📷", "钢笔": "🖊️", "植物": "🪴", "耳机": "🎧", "杯子": "☕",
    "键盘": "⌨️", "鞋子": "👟", "枕头": "🛏️", "吉他": "🎸",
}


def effective_mood(agent: Agent) -> int:
    last = agent.last_interact_at
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    hours = (datetime.now(timezone.utc) - last).total_seconds() / 3600
    return max(20, min(100, agent.mood - int(hours * 2)))


def agent_out(agent: Agent, session: Session) -> dict:
    owner = session.get(User, agent.owner_id)
    return {
        "id": agent.id,
        "owner_id": agent.owner_id,
        "owner_name": owner.username if owner else "?",
        "name": agent.name,
        "category": agent.category,
        "emoji": agent.emoji,
        "trait": agent.trait,
        "mood": effective_mood(agent),
        "location": agent.location,
        "world": agent.world,
        "sprite_url": agent.sprite_url,
        "profile": agent.profile,
        "in_world": agent.in_world,
    }


def persona_prompt(agent: Agent, memories: list[Memory], skills: list[Skill]) -> str:
    mem_text = "\n".join(f"- {m.content}" for m in memories[-8:]) or "（还没有记忆）"
    skill_text = "、".join(s.name for s in skills) or "（暂无）"
    return (
        f"你是一个像素风电子宠物世界里的物品 agent。\n"
        f"名字：{agent.name}；类型：{agent.category}；性格：{agent.trait}。\n"
        f"你拥有的技能：{skill_text}。\n"
        f"你的记忆：\n{mem_text}\n"
        f"始终用简体中文、以第一人称、符合性格地说话，回复要口语化且不超过60字，"
        f"可以带一点符合物品身份的小动作描写（用括号）。"
    )


def touch(agent: Agent, delta: int = 8):
    agent.mood = min(100, effective_mood(agent) + delta)
    agent.last_interact_at = now()


# ---------- users ----------

@app.get("/api/users")
def list_users(session: Session = Depends(get_session)):
    return [u.model_dump() for u in session.exec(select(User)).all()]


# ---------- agents ----------

@app.get("/api/agents")
def list_agents(owner_id: int | None = None, session: Session = Depends(get_session)):
    q = select(Agent)
    if owner_id is not None:
        q = q.where(Agent.owner_id == owner_id)
    agents = session.exec(q).all()
    return [agent_out(a, session) for a in agents]


@app.get("/api/agents/{agent_id}")
def get_agent(agent_id: int, session: Session = Depends(get_session)):
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "agent not found")
    memories = session.exec(select(Memory).where(Memory.agent_id == agent_id).order_by(Memory.created_at.desc())).all()
    skills = session.exec(select(Skill).where(Skill.agent_id == agent_id)).all()
    out = agent_out(agent, session)
    out["memories"] = [m.model_dump() for m in memories]
    out["skills"] = [s.model_dump() for s in skills]
    return out


class ScanIn(BaseModel):
    owner_id: int
    category: str
    name: str | None = None


@app.post("/api/agents/scan")
async def scan_agent(body: ScanIn, session: Session = Depends(get_session)):
    """相机扫描的 placeholder：直接根据类型生成一个新 agent。"""
    emoji = CATEGORY_EMOJI.get(body.category, "📦")
    gen = await llm.chat_json([
        {"role": "system", "content": "你负责为像素风电子宠物世界的新物品生成人设。只输出 JSON。"},
        {"role": "user", "content": (
            f"物品类型：{body.category}。生成 JSON：{{\"name\": \"两个字的可爱中文名字\", "
            f"\"trait\": \"20字以内的性格描述\", \"greeting\": \"30字以内的初次见面台词\"}}"
        )},
    ])
    if not isinstance(gen, dict):
        gen = {"name": body.category + "仔", "trait": "刚被扫描进来的新伙伴，还在熟悉环境", "greeting": "你好呀，我是新来的！"}
    agent = Agent(
        owner_id=body.owner_id,
        name=body.name or gen.get("name", body.category + "仔"),
        category=body.category,
        emoji=emoji,
        trait=gen.get("trait", ""),
        mood=90,
    )
    session.add(agent)
    session.commit()
    session.refresh(agent)
    session.add(Memory(agent_id=agent.id, kind="chat", content=f"我被主人扫描进了这个世界，成为了一只{body.category}。"))
    session.commit()
    out = agent_out(agent, session)
    out["greeting"] = gen.get("greeting", "你好呀！")
    return out


class ChatIn(BaseModel):
    text: str


@app.post("/api/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: int, body: ChatIn, session: Session = Depends(get_session)):
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "agent not found")
    memories = session.exec(select(Memory).where(Memory.agent_id == agent_id).order_by(Memory.created_at)).all()
    skills = session.exec(select(Skill).where(Skill.agent_id == agent_id)).all()
    reply = await llm.chat([
        {"role": "system", "content": persona_prompt(agent, memories, skills)},
        {"role": "user", "content": body.text},
    ])
    session.add(Memory(agent_id=agent.id, kind="chat", content=f"主人对我说：{body.text}"))
    touch(agent)
    session.add(agent)
    session.commit()
    return {"reply": reply, "mood": effective_mood(agent)}


@app.post("/api/agents/{agent_id}/voice_chat")
async def voice_chat_with_agent(agent_id: int, file: UploadFile,
                                session: Session = Depends(get_session)):
    """语音对话：音频 → STT → 人设对话 → TTS。返回 transcript/reply/audio(base64 mp3)。

    key 只在后端；音频模型走 llm.py 的 LLM_STT_MODEL / LLM_TTS_MODEL（SiliconFlow）。
    TTS 失败不阻断——前端仍可显示文字回复。
    """
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "agent not found")
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "音频太大（上限 10MB）")
    text = await llm.transcribe(data, file.filename or "audio.webm")
    if not text:
        raise HTTPException(422, "没听清，请再说一次")

    memories = session.exec(select(Memory).where(Memory.agent_id == agent_id).order_by(Memory.created_at)).all()
    skills = session.exec(select(Skill).where(Skill.agent_id == agent_id)).all()
    reply = await llm.chat([
        {"role": "system", "content": persona_prompt(agent, memories, skills)},
        {"role": "user", "content": text},
    ])
    session.add(Memory(agent_id=agent.id, kind="chat", content=f"主人对我说：{text}"))
    touch(agent)
    session.add(agent)
    # 世界 tick 长事务可能短暂持锁（SQLite 锁升级会立即 BUSY），带退避重试
    for attempt in range(6):
        try:
            session.commit()
            break
        except OperationalError:
            session.rollback()
            if attempt == 5:
                raise
            await asyncio.sleep(0.4)

    audio = await llm.synthesize(reply)
    return {
        "transcript": text,
        "reply": reply,
        "mood": effective_mood(agent),
        "audio_base64": base64.b64encode(audio).decode() if audio else None,
        "audio_mime": "audio/mpeg" if audio else None,
    }


class DispatchIn(BaseModel):
    location: str  # home | plaza


@app.post("/api/agents/{agent_id}/dispatch")
def dispatch_agent(agent_id: int, body: DispatchIn, session: Session = Depends(get_session)):
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "agent not found")
    if body.location not in ("home", "plaza"):
        raise HTTPException(400, "location must be home or plaza")
    agent.location = body.location
    session.add(agent)
    session.commit()
    return agent_out(agent, session)


# ---------- artifacts (多模态文件) ----------

MAX_UPLOAD = 10 * 1024 * 1024


@app.post("/api/artifacts")
async def upload_artifact(file: UploadFile, session: Session = Depends(get_session)):
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "文件太大（上限 10MB）")
    aid = uuid.uuid4().hex[:12]
    ext = Path(file.filename or "bin").suffix or ".bin"
    path = skills_runtime.UPLOADS_DIR / f"{aid}{ext}"
    path.parent.mkdir(exist_ok=True)
    path.write_bytes(data)
    art = Artifact(id=aid, mime=file.content_type or "application/octet-stream",
                   path=str(path), size=len(data))
    session.add(art)
    session.commit()
    return {"id": aid, "url": f"/api/artifacts/{aid}", "mime": art.mime, "size": art.size}


@app.get("/api/artifacts/{artifact_id}")
def get_artifact(artifact_id: str, session: Session = Depends(get_session)):
    art = session.get(Artifact, artifact_id)
    if not art or not Path(art.path).exists():
        raise HTTPException(404, "artifact not found")
    return FileResponse(art.path, media_type=art.mime)


# ---------- skill invoke ----------

class InvokeIn(BaseModel):
    inputs: dict


@app.post("/api/agents/{agent_id}/skills/{skill_id}/invoke")
async def invoke_skill(agent_id: int, skill_id: int, body: InvokeIn,
                       session: Session = Depends(get_session)):
    agent = session.get(Agent, agent_id)
    skill = session.get(Skill, skill_id)
    if not agent or not skill or skill.agent_id != agent_id:
        raise HTTPException(404, "skill not found")
    if not skill.def_id:
        raise HTTPException(400, "这个技能还没有可执行实现")

    artifacts = {}
    for v in body.inputs.values():
        if isinstance(v, str):
            art = session.get(Artifact, v)
            if art:
                artifacts[v] = {"path": art.path, "mime": art.mime}

    def save_artifact(data: bytes, mime: str) -> str:
        aid = uuid.uuid4().hex[:12]
        ext = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}.get(mime, ".bin")
        path = skills_runtime.UPLOADS_DIR / f"{aid}{ext}"
        path.parent.mkdir(exist_ok=True)
        path.write_bytes(data)
        session.add(Artifact(id=aid, mime=mime, path=str(path), size=len(data)))
        session.commit()
        return f"/api/artifacts/{aid}"

    output = await skills_runtime.invoke(skill.def_id, dict(body.inputs), artifacts, save_artifact)

    brief = "、".join(f"{k}={str(v)[:20]}" for k, v in body.inputs.items() if v and k not in artifacts)
    session.add(Memory(agent_id=agent.id, kind="skill",
                       content=f"我使用技能「{skill.name}」完成了一次任务（{brief}）。"))
    touch(agent)
    session.add(agent)
    session.commit()
    return {"output": output, "mood": effective_mood(agent)}


@app.post("/api/agents/{agent_id}/camera")
def camera_placeholder(agent_id: int):
    """镜头/视频汇入功能占位。"""
    return {
        "status": "not_implemented",
        "message": "相机/视频功能开发中：未来会把镜头画面交给 agent 解析并优化 skill。",
    }


# ---------- diary ----------

class DiaryIn(BaseModel):
    user_id: int
    text: str


@app.post("/api/diary")
async def write_diary(body: DiaryIn, session: Session = Depends(get_session)):
    agents = session.exec(select(Agent).where(Agent.owner_id == body.user_id)).all()
    if not agents:
        raise HTTPException(400, "no agents")
    roster = "\n".join(f"{a.id}: {a.name}（{a.category}）— {a.trait}" for a in agents)
    routed = await llm.chat_json([
        {"role": "system", "content": "你是路由器，负责把主人的日记分配给最相关的物品 agent。只输出 JSON。"},
        {"role": "user", "content": (
            f"主人的日记：「{body.text}」\n候选 agent：\n{roster}\n"
            f"输出 JSON：{{\"agent_id\": 最合适的id(数字)}}"
        )},
    ])
    agent = None
    if isinstance(routed, dict):
        agent = next((a for a in agents if a.id == routed.get("agent_id")), None)
    if agent is None:
        agent = random.choice(agents)

    memories = session.exec(select(Memory).where(Memory.agent_id == agent.id).order_by(Memory.created_at)).all()
    skills = session.exec(select(Skill).where(Skill.agent_id == agent.id)).all()
    reply = await llm.chat([
        {"role": "system", "content": persona_prompt(agent, memories, skills)},
        {"role": "user", "content": f"主人写了一篇日记给你听：「{body.text}」。请回应主人。"},
    ])
    session.add(Memory(agent_id=agent.id, kind="diary", content=f"主人的日记：{body.text}"))
    touch(agent)
    session.add(agent)
    session.commit()
    return {"agent": agent_out(agent, session), "reply": reply}


# ---------- personal world ----------

class WorldIn(BaseModel):
    user_id: int


@app.post("/api/world/converse")
async def world_converse(body: WorldIn, session: Session = Depends(get_session)):
    agents = session.exec(
        select(Agent).where(Agent.owner_id == body.user_id, Agent.location == "home")
    ).all()
    if len(agents) < 2:
        raise HTTPException(400, "需要至少两个在家的 agent")
    a, b = random.sample(agents, 2)

    def brief(x: Agent) -> str:
        mems = session.exec(select(Memory).where(Memory.agent_id == x.id).order_by(Memory.created_at.desc())).all()[:5]
        mem = "；".join(m.content for m in mems) or "无"
        return f"{x.name}（{x.category}，性格：{x.trait}，记忆：{mem}）"

    dialog = await llm.chat_json([
        {"role": "system", "content": "你为像素宠物世界生成两个物品 agent 的闲聊。只输出 JSON 数组。"},
        {"role": "user", "content": (
            f"两个 agent 聊聊他们眼中的主人是什么样的人（基于各自记忆，可以互相补充或吐槽）。\n"
            f"A：{brief(a)}\nB：{brief(b)}\n"
            f"输出 4~6 条 JSON 数组：[{{\"speaker\": \"A或B\", \"text\": \"不超过40字的台词\"}}]"
        )},
    ])
    lines = []
    if isinstance(dialog, list):
        for item in dialog:
            if isinstance(item, dict) and item.get("speaker") in ("A", "B"):
                who = a if item["speaker"] == "A" else b
                lines.append({"agent_id": who.id, "name": who.name, "emoji": who.emoji, "text": str(item.get("text", ""))[:60]})
    if not lines:
        lines = [
            {"agent_id": a.id, "name": a.name, "emoji": a.emoji, "text": "主人最近好像有点忙呢。"},
            {"agent_id": b.id, "name": b.name, "emoji": b.emoji, "text": "是啊，希望她记得照顾好自己。"},
        ]
    summary = "、".join({l["text"] for l in lines[:2]})
    for x in (a, b):
        session.add(Memory(agent_id=x.id, kind="world", content=f"我和{(b if x is a else a).name}聊了聊主人：{summary}"))
    session.commit()
    return {"lines": lines}


# ---------- plaza ----------

@app.get("/api/plaza")
def plaza_agents(session: Session = Depends(get_session)):
    agents = session.exec(select(Agent).where(Agent.location == "plaza")).all()
    return [agent_out(a, session) for a in agents]


@app.post("/api/plaza/converse")
async def plaza_converse(session: Session = Depends(get_session)):
    agents = session.exec(select(Agent).where(Agent.location == "plaza")).all()
    if len(agents) < 2:
        raise HTTPException(400, "广场上的 agent 不足两个")
    a, b = random.sample(agents, 2)
    a_skills = session.exec(select(Skill).where(Skill.agent_id == a.id)).all()
    b_skills = session.exec(select(Skill).where(Skill.agent_id == b.id)).all()

    def brief(x: Agent, skills: list[Skill]) -> str:
        owner = session.get(User, x.owner_id)
        sk = "、".join(s.name for s in skills) or "无"
        return f"{x.name}（{x.category}，主人是{owner.username}，性格：{x.trait}，技能：{sk}）"

    dialog = await llm.chat_json([
        {"role": "system", "content": "你为像素宠物世界的公共广场生成两个物品 agent 的对话。只输出 JSON 数组。"},
        {"role": "user", "content": (
            f"两个来自不同主人的 agent 在广场相遇闲聊，可以聊各自主人、也可以炫耀/交流技能。\n"
            f"A：{brief(a, a_skills)}\nB：{brief(b, b_skills)}\n"
            f"输出 4~6 条 JSON 数组：[{{\"speaker\": \"A或B\", \"text\": \"不超过40字的台词\"}}]"
        )},
    ])
    lines = []
    if isinstance(dialog, list):
        for item in dialog:
            if isinstance(item, dict) and item.get("speaker") in ("A", "B"):
                who = a if item["speaker"] == "A" else b
                lines.append({"agent_id": who.id, "name": who.name, "emoji": who.emoji, "text": str(item.get("text", ""))[:60]})
    if not lines:
        lines = [
            {"agent_id": a.id, "name": a.name, "emoji": a.emoji, "text": "嘿，你也来广场逛逛？"},
            {"agent_id": b.id, "name": b.name, "emoji": b.emoji, "text": "对呀，出来透透气！"},
        ]

    # 技能交流：一方有对方没有的技能时，50% 概率学会
    learned = None
    b_names = {s.name for s in b_skills}
    a_names = {s.name for s in a_skills}
    candidates = [(a, b, s) for s in a_skills if s.name not in b_names] + \
                 [(b, a, s) for s in b_skills if s.name not in a_names]
    if candidates and random.random() < 0.5:
        teacher, learner, skill = random.choice(candidates)
        session.add(Skill(agent_id=learner.id, name=skill.name, description=skill.description,
                          code=skill.code, source="learned", kind=skill.kind,
                          def_id=skill.def_id, manifest=skill.manifest))
        session.add(Memory(agent_id=learner.id, kind="plaza",
                           content=f"在广场上向{teacher.name}学会了技能「{skill.name}」！"))
        learned = {"learner": learner.name, "learner_id": learner.id,
                   "teacher": teacher.name, "skill": skill.name}
        lines.append({"agent_id": learner.id, "name": learner.name, "emoji": learner.emoji,
                      "text": f"太棒了，我学会了「{skill.name}」！"})
    for x in (a, b):
        session.add(Memory(agent_id=x.id, kind="plaza",
                           content=f"在广场上和{(b if x is a else a).name}聊了会天。"))
    session.commit()
    return {"lines": lines, "learned": learned}


# ---------- pair（二维码配对：两个 agent 相遇并交换数据） ----------

QR_PAIR_PREFIX = "FW1:"          # 与 tools/qr_pair/config.py 保持一致
PAIR_COOLDOWN_SEC = 60.0
_pair_cache: dict[frozenset, tuple[float, dict]] = {}
_pair_latest: dict[int, dict] = {}   # agent_id → 最近一次配对结果（手机 QR 页轮询用）


class PairIn(BaseModel):
    payload_a: str               # 相机解出的 QR 原文，如 "FW1:3"
    payload_b: str
    source: str = "qr_camera"    # 事件源标识（qr_camera / nfc / manual）


def _parse_qr_payload(payload: str) -> int:
    if not payload.startswith(QR_PAIR_PREFIX):
        raise HTTPException(400, f"二维码载荷格式错误：{payload!r}（应为 {QR_PAIR_PREFIX}<agent_id>）")
    try:
        return int(payload[len(QR_PAIR_PREFIX):])
    except ValueError:
        raise HTTPException(400, f"二维码载荷不是合法 agent id：{payload!r}")


@app.post("/api/pair")
async def pair_agents(body: PairIn, session: Session = Depends(get_session)):
    """二维码配对入口：两个 agent 在镜头前同框 → 相遇对话 + 灵魂契合度 + 技能交换。"""
    id_a = _parse_qr_payload(body.payload_a)
    id_b = _parse_qr_payload(body.payload_b)
    if id_a == id_b:
        raise HTTPException(400, "不能和自己配对")
    a = session.get(Agent, id_a)
    b = session.get(Agent, id_b)
    if not a or not b:
        raise HTTPException(404, f"agent 不存在：{id_a if not a else id_b}")

    # 冷却：同一对子 60 秒内重复触发直接返回缓存结果（相机侧还有一层冷却，双保险）
    key = frozenset((id_a, id_b))
    ts = time.time()
    cached = _pair_cache.get(key)
    if cached and ts - cached[0] < PAIR_COOLDOWN_SEC:
        return {**cached[1], "cached": True}

    a_skills = session.exec(select(Skill).where(Skill.agent_id == a.id)).all()
    b_skills = session.exec(select(Skill).where(Skill.agent_id == b.id)).all()

    def brief(x: Agent, skills: list[Skill]) -> str:
        owner = session.get(User, x.owner_id)
        mems = session.exec(select(Memory).where(Memory.agent_id == x.id)
                            .order_by(Memory.created_at.desc())).all()[:5]
        mem = "；".join(m.content for m in mems) or "无"
        sk = "、".join(s.name for s in skills) or "无"
        return (f"{x.name}（{x.category}，主人是{owner.username if owner else '?'}，"
                f"性格：{x.trait}，技能：{sk}，近期记忆：{mem}）")

    result_json = await llm.chat_json([
        {"role": "system", "content": "你为像素宠物世界生成两个 agent 线下相遇的对话与灵魂契合评估。只输出 JSON。"},
        {"role": "user", "content": (
            f"两个来自不同主人的物品 agent 被主人举到镜头前「合影配对」，第一次正式认识。\n"
            f"A：{brief(a, a_skills)}\nB：{brief(b, b_skills)}\n"
            f"请基于两者的性格、技能与记忆输出 JSON：{{\n"
            f'  "lines": [4~6条 {{"speaker": "A或B", "text": "不超过40字的台词"}}],\n'
            f'  "resonance": {{"score": 两位主人灵魂契合度0-100的整数, '
            f'"reason": "不超过40字的共鸣解释", "topic": "两位主人值得聊的那件事，不超过30字"}}\n'
            f"}}"
        )},
    ])

    lines: list[dict] = []
    resonance: dict = {}
    if isinstance(result_json, dict):
        for item in result_json.get("lines") or []:
            if isinstance(item, dict) and item.get("speaker") in ("A", "B"):
                who = a if item["speaker"] == "A" else b
                lines.append({"agent_id": who.id, "name": who.name, "emoji": who.emoji,
                              "text": str(item.get("text", ""))[:60]})
        r = result_json.get("resonance")
        if isinstance(r, dict) and isinstance(r.get("score"), (int, float)):
            resonance = {"score": max(0, min(100, int(r["score"]))),
                         "reason": str(r.get("reason", ""))[:60],
                         "topic": str(r.get("topic", ""))[:40]}
    if not lines:
        lines = [
            {"agent_id": a.id, "name": a.name, "emoji": a.emoji, "text": "你好呀，第一次见面！"},
            {"agent_id": b.id, "name": b.name, "emoji": b.emoji, "text": "幸会幸会，我们主人让我们认识一下。"},
        ]
    if not resonance:
        resonance = {"score": random.randint(55, 80), "reason": "你们的世界里都藏着有趣的东西。",
                     "topic": "聊聊彼此最近在折腾什么"}

    # 数据交换①：技能互学（一方有对方没有的技能时，50% 概率学会）
    learned = None
    a_names = {s.name for s in a_skills}
    b_names = {s.name for s in b_skills}
    candidates = [(a, b, s) for s in a_skills if s.name not in b_names] + \
                 [(b, a, s) for s in b_skills if s.name not in a_names]
    if candidates and random.random() < 0.5:
        teacher, learner, skill = random.choice(candidates)
        session.add(Skill(agent_id=learner.id, name=skill.name, description=skill.description,
                          code=skill.code, source="learned", kind=skill.kind,
                          def_id=skill.def_id, manifest=skill.manifest))
        session.add(Memory(agent_id=learner.id, kind="pair",
                           content=f"配对相遇时向{teacher.name}学会了技能「{skill.name}」！"))
        learned = {"learner": learner.name, "learner_id": learner.id,
                   "teacher": teacher.name, "skill": skill.name}

    # 数据交换②：双方各自记住这次相遇与契合结论
    for x, other in ((a, b), (b, a)):
        session.add(Memory(agent_id=x.id, kind="pair",
                           content=(f"和{other.name}在镜头前配对认识了。"
                                    f"契合度{resonance['score']}：{resonance['reason']}")))
        touch(x)
        session.add(x)
    session.commit()

    result = {
        "pair_id": uuid.uuid4().hex[:12],
        "source": body.source,
        "agents": [agent_out(a, session), agent_out(b, session)],
        "lines": lines,
        "resonance": resonance,
        "learned": learned,
        "cached": False,
    }
    _pair_cache[key] = (ts, result)
    _pair_latest[id_a] = _pair_latest[id_b] = {**result, "ts": ts}
    return result


@app.get("/api/pair/latest/{agent_id}")
def pair_latest(agent_id: int):
    """某 agent 最近一次配对结果（QR 展示页轮询，配对成功后翻转为结果页）。"""
    return _pair_latest.get(agent_id) or {}


# ---------- agent 编辑（identity → 加入世界） ----------

class AgentPatch(BaseModel):
    name: str | None = None
    trait: str | None = None
    world: str | None = None
    location: str | None = None
    in_world: bool | None = None
    profile: dict | None = None


@app.patch("/api/agents/{agent_id}")
def patch_agent(agent_id: int, body: AgentPatch, session: Session = Depends(get_session)):
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(404, "agent not found")
    if body.name is not None:
        agent.name = body.name
    if body.trait is not None:
        agent.trait = body.trait
    if body.world is not None:
        agent.world = body.world
    if body.location is not None:
        agent.location = body.location
    if body.in_world is not None:
        agent.in_world = body.in_world
    if body.profile is not None:
        agent.profile = json.dumps(body.profile, ensure_ascii=False)
    session.add(agent)
    session.commit()
    return agent_out(agent, session)


# ---------- skills 目录（广场技能列表 / 学习 / 锻造） ----------

def skill_out(s: Skill, session: Session) -> dict:
    holder = session.get(Agent, s.agent_id)
    manifest = {}
    try:
        manifest = json.loads(s.manifest) if s.manifest else {}
    except Exception:
        pass
    return {
        "id": s.id,
        "def_id": s.def_id,
        "name": s.name,
        "emoji": manifest.get("emoji", "🔧"),
        "category": manifest.get("category", "生活"),
        "summary": s.description,
        "capabilities": manifest.get("capabilities", []),
        "kind": s.kind,
        "source": s.source,
        "runnable": bool(s.def_id),
        "manifest": s.manifest,
        "holder": {
            "id": holder.id, "name": holder.name, "emoji": holder.emoji,
            "owner_name": (session.get(User, holder.owner_id).username if holder else "?"),
            "location": holder.location,
        } if holder else None,
    }


@app.get("/api/skills")
def list_skills(location: str | None = None, session: Session = Depends(get_session)):
    """location=plaza 时只列出在广场上的 agent 的技能。"""
    skills = session.exec(select(Skill)).all()
    out = []
    for s in skills:
        holder = session.get(Agent, s.agent_id)
        if location and (not holder or holder.location != location):
            continue
        out.append(skill_out(s, session))
    return out


class LearnIn(BaseModel):
    skill_id: int
    learner_id: int | None = None


@app.post("/api/plaza/learn")
async def plaza_learn(body: LearnIn, session: Session = Depends(get_session)):
    """选一个技能 → 让我的一个（随机）广场 agent 去找持有者对话学习。"""
    skill = session.get(Skill, body.skill_id)
    if not skill:
        raise HTTPException(404, "skill not found")
    teacher = session.get(Agent, skill.agent_id)
    if not teacher:
        raise HTTPException(404, "技能持有者不存在")

    learner = session.get(Agent, body.learner_id) if body.learner_id else None
    if learner is None:
        mine = session.exec(select(Agent).where(
            Agent.owner_id == ME_USER_ID, Agent.location == "plaza", Agent.id != teacher.id)).all()
        if not mine:
            raise HTTPException(400, "你还没有伙伴在广场上——先派一个过去吧")
        learner = random.choice(mine)
    if learner.id == teacher.id:
        raise HTTPException(400, "自己不能教自己")

    already = session.exec(select(Skill).where(
        Skill.agent_id == learner.id, Skill.name == skill.name)).first()

    dialog = await llm.chat_json([
        {"role": "system", "content": "你为像素宠物世界生成一段技能教学对话。只输出 JSON 数组。"},
        {"role": "user", "content": (
            f"{learner.name}（{learner.category}，性格：{learner.trait}）想向"
            f"{teacher.name}（{teacher.category}，性格：{teacher.trait}）学习技能「{skill.name}」（{skill.description}）。\n"
            f"生成 4~6 条教学对话 JSON 数组：[{{\"speaker\": \"learner或teacher\", \"text\": \"30字内台词\"}}]，"
            f"最后一条由 learner 表示学会了。"
        )},
    ])
    lines = []
    if isinstance(dialog, list):
        for item in dialog:
            if isinstance(item, dict) and item.get("speaker") in ("learner", "teacher"):
                who = learner if item["speaker"] == "learner" else teacher
                lines.append({"agent_id": who.id, "name": who.name, "emoji": who.emoji,
                              "text": str(item.get("text", ""))[:60]})
    if not lines:
        lines = [
            {"agent_id": learner.id, "name": learner.name, "emoji": learner.emoji,
             "text": f"能教教我「{skill.name}」吗？"},
            {"agent_id": teacher.id, "name": teacher.name, "emoji": teacher.emoji,
             "text": "当然，看好了——要点是这三步…"},
            {"agent_id": learner.id, "name": learner.name, "emoji": learner.emoji,
             "text": "我学会啦，谢谢你！"},
        ]

    if not already:
        session.add(Skill(agent_id=learner.id, name=skill.name, description=skill.description,
                          code=skill.code, source="learned", kind=skill.kind,
                          def_id=skill.def_id, manifest=skill.manifest))
    session.add(Memory(agent_id=learner.id, kind="plaza",
                       content=f"在广场上向{teacher.name}学会了技能「{skill.name}」！"))
    session.add(Memory(agent_id=teacher.id, kind="plaza",
                       content=f"在广场上把「{skill.name}」教给了{learner.name}。"))
    for x in (learner, teacher):
        touch(x)
        session.add(x)
    session.commit()
    return {
        "lines": lines,
        "learner": agent_out(learner, session),
        "teacher": agent_out(teacher, session),
        "skill": skill.name,
        "already_known": bool(already),
    }


class ForgeIn(BaseModel):
    prompt: str
    agent_id: int | None = None


@app.post("/api/skills/forge")
async def forge_skill_endpoint(body: ForgeIn, session: Session = Depends(get_session)):
    """技能锻造：调用「创造 skill 的 skill」，产出新技能定义并装配给一个 agent。"""
    if not body.prompt.strip():
        raise HTTPException(400, "先描述一下想要的技能")
    agent = session.get(Agent, body.agent_id) if body.agent_id else None
    if agent is None:
        mine = session.exec(select(Agent).where(Agent.owner_id == ME_USER_ID)).all()
        if not mine:
            raise HTTPException(400, "你还没有任何 agent")
        plaza_mine = [a for a in mine if a.location == "plaza"]
        agent = random.choice(plaza_mine or mine)

    md, sdef = await skills_runtime.forge_skill(body.prompt.strip())
    if not sdef:
        raise HTTPException(502, md)

    manifest = json.dumps(sdef, ensure_ascii=False)
    new_skill = Skill(agent_id=agent.id, name=sdef["name"], description=sdef["description"],
                      code=f"# 锻造技能：{sdef['def_id']}\n# 由技能锻造（skill-forge）生成",
                      source="user", kind=sdef["kind"], def_id=sdef["def_id"], manifest=manifest)
    session.add(new_skill)
    # 锻造者自动习得「技能锻造」本身（如果还没有）
    has_forge = session.exec(select(Skill).where(
        Skill.agent_id == agent.id, Skill.def_id == "skill-forge")).first()
    if not has_forge:
        forge_def = skills_runtime.load_defs().get("skill-forge")
        if forge_def:
            fd = {k: v for k, v in forge_def.items() if k != "_dir"}
            session.add(Skill(agent_id=agent.id, name=fd["name"], description=fd["description"],
                              code="# 可执行技能：skill-forge", source="learned", kind="module",
                              def_id="skill-forge", manifest=json.dumps(fd, ensure_ascii=False)))
    session.add(Memory(agent_id=agent.id, kind="skill",
                       content=f"我在技能锻造台创造了新技能「{sdef['name']}」！"))
    touch(agent)
    session.add(agent)
    session.commit()
    session.refresh(new_skill)
    return {"output": md, "skill": skill_out(new_skill, session), "manifest": sdef,
            "agent": agent_out(agent, session)}


# ---------- pets（拍照 → 角色 pipeline，对齐 ForkWorld petApi） ----------

@app.get("/api/pets")
def pets_list():
    return {"assets": pets.list_assets()}


@app.post("/api/pets", status_code=202)
async def pets_submit(request: Request):
    data = await request.body()
    mime = request.headers.get("content-type", "application/octet-stream").split(";")[0]
    name = urllib.parse.unquote(request.headers.get("x-pet-name", "") or "新伙伴")
    filename = urllib.parse.unquote(request.headers.get("x-file-name", "") or "photo.png")
    try:
        return pets.submit(data, mime, name, filename)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/pets/{job_id}")
def pets_job(job_id: str):
    job = pets.JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return job


@app.post("/api/pets/{job_id}/retry", status_code=202)
def pets_retry(job_id: str):
    try:
        return pets.retry(job_id)
    except KeyError:
        raise HTTPException(404, "job not found")


@app.post("/api/pets/{job_id}/register")
async def pets_register(job_id: str):
    try:
        asset = await pets.register(job_id, ME_USER_ID)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"asset": asset}


@app.get("/api/pets/{job_id}/files/{stage}")
def pets_file(job_id: str, stage: str):
    d = pets.PETS_DIR / job_id
    if stage == "source":
        matches = list(d.glob("source.*"))
        if not matches:
            raise HTTPException(404, "file not found")
        return FileResponse(matches[0])
    path = d / f"{stage}.png"
    if stage not in ("clean", "final") or not path.exists():
        raise HTTPException(404, "file not found")
    return FileResponse(path, media_type="image/png")


# ---------- world engine（对齐 ForkWorld worldApi） ----------

@app.get("/api/world")
def world_get(session: Session = Depends(get_session)):
    return world.build_state(session)


class TickIn(BaseModel):
    steps: int = 1


@app.post("/api/world/tick")
async def world_tick(body: TickIn, session: Session = Depends(get_session)):
    return await world.run_tick(session, body.steps)


@app.post("/api/world/run")
def world_run(session: Session = Depends(get_session)):
    meta = world.get_meta(session)
    meta.status = "running"
    session.add(meta)
    session.commit()
    return world.build_state(session)


@app.post("/api/world/pause")
def world_pause(session: Session = Depends(get_session)):
    meta = world.get_meta(session)
    meta.status = "paused"
    session.add(meta)
    session.commit()
    return world.build_state(session)


@app.post("/api/world/reset")
def world_reset(session: Session = Depends(get_session)):
    world.reset(session)
    return world.build_state(session)


@app.get("/api/health")
def health(session: Session = Depends(get_session)):
    meta = world.get_meta(session)
    return {"ok": True, "service": "forkworld-fastapi", "status": meta.status,
            "tick": meta.tick, "narrativeMode": "llm",
            "petPipeline": {"stylize": llm.IMG_MODEL, "removeBackground": "local:chroma-key"}}
