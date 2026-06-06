from __future__ import annotations

import time
from collections import deque
from threading import Lock
from typing import Annotated

from fastapi import Depends, Request, status

from app.core.errors import APIError
from app.infra.config import Settings, get_settings_dependency

# When the key map grows past this many buckets, sweep fully-expired buckets.
# Bounds memory against one-off keys (e.g. spoofed IPs) that never revisit.
_SWEEP_THRESHOLD = 1024


class InMemoryRateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()

    def _sweep_expired(self, now: float) -> None:
        cutoff = now - self.window_seconds
        stale = [k for k, w in self._events.items() if not w or w[-1] <= cutoff]
        for k in stale:
            del self._events[k]

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            if len(self._events) > _SWEEP_THRESHOLD:
                self._sweep_expired(now)
            window = self._events.setdefault(key, deque())
            while window and (now - window[0]) > self.window_seconds:
                window.popleft()
            if len(window) >= self.limit:
                return False
            window.append(now)
            return True


_auth_limiter: InMemoryRateLimiter | None = None
_auth_limiter_limit: int | None = None


def reset_auth_rate_limiter() -> None:
    global _auth_limiter
    global _auth_limiter_limit
    _auth_limiter = None
    _auth_limiter_limit = None


def _client_ip(request: Request) -> str:
    # Use the real peer address. X-Forwarded-For is client-controlled and the
    # backend is not behind a trusted reverse proxy in this stack, so honoring it
    # would let a caller spoof the key and bypass the limit. Revisit (with a
    # trusted-proxy allowlist) if a proxy is introduced.
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
