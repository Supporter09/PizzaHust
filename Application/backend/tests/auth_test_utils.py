from __future__ import annotations

import importlib
import os
from pathlib import Path
from uuid import uuid4


def build_test_app(db_slug: str, *, auth_rate_limit_per_minute: int | None = None):
    db_path = Path(__file__).resolve().parent / f"{db_slug}-{uuid4()}.sqlite3"
    os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{db_path}"
    os.environ["SESSION_SECRET"] = "test-session-secret"
    os.environ["SESSION_HTTPS_ONLY"] = "false"
    if auth_rate_limit_per_minute is None:
        os.environ.pop("AUTH_RATE_LIMIT_PER_MINUTE", None)
    else:
        os.environ["AUTH_RATE_LIMIT_PER_MINUTE"] = str(auth_rate_limit_per_minute)

    from app.infra.config import get_settings
    from app.infra.db.base import metadata
    from app.infra.db.session import create_db_engine

    get_settings.cache_clear()
    engine = create_db_engine(os.environ["DATABASE_URL"])
    metadata.drop_all(bind=engine)
    metadata.create_all(bind=engine)
    engine.dispose()

    import app.main as main_module

    importlib.reload(main_module)
    return main_module.app
