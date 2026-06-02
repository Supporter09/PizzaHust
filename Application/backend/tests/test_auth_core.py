from __future__ import annotations

import asyncio

import httpx

from tests.auth_test_utils import build_test_app


def test_register_login_logout_flow() -> None:
    app_instance = build_test_app("auth-core")

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
            body = login_response.json()
            assert body["user"]["full_name"] == "Minh Nguyen"
            assert body["csrf_token"]
            assert "csrf_token" in client.cookies

            logout_response = await client.post(
                "/api/auth/logout",
                headers={"X-CSRF-Token": body["csrf_token"]},
            )
            assert logout_response.status_code == 200
            assert logout_response.json() == {"message": "Logged out"}

    asyncio.run(scenario())


def test_login_rejects_invalid_password() -> None:
    app_instance = build_test_app("auth-core-invalid")

    async def scenario() -> None:
        transport = httpx.ASGITransport(app=app_instance)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            register_response = await client.post(
                "/api/auth/register",
                json={
                    "full_name": "Admin",
                    "phone_number": "0907777777",
                    "password": "correct-password",
                    "address": None,
                },
            )
            # Without this, a register regression would fall through to the
            # nonexistent-user path, which also 401s — masking the failure.
            assert register_response.status_code == 201

            login_response = await client.post(
                "/api/auth/login",
                json={"phone_number": "0907777777", "password": "wrong-password"},
            )

            assert login_response.status_code == 401
            error = login_response.json()["error"]
            assert error["code"] == "UNAUTHENTICATED"

    asyncio.run(scenario())
