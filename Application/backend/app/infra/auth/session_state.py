from __future__ import annotations

import secrets
from typing import Any
from uuid import uuid4

from fastapi import Request

from app.infra.db.models import User

SESSION_KEY_USER_ID = "user_id"
SESSION_KEY_ROLE = "role"
SESSION_KEY_SESSION_ID = "session_id"
SESSION_KEY_CSRF = "csrf"
SESSION_KEY_CART_ID = "cart_id"


class SessionData(dict[str, Any]):
    @property
    def user_id(self) -> int | None:
        value = self.get(SESSION_KEY_USER_ID)
        if not isinstance(value, int | str):
            return None
        try:
            # A tampered/stale cookie must read as unauthenticated, not 500.
            return int(value)
        except (TypeError, ValueError):
            return None

    @property
    def role(self) -> str | None:
        value = self.get(SESSION_KEY_ROLE)
        return str(value) if value is not None else None

    @property
    def csrf(self) -> str | None:
        value = self.get(SESSION_KEY_CSRF)
        return str(value) if value is not None else None


def set_authenticated_session(request: Request, user: User) -> str:
    csrf_token = secrets.token_urlsafe(32)
    request.session.clear()
    request.session.update(
        {
            SESSION_KEY_USER_ID: user.user_id,
            SESSION_KEY_ROLE: user.role.value,
            SESSION_KEY_SESSION_ID: str(uuid4()),
            SESSION_KEY_CSRF: csrf_token,
        }
    )
    return csrf_token


def ensure_csrf_token(request: Request) -> str:
    csrf_token = request.session.get(SESSION_KEY_CSRF)
    if isinstance(csrf_token, str) and csrf_token:
        return csrf_token

    csrf_token = secrets.token_urlsafe(32)
    request.session[SESSION_KEY_CSRF] = csrf_token
    return csrf_token


def clear_authenticated_session(request: Request) -> None:
    request.session.clear()


def read_cart_id(request: Request) -> int | None:
    value = request.session.get(SESSION_KEY_CART_ID)
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def set_cart_id(request: Request, cart_id: int) -> None:
    request.session[SESSION_KEY_CART_ID] = cart_id


def read_session(request: Request) -> SessionData:
    return SessionData(request.session)
