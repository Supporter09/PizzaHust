"""Session and auth helpers.

Starlette SessionMiddleware stores a signed cookie. We write the current user_id
and role into request.session so every handler can read them.
"""

from __future__ import annotations

from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.infra.db.models import User, UserRole

_ph = PasswordHasher()


def hash_password(plaintext: str) -> str:
    return _ph.hash(plaintext)


def verify_password(plaintext: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, plaintext)
    except VerifyMismatchError:
        return False


def set_session(request: Request, user: User) -> None:
    request.session["user_id"] = user.user_id
    request.session["role"] = user.role.value


def clear_session(request: Request) -> None:
    request.session.clear()


def current_user_id(request: Request) -> int | None:
    uid = request.session.get("user_id")
    return int(uid) if uid is not None else None


def current_role(request: Request) -> str | None:
    return request.session.get("role")


def get_current_user(request: Request, db: Session) -> User:
    uid = current_user_id(request)
    if uid is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="UNAUTHENTICATED")
    user: User | None = db.get(User, uid)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="UNAUTHENTICATED")
    if user.is_locked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")
    return user


def require_role(*roles: UserRole) -> Any:
    """FastAPI dependency factory that checks the session role."""

    def _dep(request: Request, db: Session) -> User:  # db injected by caller router
        user = get_current_user(request, db)
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")
        return user

    return _dep
