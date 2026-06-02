"""Seed script. Idempotent baseline data for demo environments."""

from __future__ import annotations

from sqlalchemy import select

from app.infra.auth.passwords import hash_password
from app.infra.config import get_settings
from app.infra.db.models import User, UserRole
from app.infra.db.session import create_session_factory


def _upsert_role_user(
    *,
    full_name: str,
    phone_number: str,
    password: str,
    role: UserRole,
) -> None:
    with create_session_factory()() as session:
        existing = session.scalar(select(User).where(User.phone_number == phone_number))
        if existing is None:
            existing = User(
                full_name=full_name,
                phone_number=phone_number,
                password_hash=hash_password(password),
                address=None,
                role=role,
            )
            session.add(existing)
        else:
            existing.full_name = full_name
            existing.role = role
            existing.password_hash = hash_password(password)
            session.add(existing)

        session.commit()


def main() -> None:
    settings = get_settings()
    if not settings.admin_seed_password or not settings.kitchen_seed_password:
        raise SystemExit(
            "ADMIN_SEED_PASSWORD and KITCHEN_SEED_PASSWORD must be set to seed "
            "privileged accounts (see .env.example)."
        )
    _upsert_role_user(
        full_name="Demo Admin",
        phone_number=settings.admin_seed_phone,
        password=settings.admin_seed_password,
        role=UserRole.ADMIN,
    )
    _upsert_role_user(
        full_name="Demo Kitchen",
        phone_number=settings.kitchen_seed_phone,
        password=settings.kitchen_seed_password,
        role=UserRole.KITCHEN,
    )


if __name__ == "__main__":
    main()
