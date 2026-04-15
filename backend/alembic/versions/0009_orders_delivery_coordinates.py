"""add delivery coordinates to orders

Revision ID: 0009_orders_delivery_coordinates
Revises: 0008_orders_delivery_address
Create Date: 2026-04-02
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0009_orders_delivery_coordinates"
down_revision = "0008_orders_delivery_address"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders_order", sa.Column("delivery_lat", sa.Numeric(9, 6), nullable=True))
    op.add_column("orders_order", sa.Column("delivery_lng", sa.Numeric(9, 6), nullable=True))


def downgrade() -> None:
    op.drop_column("orders_order", "delivery_lng")
    op.drop_column("orders_order", "delivery_lat")
