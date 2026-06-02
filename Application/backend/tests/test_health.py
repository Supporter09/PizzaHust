from __future__ import annotations

import asyncio

import httpx

from tests.auth_test_utils import build_test_app


def test_healthz_returns_ok() -> None:
    app_instance = build_test_app("health")

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app_instance)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/healthz")
            assert response.status_code == 200
            assert response.json() == {"status": "ok"}

    asyncio.run(scenario())
