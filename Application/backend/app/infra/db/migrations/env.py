"""Alembic env. Real metadata is wired in infra-003."""

from __future__ import annotations

import os

from alembic import context
from sqlalchemy import engine_from_config, pool

config = context.config
config.set_main_option(
    "sqlalchemy.url",
    os.getenv("DATABASE_URL", config.get_main_option("sqlalchemy.url") or ""),
)

target_metadata = None  # set in infra-003 once SQLAlchemy models exist


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
