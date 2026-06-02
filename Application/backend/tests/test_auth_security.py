from __future__ import annotations

import asyncio

import httpx

from app.infra.auth.rate_limit import InMemoryRateLimiter
from tests.auth_test_utils import build_test_app


def test_rate_limiter_blocks_after_limit() -> None:
    limiter = InMemoryRateLimiter(limit=2, window_seconds=60)
    assert limiter.allow("ip:/api/auth/login")
    assert limiter.allow("ip:/api/auth/login")
    assert not limiter.allow("ip:/api/auth/login")


def test_logout_requires_valid_csrf_token() -> None:
    app_instance = build_test_app("csrf-required")

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app_instance)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            await client.post(
                "/api/auth/register",
                json={
                    "full_name": "CSRF User",
                    "phone_number": "0906666666",
                    "password": "strongpass123",
                    "address": None,
                },
            )
            login_response = await client.post(
                "/api/auth/login",
                json={"phone_number": "0906666666", "password": "strongpass123"},
            )
            assert login_response.status_code == 200

            logout_response = await client.post(
                "/api/auth/logout",
                headers={"X-CSRF-Token": "wrong-token"},
            )
            assert logout_response.status_code == 403
            assert logout_response.json()["error"]["code"] == "FORBIDDEN"

    asyncio.run(scenario())


def test_login_rate_limit_returns_429() -> None:
    app_instance = build_test_app("rate-limit", auth_rate_limit_per_minute=1)

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app_instance)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            await client.post(
                "/api/auth/register",
                json={
                    "full_name": "Rate User",
                    "phone_number": "0905555555",
                    "password": "strongpass123",
                    "address": None,
                },
            )

            first_login = await client.post(
                "/api/auth/login",
                json={"phone_number": "0905555555", "password": "strongpass123"},
            )
            assert first_login.status_code == 200

            second_login = await client.post(
                "/api/auth/login",
                json={"phone_number": "0905555555", "password": "strongpass123"},
            )
            assert second_login.status_code == 429
            assert second_login.json()["error"]["code"] == "RATE_LIMITED"

    asyncio.run(scenario())
