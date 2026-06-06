from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = Field(alias="DATABASE_URL")

    session_secret: str = Field(alias="SESSION_SECRET")
    session_cookie_name: str = Field(default="pizzahust_session", alias="SESSION_COOKIE_NAME")
    # gt=0: a non-positive session age would expire every cookie instantly.
    session_max_age_seconds: int = Field(
        default=60 * 60 * 24 * 14, gt=0, alias="SESSION_MAX_AGE_SECONDS"
    )
    session_https_only: bool = Field(default=False, alias="SESSION_HTTPS_ONLY")
    session_same_site: str = Field(default="lax", alias="SESSION_SAME_SITE")
    frontend_origin: str = Field(default="http://localhost:3000", alias="FRONTEND_ORIGIN")

    csrf_cookie_name: str = Field(default="csrf_token", alias="CSRF_COOKIE_NAME")

    # ge=1: a limit of 0 would reject every auth request.
    auth_rate_limit_per_minute: int = Field(default=5, ge=1, alias="AUTH_RATE_LIMIT_PER_MINUTE")

    # Image upload (A1 product images). Files persist outside the container via a
    # mounted volume; served read-only by a StaticFiles mount at image_base_url.
    image_upload_dir: str = Field(default="/data/images", alias="IMAGE_UPLOAD_DIR")
    image_base_url: str = Field(default="/images", alias="IMAGE_BASE_URL")
    image_max_bytes: int = Field(default=5 * 1024 * 1024, gt=0, alias="IMAGE_MAX_BYTES")

    # Upper bound on an uploaded CSV (A1 bulk import); rejected with 400 if exceeded.
    csv_import_max_bytes: int = Field(default=2 * 1024 * 1024, gt=0, alias="CSV_IMPORT_MAX_BYTES")

    admin_seed_phone: str = Field(default="0900000001", alias="ADMIN_SEED_PHONE")
    kitchen_seed_phone: str = Field(default="0900000002", alias="KITCHEN_SEED_PHONE")
    # No defaults: privileged seed passwords must come from the environment so no
    # weak credential is baked into the source. .env.example documents dev values.
    admin_seed_password: str | None = Field(default=None, alias="ADMIN_SEED_PASSWORD")
    kitchen_seed_password: str | None = Field(default=None, alias="KITCHEN_SEED_PASSWORD")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


async def get_settings_dependency() -> Settings:
    return get_settings()
