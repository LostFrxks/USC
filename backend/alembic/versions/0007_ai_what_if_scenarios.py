"""add ai what-if scenario table

Revision ID: 0007_ai_what_if_scenarios
Revises: 0006_ai_chat_persistence
Create Date: 2026-03-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0007_ai_what_if_scenarios"
down_revision = "0006_ai_chat_persistence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_what_if_scenario",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("accounts_user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", sa.BigInteger(), sa.ForeignKey("companies_company.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("horizon_days", sa.BigInteger(), nullable=False),
        sa.Column("selected_month", sa.String(length=7), nullable=True),
        sa.Column("levers_json", sa.Text(), nullable=False),
        sa.Column("result_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_ai_what_if_scenario_user_company_role_updated_at",
        "ai_what_if_scenario",
        ["user_id", "company_id", "role", "updated_at"],
    )
    op.create_index(
        "ix_ai_what_if_scenario_company_updated_at",
        "ai_what_if_scenario",
        ["company_id", "updated_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_what_if_scenario_company_updated_at", table_name="ai_what_if_scenario")
    op.drop_index("ix_ai_what_if_scenario_user_company_role_updated_at", table_name="ai_what_if_scenario")
    op.drop_table("ai_what_if_scenario")
