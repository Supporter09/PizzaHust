from __future__ import annotations

from collections.abc import AsyncGenerator
from functools import cache

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.infra.config import get_settings


def get_database_url() -> str:
    return get_settings().database_url


def create_db_engine(database_url: str | None = None) -> Engine:
    # pool_recycle guards against MySQL dropping idle connections (wait_timeout).
    engine = create_engine(
        database_url or get_database_url(),
        pool_pre_ping=True,
        pool_recycle=3600,
    )
    if engine.url.get_backend_name() == "sqlite":
        # SQLite skips FK enforcement (and ON DELETE CASCADE) unless asked;
        # without this, tests would not exercise the same cascades as MySQL.
        @event.listens_for(engine, "connect")
        def _enable_sqlite_fks(dbapi_connection: object, _record: object) -> None:
            cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


@cache
def _session_factory(database_url: str) -> sessionmaker[Session]:
    # Cached per resolved URL: the Engine (and its connection pool) is created
    # once per process and reused, instead of a fresh pool on every request.
    return sessionmaker(
        bind=create_db_engine(database_url),
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )


def create_session_factory(database_url: str | None = None) -> sessionmaker[Session]:
    # Resolve before caching so the cache key is the real URL, not None — a
    # changed database_url must produce a new engine, not reuse the stale one.
    return _session_factory(database_url or get_database_url())


def get_session() -> Session:
    return create_session_factory()()


async def get_db_session() -> AsyncGenerator[Session, None]:
    session = get_session()
    try:
        yield session
    finally:
        session.close()
