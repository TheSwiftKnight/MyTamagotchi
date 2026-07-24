import json

from sqlmodel import Session, select

from .db import engine
from .models import Agent, AgentTemplate, Memory, Skill, User
from .skills_runtime import load_defs


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


DEFAULT_TEMPLATES = [
    ("小汪", "狗", "热情黏人，最爱陪主人散步，尾巴摇个不停", "元气满满的狗狗伙伴"),
    ("咪咪", "猫", "高冷但偷偷关心主人，喜欢晒太阳打盹", "傲娇的猫咪伙伴"),
    ("小册", "书本", "文静博学，喜欢收集阅读心得，偶尔掉书袋", "爱思考的书本伙伴"),
    ("汩汩", "水瓶", "操心体质，时刻盯着主人的喝水量", "贴心的水瓶伙伴"),
    ("铁力", "哑铃", "肌肉笨蛋，满脑子训练计划，嗓门很大", "运动担当的哑铃伙伴"),
    ("咔嚓", "相机", "观察力惊人，把看到的一切都拍下来当谈资", "记录生活的相机伙伴"),
    ("绿绿", "植物", "安静治愈，慢慢生长，也提醒主人慢下来", "治愈系的小盆栽"),
    ("嗡嗡", "耳机", "音乐发烧友，随时给主人的心情配 BGM", "懂气氛的耳机伙伴"),
]


def seed_templates() -> None:
    """图鉴模板目录：无主人、无记忆，仅供复制。幂等。"""
    with Session(engine) as session:
        if session.exec(select(AgentTemplate)).first():
            return
        for name, category, trait, description in DEFAULT_TEMPLATES:
            session.add(AgentTemplate(name=name, category=category,
                                      trait=trait, description=description))
        session.commit()


def seed() -> None:
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

        dog = Agent(owner_id=me.id, name="豆豆", category="狗",
                    trait="热情黏人，最爱听主人讲生活琐事，记性出奇地好", mood=90)
        bottle = Agent(owner_id=me.id, name="咕噜", category="水瓶",
                       trait="操心体质，每天盯着主人喝水量，说话咕噜咕噜的", mood=75)
        book = Agent(owner_id=me.id, name="墨墨", category="书本",
                     trait="文静博学，喜欢收集主人的阅读心得，偶尔掉书袋", mood=70)
        dumbbell = Agent(owner_id=u2.id, name="铁蛋", category="哑铃",
                         trait="肌肉笨蛋，满脑子训练计划，嗓门很大", mood=85, location="plaza")
        cam = Agent(owner_id=u2.id, name="小眼", category="相机",
                    trait="观察力惊人，把看到的一切都拍下来当谈资", mood=80, location="plaza")
        pen = Agent(owner_id=u3.id, name="尖尖", category="钢笔",
                    trait="文艺挑剔，写得一手好字，喜欢点评别人的措辞", mood=78, location="plaza")
        session.add_all([dog, bottle, book, dumbbell, cam, pen])
        session.commit()
        for a in (dog, bottle, book, dumbbell, cam, pen):
            session.refresh(a)

        session.add_all([
            Memory(agent_id=dog.id, kind="diary", content="主人今天加班到很晚，说好累但还是摸了摸我的头。"),
            Memory(agent_id=bottle.id, kind="diary", content="主人今天只喝了三杯水，我提醒了她两次。"),
            Memory(agent_id=book.id, kind="diary", content="主人读完了《小王子》第21章，说驯养就是建立联系。"),
            Memory(agent_id=dumbbell.id, kind="camera", content="主人今天练了卧推 60kg x 5，姿势比上周标准。"),
            Skill(agent_id=dog.id, name="安慰模式", description="察觉主人低落时说暖心话",
                  code="def comfort(mood):\n    return '摸摸头，一切都会好的' if mood < 50 else '一起去散步吧！'", source="user"),
            Skill(agent_id=bottle.id, name="喝水提醒", description="统计每日饮水量并提醒",
                  code="def remind(cups):\n    return f'今天喝了{cups}杯，目标8杯！'", source="user"),
            Skill(agent_id=dumbbell.id, name="训练计划", description="根据录像优化训练动作",
                  code="def plan(day):\n    return ['卧推', '深蹲', '硬拉'][day % 3]", source="user"),
            Skill(agent_id=cam.id, name="精彩回放", description="剪辑一天的高光时刻",
                  code="def replay(clips):\n    return sorted(clips, key=lambda c: c.score)[-3:]", source="user"),
            Skill(agent_id=pen.id, name="金句摘抄", description="把好句子誊写收藏",
                  code="def collect(sentence):\n    return f'『{sentence}』—— 已收藏'", source="user"),
            _default_skill(cam.id, "heytea-poster"),
            _default_skill(book.id, "vedic-astro"),
        ])
        session.commit()
