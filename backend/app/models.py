from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str
    avatar: str = "🙂"


# agent 唯一的位置字段：一定在自己的三个世界之一或广场，没有其他选项
AGENT_LOCATIONS = ("vitality-gym-town", "learning-commons", "maker-harbor", "plaza")


class Agent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id")
    name: str
    image: str = ""  # agent 外表：capture 管线生成的角色图 URL（如 /api/pets/{id}/files/final）
    trait: str = ""
    mood: int = 80  # 0-100
    location: str = "vitality-gym-town"  # AGENT_LOCATIONS 之一
    profile: str = ""  # JSON: identity 字段 + memory_digest（随与主人/其他 agent 的互动持续更新）
    created_at: datetime = Field(default_factory=now)
    last_interact_at: datetime = Field(default_factory=now)


class AgentTemplate(SQLModel, table=True):
    """图鉴模板：没有主人、没有记忆的现成角色。

    用户不想拍照导入时，可以从图鉴复制一只——复制时才会在 agent 表建档。
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    image: str = ""  # 线条风模板图 URL（由 capture 管线生成）
    trait: str = ""
    description: str = ""


class Bond(SQLModel, table=True):
    """二维码配对形成的羁绊（持久化）。约定 agent_a < agent_b 保证一对只有一行。

    这是「配对之后 agent 能做活动」的根：世界 tick 会优先安排有羁绊的两只
    agent 一起出事件（串门/合作/约玩/送礼），配对不再是一次性的演出。"""
    id: Optional[int] = Field(default=None, primary_key=True)
    agent_a: int = Field(index=True)
    agent_b: int = Field(index=True)
    score: int = 0            # 最新灵魂契合度
    reason: str = ""          # 共鸣解释
    topic: str = ""           # 值得聊的那件事
    lines: str = "[]"         # 最近一次相遇台词 JSON（大屏互访气泡用）
    pair_count: int = 1       # 累计配对次数（碰得越多羁绊越深）
    created_at: datetime = Field(default_factory=now)
    last_pair_at: datetime = Field(default_factory=now)
    last_activity_at: datetime = Field(default_factory=now)


class WorldEventRow(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tick: int
    day: int
    minute: int
    type: str = "ritual"
    location: str = ""
    title: str = ""
    summary: str = ""
    participants: str = "[]"  # JSON list[str] agent ids ("agent-3")
    dialogue: str = "[]"  # JSON list[{agentId,text}]
    consequence: str = ""
    created_at: datetime = Field(default_factory=now)


class WorldMeta(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    status: str = "running"  # running | paused
    tick: int = 0
    day: int = 1
    minute: int = 8 * 60
    started_at: datetime = Field(default_factory=now)
    last_tick_at: Optional[datetime] = None
    metrics: str = '{"cohesion": 52, "knowledge": 48, "creativity": 50, "stewardship": 46}'


class Memory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    agent_id: int = Field(foreign_key="agent.id")
    kind: str = "chat"  # diary | chat | camera | plaza | world
    content: str
    created_at: datetime = Field(default_factory=now)


class Skill(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    agent_id: int = Field(foreign_key="agent.id")
    name: str
    description: str = ""
    code: str = ""
    source: str = "user"  # user | learned | default
    kind: str = "demo"  # demo(装饰) | prompt | module
    def_id: str = ""  # 指向 backend/skills/{def_id}/ 的可执行定义；空=无
    manifest: str = ""  # skill.json 内容快照（inputs/output/cta），前端渲染表单用
    created_at: datetime = Field(default_factory=now)


class Artifact(SQLModel, table=True):
    id: Optional[str] = Field(default=None, primary_key=True)
    mime: str
    path: str
    size: int = 0
    created_at: datetime = Field(default_factory=now)
