from __future__ import annotations

import importlib
import os
from pathlib import Path
from uuid import uuid4

from sqlalchemy import text


def _create_sqlite_kitchen_queue_view(engine) -> None:
    """Portable kitchen_queue_view for SQLite tests.

    Membership mirrors migration 0018 (Received/Preparing/ReadyForDispatch).
    priority_score uses a SQLite age expression; tests assert membership and
    *relative* ordering only — the exact MySQL formula is covered by smoke.
    """
    with engine.begin() as conn:
        conn.execute(text("DROP VIEW IF EXISTS kitchen_queue_view"))
        conn.execute(
            text(
                """
                CREATE VIEW kitchen_queue_view AS
                SELECT
                    o.order_id,
                    o.order_code,
                    o.current_status,
                    o.created_at,
                    o.promised_at,
                    CASE
                        WHEN o.current_status = 'Preparing' THEN
                            2000000000 + (strftime('%s', 'now') - strftime('%s', o.created_at))
                        WHEN o.current_status = 'Received' THEN
                            1000000000
                                + (strftime('%s', 'now') - strftime('%s', o.created_at))
                                + (strftime('%s', 'now') - strftime('%s', o.promised_at)) * 10
                        WHEN o.current_status = 'ReadyForDispatch' THEN
                            (strftime('%s', 'now') - strftime('%s', o.created_at))
                        ELSE
                            (strftime('%s', 'now') - strftime('%s', o.created_at))
                    END AS priority_score
                FROM orders o
                WHERE o.current_status IN ('Received', 'Preparing', 'ReadyForDispatch')
                """
            )
        )


def build_test_app(db_slug: str, *, auth_rate_limit_per_minute: int | None = None):
    db_path = Path(__file__).resolve().parent / f"{db_slug}-{uuid4()}.sqlite3"
    os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{db_path}"
    os.environ["SESSION_SECRET"] = "test-session-secret"
    os.environ["SESSION_HTTPS_ONLY"] = "false"
    if auth_rate_limit_per_minute is None:
        os.environ.pop("AUTH_RATE_LIMIT_PER_MINUTE", None)
    else:
        os.environ["AUTH_RATE_LIMIT_PER_MINUTE"] = str(auth_rate_limit_per_minute)

    from app.infra.auth.rate_limit import reset_auth_rate_limiter, reset_track_rate_limiter
    from app.infra.config import get_settings
    from app.infra.db.base import metadata
    from app.infra.db.session import create_db_engine

    get_settings.cache_clear()
    reset_auth_rate_limiter()
    reset_track_rate_limiter()
    engine = create_db_engine(os.environ["DATABASE_URL"])
    metadata.drop_all(bind=engine)
    metadata.create_all(bind=engine)
    _create_sqlite_kitchen_queue_view(engine)
    engine.dispose()

    import app.main as main_module

    importlib.reload(main_module)
    return main_module.app
