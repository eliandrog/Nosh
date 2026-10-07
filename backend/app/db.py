from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import Engine, event
from sqlmodel import Session, SQLModel, create_engine

from app import models  # noqa: F401  (registers tables on SQLModel.metadata)
from app.core.config import settings

DB_PATH = settings.db_path


def make_engine(db_path: Path) -> Engine:
    eng = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})

    @event.listens_for(eng, "connect")
    def _enable_foreign_keys(dbapi_conn, _record):
        dbapi_conn.execute("PRAGMA foreign_keys = ON")

    return eng


engine = make_engine(DB_PATH)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one session per request."""
    with Session(engine) as session:
        yield session


def init_db(eng: Engine | None = None) -> None:
    """Create tables and seed the starter recipes if the database is empty."""
    from app.seed import seed_recipes

    eng = eng or engine
    SQLModel.metadata.create_all(eng)
    with Session(eng) as session:
        seed_recipes(session)
