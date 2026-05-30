from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = Field(alias="DATABASE_URL")

    session_secret: str = Field(alias="SESSION_SECRET")
    session_cookie_name: str = Field(default="pizzahust_session", alias="SESSION_COOKIE_NAME")
    session_max_age_seconds: int = Field(default=60 * 60 * 24 * 14, alias="SESSION_MAX_AGE_SECONDS")
    session_https_only: bool = Field(default=False, alias="SESSION_HTTPS_ONLY")
    session_same_site: str = Field(default="lax", alias="SESSION_SAME_SITE")

    csrf_cookie_name: str = Field(default="csrf_token", alias="CSRF_COOKIE_NAME")

    auth_rate_limit_per_minute: int = Field(default=5, alias="AUTH_RATE_LIMIT_PER_MINUTE")

    admin_seed_phone: str = Field(default="0900000001", alias="ADMIN_SEED_PHONE")
    admin_seed_password: str = Field(default="admin123", alias="ADMIN_SEED_PASSWORD")
    kitchen_seed_phone: str = Field(default="0900000002", alias="KITCHEN_SEED_PHONE")
    kitchen_seed_password: str = Field(default="kitchen123", alias="KITCHEN_SEED_PASSWORD")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


async def get_settings_dependency() -> Settings:
    return get_settings()
