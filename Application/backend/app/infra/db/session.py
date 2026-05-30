from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.infra.config import get_settings


def get_database_url() -> str:
    return get_settings().database_url


def create_db_engine(database_url: str | None = None) -> Engine:
    return create_engine(database_url or get_database_url(), pool_pre_ping=True)


def create_session_factory(database_url: str | None = None) -> sessionmaker[Session]:
    return sessionmaker(
        bind=create_db_engine(database_url),
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )


def get_session() -> Session:
    return create_session_factory()()


async def get_db_session() -> AsyncGenerator[Session, None]:
    session = get_session()
    try:
        yield session
    finally:
        session.close()
