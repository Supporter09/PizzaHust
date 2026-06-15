"""API serialization helpers shared across routers."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from pydantic import PlainSerializer, WithJsonSchema


def _utc_iso(value: datetime) -> str:
    """Render a stored naive-UTC datetime as an explicit UTC ISO-8601 string.

    Timestamps are persisted naive UTC (see ``app.infra.timezone``). Emitting them
    without an offset makes a JS ``new Date(...)`` client read them as browser-local,
    which skews relative-time displays by the local offset (the GMT vs GMT+7 bug).
    Naive values are assumed UTC; aware values are normalized to UTC; the result
    carries a trailing ``Z`` so the instant is unambiguous.
    """
    aware = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return aware.isoformat().replace("+00:00", "Z")


# A datetime field that always serializes to a UTC-aware ISO-8601 string (…Z).
# WithJsonSchema keeps the OpenAPI shape as string/date-time (no contract drift);
# only the emitted value changes (now offset-qualified).
UtcDateTime = Annotated[
    datetime,
    PlainSerializer(_utc_iso, return_type=str, when_used="json"),
    WithJsonSchema({"type": "string", "format": "date-time"}, mode="serialization"),
]
