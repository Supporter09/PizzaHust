from __future__ import annotations

import time
from collections import deque
from threading import Lock
from typing import Annotated

from fastapi import Depends, Request, status

from app.api.errors import APIError
from app.infra.config import Settings, get_settings_dependency


class InMemoryRateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            window = self._events.setdefault(key, deque())
            while window and (now - window[0]) > self.window_seconds:
                window.popleft()
            if len(window) >= self.limit:
                return False
            window.append(now)
            return True


_auth_limiter: InMemoryRateLimiter | None = None
_auth_limiter_limit: int | None = None


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",", maxsplit=1)[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _get_auth_limiter(limit: int) -> InMemoryRateLimiter:
    global _auth_limiter
    global _auth_limiter_limit

    if _auth_limiter is None or _auth_limiter_limit != limit:
        _auth_limiter = InMemoryRateLimiter(limit=limit, window_seconds=60)
        _auth_limiter_limit = limit
    return _auth_limiter


async def enforce_auth_rate_limit(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings_dependency)],
) -> None:
    limiter = _get_auth_limiter(settings.auth_rate_limit_per_minute)
    key = f"{request.url.path}:{_client_ip(request)}"
    if not limiter.allow(key):
        raise APIError(
            code="RATE_LIMITED",
            message="Too many requests. Please try again later.",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )
