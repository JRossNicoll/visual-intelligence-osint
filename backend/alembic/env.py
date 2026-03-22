"""Alembic environment configuration for VIOSINT."""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Add the backend directory to the path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import all models so that Base.metadata contains all tables
from app.models import (  # noqa: E402, F401
    Alert,
    AuditLog,
    BehaviorRecord,
    Case,
    CaseEvidence,
    CaseIntelligence,
    CaseNote,
    Detection,
    Entity,
    EntityProfile,
    IntelligenceInsight,
    NegativeMatchPair,
    PendingMatch,
    Sighting,
    Stream,
    Target,
    TemporalEvent,
    VideoFile,
)
from app.models.base import Base  # noqa: E402

target_metadata = Base.metadata

# Override sqlalchemy.url from environment if available
db_url = os.environ.get("DATABASE_URL_SYNC")
if not db_url:
    pg_user = os.environ.get("POSTGRES_USER", "viosint")
    pg_pass = os.environ.get("POSTGRES_PASSWORD", "viosint")
    pg_host = os.environ.get("POSTGRES_HOST", "localhost")
    pg_port = os.environ.get("POSTGRES_PORT", "5432")
    pg_db = os.environ.get("POSTGRES_DB", "viosint")
    db_url = f"postgresql+psycopg2://{pg_user}:{pg_pass}@{pg_host}:{pg_port}/{pg_db}"

config.set_main_option("sqlalchemy.url", db_url)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
