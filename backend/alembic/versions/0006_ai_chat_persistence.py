"""add ai chat persistence tables

Revision ID: 0006_ai_chat_persistence
Revises: 0005_product_extra_fields
Create Date: 2026-03-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0006_ai_chat_persistence"
down_revision = "0005_product_extra_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_chat_session",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("accounts_user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.BigInteger(), sa.ForeignKey("companies_company.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_ai_chat_session_user_company_role_updated_at",
        "ai_chat_session",
        ["user_id", "company_id", "role", "updated_at"],
    )
    op.create_index(
        "ix_ai_chat_session_user_updated_at",
        "ai_chat_session",
        ["user_id", "updated_at"],
    )

    op.create_table(
        "ai_chat_message",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("session_id", sa.BigInteger(), sa.ForeignKey("ai_chat_session.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_ai_chat_message_session_created_id",
        "ai_chat_message",
        ["session_id", "created_at", "id"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_chat_message_session_created_id", table_name="ai_chat_message")
    op.drop_table("ai_chat_message")
    op.drop_index("ix_ai_chat_session_user_updated_at", table_name="ai_chat_session")
    op.drop_index("ix_ai_chat_session_user_company_role_updated_at", table_name="ai_chat_session")
    op.drop_table("ai_chat_session")
