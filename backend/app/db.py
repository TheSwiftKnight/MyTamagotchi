import asyncio
from pathlib import Path

from sqlalchemy import event, text
from sqlalchemy.exc import OperationalError
from sqlmodel import Session, SQLModel, create_engine

DB_PATH = Path(__file__).resolve().parent.parent / "tamagotchi.db"
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False, "timeout": 30},
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _record):
    """每条连接都设 WAL + busy_timeout：读写并发时撞锁自动等待而非立刻 BUSY，
    这是根治『世界 tick 与 /chat 抢写锁 → 500 → 掉兜底』的兜底闸。"""
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA busy_timeout=30000")
    cur.execute("PRAGMA synchronous=NORMAL")
    cur.close()


async def commit_with_retry(session: Session, attempts: int = 6) -> None:
    """SQLite 写提交带退避重试：世界 tick 与请求抢写锁时偶发 BUSY，不至于 500。

    上面的 busy_timeout 挡不住 SQLite 的「锁升级」——事务已持读锁再要写锁时会立刻
    BUSY 而不等待，所以这层重试是必需的，不是冗余。
    """
    for i in range(attempts):
        try:
            session.commit()
            return
        except OperationalError:
            session.rollback()
            if i == attempts - 1:
                raise
            await asyncio.sleep(0.3)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _migrate()


def _migrate() -> None:
    """SQLite 轻量迁移：给已有表补新列。"""
    from sqlalchemy import text

    new_cols = {
        "agent": [
            ("profile", "TEXT DEFAULT ''"),
            ("image", "TEXT DEFAULT ''"),
        ],
        "agenttemplate": [
            ("image", "TEXT DEFAULT ''"),
        ],
    }
    dropped_cols = {
        # emoji → image；world+in_world+sprite_url 合并进 location/image（见下方数据迁移）
        "agent": ["emoji", "world", "in_world", "sprite_url"],
        "agenttemplate": ["emoji"],
    }
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        for table, cols in new_cols.items():
            existing = {r[1] for r in conn.execute(text(f"PRAGMA table_info({table})"))}
            if not existing:
                continue
            for name, ddl in cols:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))

        # 数据迁移：world+location → 单一 location（四个固定值）；sprite_url → image
        agent_cols = {r[1] for r in conn.execute(text("PRAGMA table_info(agent)"))}
        if "world" in agent_cols:
            conn.execute(text(
                "UPDATE agent SET location = CASE"
                " WHEN location = 'plaza' THEN 'plaza'"
                " WHEN world = 'stardom' THEN 'learning-commons'"
                " WHEN world = 'future' THEN 'maker-harbor'"
                " ELSE 'vitality-gym-town' END"
            ))
        else:
            conn.execute(text(
                "UPDATE agent SET location = 'vitality-gym-town'"
                " WHERE location NOT IN ('vitality-gym-town','learning-commons','maker-harbor','plaza')"
            ))
        if "sprite_url" in agent_cols:
            conn.execute(text(
                "UPDATE agent SET image = sprite_url WHERE (image IS NULL OR image = '') AND sprite_url <> ''"
            ))

        for table, cols in dropped_cols.items():
            existing = {r[1] for r in conn.execute(text(f"PRAGMA table_info({table})"))}
            for name in cols:
                if name in existing:
                    try:
                        conn.execute(text(f"ALTER TABLE {table} DROP COLUMN {name}"))
                    except Exception:
                        pass  # 老版本 SQLite 不支持 DROP COLUMN，残留列不影响使用
        conn.commit()


def get_session():
    with Session(engine) as session:
        yield session
