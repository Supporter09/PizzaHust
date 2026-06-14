from __future__ import annotations

import asyncio

import httpx
from sqlalchemy import select

from app.infra.config import get_settings
from app.infra.db.models import User, UserRole
from app.infra.db.session import create_session_factory
from app.seeds.run import main as run_seeds
from tests.auth_test_utils import build_test_app


def test_auth_me_profile_and_loyalty_flow() -> None:
    app_instance = build_test_app("auth-profile")

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app_instance)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            await client.post(
                "/api/auth/register",
                json={
                    "full_name": "Profile User",
                    "phone_number": "0904444444",
                    "password": "strongpass123",
                    "address": "Old address",
                },
            )
            login_response = await client.post(
                "/api/auth/login",
                json={"phone_number": "0904444444", "password": "strongpass123"},
            )
            assert login_response.status_code == 200

            me_response = await client.get("/api/auth/me")
            assert me_response.status_code == 200
            me_body = me_response.json()
            assert me_body["user"]["full_name"] == "Profile User"
            assert me_body["user"]["avatar_url"] is None
            csrf_token = me_body["csrf_token"]

            patch_forbidden = await client.patch(
                "/api/auth/me",
                json={"full_name": "Updated Name"},
            )
            assert patch_forbidden.status_code == 403

            patch_response = await client.patch(
                "/api/auth/me",
                json={"full_name": "Updated Name", "address": "New address"},
                headers={"X-CSRF-Token": csrf_token},
            )
            assert patch_response.status_code == 200
            assert patch_response.json()["full_name"] == "Updated Name"
            assert patch_response.json()["address"] == "New address"

            loyalty_response = await client.get("/api/loyalty/me")
            assert loyalty_response.status_code == 200
            assert loyalty_response.json() == {
                "current_points": 0,
                "total_points_earned": 0,
            }

    asyncio.run(scenario())


def test_seed_creates_admin_and_kitchen_users() -> None:
    build_test_app("seed-accounts")
    run_seeds()

    settings = get_settings()
    with create_session_factory()() as session:
        admin = session.scalar(select(User).where(User.phone_number == settings.admin_seed_phone))
        kitchen = session.scalar(
            select(User).where(User.phone_number == settings.kitchen_seed_phone)
        )

        assert admin is not None
        assert admin.role == UserRole.ADMIN
        assert kitchen is not None
        assert kitchen.role == UserRole.KITCHEN
