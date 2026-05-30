from __future__ import annotations

import asyncio
import importlib
import os
from pathlib import Path
from uuid import uuid4

import httpx


def test_healthz_returns_ok() -> None:
    db_path = Path(__file__).resolve().parent / f"health-{uuid4()}.sqlite3"
    os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{db_path}"
    os.environ["SESSION_SECRET"] = "test-session-secret"
    os.environ["SESSION_HTTPS_ONLY"] = "false"

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

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=main_module.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/healthz")
            assert response.status_code == 200
            assert response.json() == {"status": "ok"}

    asyncio.run(scenario())
