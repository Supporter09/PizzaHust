"""Test session: required secrets must be set (no in-code credential fallbacks)."""

from __future__ import annotations

import os
from pathlib import Path

import pytest


def _load_application_dotenv() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.is_file():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def pytest_configure(config: pytest.Config) -> None:
    _load_application_dotenv()
    required = (
        "SESSION_SECRET",
        "ADMIN_SEED_PASSWORD",
        "KITCHEN_SEED_PASSWORD",
        "DELIVERY_WEBHOOK_SECRET",
    )
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise pytest.UsageError(
            "Missing required environment variables: "
            f"{', '.join(missing)}. Copy Application/.env.example to Application/.env."
        )
