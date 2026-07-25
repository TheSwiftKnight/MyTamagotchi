import json
import random

from sqlmodel import Session, select

from .db import engine
from .models import Agent, AgentTemplate, Skill, User
from .skills_runtime import load_defs

# 默认技能：所有 agent 出生即拥有
DEFAULT_SKILL_DEF_IDS = ("heytea-poster", "vedic-astro")

# 图鉴模板：sprite 来自 frontends/mobile/src/assets/world/pet-agents/sprites，
# 已复制到 backend/uploads/pets/tpl-{key}/final.png
DEFAULT_TEMPLATES = [
    ("dachshund", "豆豆", "热情黏人的腊肠犬，最爱陪主人散步，尾巴摇个不停", "元气满满的腊肠犬伙伴"),
    ("siamese", "雪糕", "优雅傲娇的暹罗猫，嘴上嫌弃却总睡在主人枕边", "高冷又贴心的暹罗猫伙伴"),
    ("cat", "咪咪", "好奇贪玩的小猫，对纸箱和毛线球毫无抵抗力", "机灵活泼的小猫伙伴"),
    ("rabbit", "团子", "温柔胆小的兔子，开心时会原地蹦一个小跳", "软乎乎的兔子伙伴"),
    ("hamster", "麻薯", "囤货狂魔小仓鼠，腮帮子里永远藏着小零食", "圆滚滚的仓鼠伙伴"),
    ("bird", "啾啾", "话痨小鸟，学舌一流，最爱清晨给主人报时", "叽叽喳喳的小鸟伙伴"),
    ("tortoise", "石头", "慢性子乌龟，做事不急不躁，是大家的定心丸", "沉稳可靠的乌龟伙伴"),
]

SEED_LOCATIONS = [
    "vitality-gym-town", "vitality-gym-town",
    "learning-commons", "learning-commons",
    "maker-harbor", "plaza", "plaza",
]


def _default_skill(agent_id: int, def_id: str) -> Skill:
    d = load_defs()[def_id]
    manifest = json.dumps({k: v for k, v in d.items() if k != "_dir"}, ensure_ascii=False)
    return Skill(agent_id=agent_id, name=d["name"], description=d["description"],
                 code=f"# 可执行技能：{def_id}\n# 来源：{d.get('source_repo', '')}",
                 source="default", kind=d["kind"], def_id=def_id, manifest=manifest)


def sync_default_skills() -> None:
    """启动时把 skill 定义的最新 manifest 同步进已存在的 skill 行。"""
    defs = load_defs()
    with Session(engine) as session:
        rows = session.exec(select(Skill).where(Skill.def_id != "")).all()
        for row in rows:
            d = defs.get(row.def_id)
            if d:
                row.manifest = json.dumps({k: v for k, v in d.items() if k != "_dir"},
                                          ensure_ascii=False)
                session.add(row)
        session.commit()


def seed_templates() -> None:
    """图鉴模板目录：无主人、无记忆，仅供复制。幂等。"""
    with Session(engine) as session:
        if session.exec(select(AgentTemplate)).first():
            return
        for key, name, trait, description in DEFAULT_TEMPLATES:
            session.add(AgentTemplate(name=name, trait=trait, description=description,
                                      image=f"/api/pets/tpl-{key}/files/final"))
        session.commit()


def seed() -> None:
    """空库初始化：3 个用户 + 每个图鉴模板各出场一次的 agent（owner 随机分配），
    每个 agent 拥有全部默认技能（喜茶风海报 + 吠陀占星）。"""
    with Session(engine) as session:
        if session.exec(select(User)).first():
            return

        me = User(username="小May", avatar="🌟")
        u2 = User(username="阿健", avatar="💪")
        u3 = User(username="书虫Lily", avatar="📖")
        session.add_all([me, u2, u3])
        session.commit()
        for u in (me, u2, u3):
            session.refresh(u)
        user_ids = [me.id, u2.id, u3.id]

        for index, (key, name, trait, _description) in enumerate(DEFAULT_TEMPLATES):
            agent = Agent(owner_id=random.choice(user_ids), name=name, trait=trait,
                          mood=random.randint(72, 95),
                          location=SEED_LOCATIONS[index % len(SEED_LOCATIONS)],
                          image=f"/api/pets/tpl-{key}/files/final")
            session.add(agent)
            session.commit()
            session.refresh(agent)
            for def_id in DEFAULT_SKILL_DEF_IDS:
                session.add(_default_skill(agent.id, def_id))
        session.commit()
