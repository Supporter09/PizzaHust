from __future__ import annotations

from secrets import compare_digest
from typing import Annotated

from fastapi import Depends, Request, status

from app.core.errors import APIError
from app.infra.auth.session_state import read_session
from app.infra.config import Settings, get_settings_dependency


async def enforce_csrf(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings_dependency)],
) -> None:
    session = read_session(request)
    expected = session.csrf
    provided_header = request.headers.get("X-CSRF-Token")
    cookie_value = request.cookies.get(settings.csrf_cookie_name)

    if not expected or not provided_header or not cookie_value:
        raise APIError(
            code="FORBIDDEN",
            message="Missing CSRF token.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    if not (compare_digest(expected, provided_header) and compare_digest(expected, cookie_value)):
        raise APIError(
            code="FORBIDDEN",
            message="Invalid CSRF token.",
            status_code=status.HTTP_403_FORBIDDEN,
        )
