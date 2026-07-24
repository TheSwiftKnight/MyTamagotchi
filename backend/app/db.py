from pathlib import Path

from sqlalchemy import event, text
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


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _migrate()


def _migrate() -> None:
    """SQLite 轻量迁移：给已有表补新列。"""
    from sqlalchemy import text

    new_cols = {
        "agent": [
            ("world", "TEXT DEFAULT 'everyday'"),
            ("sprite_url", "TEXT DEFAULT ''"),
            ("profile", "TEXT DEFAULT ''"),
            ("in_world", "BOOLEAN DEFAULT 0"),
        ],
    }
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        for table, cols in new_cols.items():
            existing = {r[1] for r in conn.execute(text(f"PRAGMA table_info({table})"))}
            for name, ddl in cols:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
        conn.commit()


def get_session():
    with Session(engine) as session:
        yield session
