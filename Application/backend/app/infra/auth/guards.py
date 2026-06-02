from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.infra.auth.session_state import read_session
from app.infra.db.models import User, UserRole
from app.infra.db.session import get_db_session

DBSession = Annotated[Session, Depends(get_db_session)]


def get_current_user(request: Request, db: DBSession) -> User:
    # Sync def on purpose: FastAPI runs sync dependencies in a threadpool, so the
    # synchronous ORM query below does not block the event loop.
    session = read_session(request)
    user_id = session.user_id
    if user_id is None:
        raise APIError(
            code="UNAUTHENTICATED",
            message="You must log in first.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    user = db.scalar(select(User).where(User.user_id == user_id))
    if user is None:
        request.session.clear()
        raise APIError(
            code="UNAUTHENTICATED",
            message="Session is invalid. Please log in again.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    if user.is_locked:
        # A6 account lock must take effect on every authenticated request.
        raise APIError(
            code="FORBIDDEN",
            message="This account is locked.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    return user


def require_role(*roles: UserRole):
    allowed_roles = {role.value for role in roles}

    async def _dependency(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role.value not in allowed_roles:
            raise APIError(
                code="FORBIDDEN",
                message="You do not have permission to access this resource.",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        return user

    return _dependency
