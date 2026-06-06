"""FastAPI dependency that yields a SQLAlchemy session per-request."""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy.orm import Session

from app.infra.db.session import create_session_factory


def get_db() -> Generator[Session, None, None]:
    # Resolve the factory per-request so a test that overrides DATABASE_URL (see
    # build_test_app) is honored; create_session_factory is lru_cached per URL,
    # so the engine/pool is still created once and reused.
    db = create_session_factory()()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
