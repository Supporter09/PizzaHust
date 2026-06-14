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
                "redeemable_value_vnd": 0,
            }

    asyncio.run(scenario())


def test_avatar_upload_replace_and_bad_type(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    app_instance = build_test_app("auth-avatar")

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app_instance)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            await client.post(
                "/api/auth/register",
                json={
                    "full_name": "Ava Tar",
                    "phone_number": "0905555555",
                    "password": "strongpass123",
                },
            )
            await client.post(
                "/api/auth/login",
                json={"phone_number": "0905555555", "password": "strongpass123"},
            )
            csrf = (await client.get("/api/auth/me")).json()["csrf_token"]

            bad = await client.post(
                "/api/auth/me/avatar",
                files={"image": ("note.txt", b"hello", "text/plain")},
                headers={"X-CSRF-Token": csrf},
            )
            assert bad.status_code == 400
            assert bad.json()["error"]["code"] == "VALIDATION_FAILED"

            up1 = await client.post(
                "/api/auth/me/avatar",
                files={"image": ("a.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
                headers={"X-CSRF-Token": csrf},
            )
            assert up1.status_code == 200
            url1 = up1.json()["avatar_url"]
            assert url1 and url1.endswith(".png")

            up2 = await client.post(
                "/api/auth/me/avatar",
                files={"image": ("b.webp", b"RIFFfake", "image/webp")},
                headers={"X-CSRF-Token": csrf},
            )
            assert up2.status_code == 200
            url2 = up2.json()["avatar_url"]
            assert url2 != url1
            assert (await client.get("/api/auth/me")).json()["user"]["avatar_url"] == url2

            no_csrf = await client.post(
                "/api/auth/me/avatar",
                files={"image": ("c.png", b"\x89PNGfake", "image/png")},
            )
            assert no_csrf.status_code == 403

    asyncio.run(scenario())


def test_avatar_delete_is_idempotent(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("IMAGE_UPLOAD_DIR", str(tmp_path))
    app_instance = build_test_app("auth-avatar-del")

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app_instance)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            await client.post(
                "/api/auth/register",
                json={"full_name": "Del Ete", "phone_number": "0906666666", "password": "strongpass123"},
            )
            await client.post(
                "/api/auth/login",
                json={"phone_number": "0906666666", "password": "strongpass123"},
            )
            csrf = (await client.get("/api/auth/me")).json()["csrf_token"]

            await client.post(
                "/api/auth/me/avatar",
                files={"image": ("a.png", b"\x89PNGfake", "image/png")},
                headers={"X-CSRF-Token": csrf},
            )
            d1 = await client.request("DELETE", "/api/auth/me/avatar", headers={"X-CSRF-Token": csrf})
            assert d1.status_code == 200
            assert d1.json()["avatar_url"] is None

            d2 = await client.request("DELETE", "/api/auth/me/avatar", headers={"X-CSRF-Token": csrf})
            assert d2.status_code == 200
            assert d2.json()["avatar_url"] is None

    asyncio.run(scenario())


def test_change_password_keeps_session_and_validates() -> None:
    app_instance = build_test_app("auth-pwd")

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app_instance)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            await client.post(
                "/api/auth/register",
                json={"full_name": "Pass Word", "phone_number": "0907777777", "password": "oldpass123"},
            )
            await client.post(
                "/api/auth/login",
                json={"phone_number": "0907777777", "password": "oldpass123"},
            )
            csrf = (await client.get("/api/auth/me")).json()["csrf_token"]

            wrong = await client.post(
                "/api/auth/me/password",
                json={"current_password": "notmypass", "new_password": "newpass123"},
                headers={"X-CSRF-Token": csrf},
            )
            assert wrong.status_code == 400
            assert wrong.json()["error"]["code"] == "VALIDATION_FAILED"

            short = await client.post(
                "/api/auth/me/password",
                json={"current_password": "oldpass123", "new_password": "short"},
                headers={"X-CSRF-Token": csrf},
            )
            assert short.status_code == 400

            ok = await client.post(
                "/api/auth/me/password",
                json={"current_password": "oldpass123", "new_password": "newpass123"},
                headers={"X-CSRF-Token": csrf},
            )
            assert ok.status_code == 200
            assert (await client.get("/api/auth/me")).status_code == 200

            relogin = await client.post(
                "/api/auth/login",
                json={"phone_number": "0907777777", "password": "newpass123"},
            )
            assert relogin.status_code == 200

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
