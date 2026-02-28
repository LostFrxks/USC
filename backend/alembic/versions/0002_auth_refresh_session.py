"""add auth refresh session table

Revision ID: 0002_auth_refresh_session
Revises: 0001_initial_schema
Create Date: 2026-02-28
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0002_auth_refresh_session"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_refresh_session",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("accounts_user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("sid", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replaced_by_jti", sa.String(length=64), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("jti", name="auth_refresh_session_jti_key"),
    )
    op.create_index("ix_auth_refresh_session_user_id", "auth_refresh_session", ["user_id"])
    op.create_index("ix_auth_refresh_session_sid", "auth_refresh_session", ["sid"])
    op.create_index("ix_auth_refresh_session_expires_at", "auth_refresh_session", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_auth_refresh_session_expires_at", table_name="auth_refresh_session")
    op.drop_index("ix_auth_refresh_session_sid", table_name="auth_refresh_session")
    op.drop_index("ix_auth_refresh_session_user_id", table_name="auth_refresh_session")
    op.drop_table("auth_refresh_session")

