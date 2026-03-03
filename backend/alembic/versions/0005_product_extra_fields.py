"""add extra product card fields

Revision ID: 0005_product_extra_fields
Revises: 0004_notifications_persistence
Create Date: 2026-03-02
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0005_product_extra_fields"
down_revision = "0004_notifications_persistence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("catalog_product", sa.Column("shelf_life_days", sa.BigInteger(), nullable=True))
    op.add_column("catalog_product", sa.Column("storage_condition", sa.String(length=120), nullable=True))
    op.add_column("catalog_product", sa.Column("origin_country", sa.String(length=80), nullable=True))
    op.add_column("catalog_product", sa.Column("brand", sa.String(length=120), nullable=True))
    op.add_column("catalog_product", sa.Column("manufacturer", sa.String(length=120), nullable=True))
    op.add_column("catalog_product", sa.Column("package_type", sa.String(length=80), nullable=True))
    op.add_column("catalog_product", sa.Column("net_weight_grams", sa.Numeric(12, 3), nullable=True))
    op.add_column("catalog_product", sa.Column("allergens", sa.Text(), nullable=True))
    op.add_column("catalog_product", sa.Column("certifications", sa.Text(), nullable=True))
    op.add_column("catalog_product", sa.Column("lead_time_days", sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column("catalog_product", "lead_time_days")
    op.drop_column("catalog_product", "certifications")
    op.drop_column("catalog_product", "allergens")
    op.drop_column("catalog_product", "net_weight_grams")
    op.drop_column("catalog_product", "package_type")
    op.drop_column("catalog_product", "manufacturer")
    op.drop_column("catalog_product", "brand")
    op.drop_column("catalog_product", "origin_country")
    op.drop_column("catalog_product", "storage_condition")
    op.drop_column("catalog_product", "shelf_life_days")
