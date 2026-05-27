"""FastAPI dependency that yields a SQLAlchemy session per-request."""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy.orm import Session

from app.infra.db.session import create_session_factory

_factory = create_session_factory()


def get_db() -> Generator[Session, None, None]:
    db = _factory()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
