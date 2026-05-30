from __future__ import annotations

import asyncio
import importlib
import os
from pathlib import Path
from uuid import uuid4

import httpx


def _build_app(db_slug: str):
    db_path = Path(__file__).resolve().parent / f"{db_slug}-{uuid4()}.sqlite3"
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
    return main_module.app


def test_register_login_logout_flow() -> None:
    app_instance = _build_app("auth-core")

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app_instance)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            register_response = await client.post(
                "/api/auth/register",
                json={
                    "full_name": "Minh Nguyen",
                    "phone_number": "0901234567",
                    "password": "strongpass123",
                    "address": "Hanoi",
                },
            )
            assert register_response.status_code == 201
            register_data = register_response.json()["user"]
            assert register_data["phone_number"] == "0901234567"
            assert register_data["role"] == "customer"

            login_response = await client.post(
                "/api/auth/login",
                json={
                    "phone_number": "0901234567",
                    "password": "strongpass123",
                },
            )
            assert login_response.status_code == 200
            assert login_response.json()["user"]["full_name"] == "Minh Nguyen"
            assert login_response.json()["csrf_token"]
            assert "csrf_token" in client.cookies

            logout_response = await client.post("/api/auth/logout")
            assert logout_response.status_code == 200
            assert logout_response.json() == {"message": "Logged out"}

    asyncio.run(scenario())


def test_login_rejects_invalid_password() -> None:
    app_instance = _build_app("auth-core-invalid")

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app_instance)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            await client.post(
                "/api/auth/register",
                json={
                    "full_name": "Admin",
                    "phone_number": "0907777777",
                    "password": "correct-password",
                    "address": None,
                },
            )

            login_response = await client.post(
                "/api/auth/login",
                json={"phone_number": "0907777777", "password": "wrong-password"},
            )

            assert login_response.status_code == 401
            error = login_response.json()["error"]
            assert error["code"] == "UNAUTHENTICATED"

    asyncio.run(scenario())
