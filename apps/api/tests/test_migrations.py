"""Migrations are the source of truth for the schema; ORM models must never drift from them."""

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext

import app.models  # noqa: F401 - register models
from app.db.session import Base


def test_models_match_migrations(owner_engine) -> None:
    with owner_engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diff == [], f"ORM models differ from migrations: {diff}"
