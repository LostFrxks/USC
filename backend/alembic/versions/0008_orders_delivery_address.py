"""add delivery_address to orders

Revision ID: 0008_orders_delivery_address
Revises: 0007_ai_what_if_scenarios
Create Date: 2026-03-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0008_orders_delivery_address"
down_revision = "0007_ai_what_if_scenarios"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders_order", sa.Column("delivery_address", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders_order", "delivery_address")
