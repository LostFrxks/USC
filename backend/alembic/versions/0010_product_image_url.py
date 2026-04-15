"""add product image url

Revision ID: 0010_product_image_url
Revises: 0009_orders_delivery_coordinates
Create Date: 2026-04-15
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0010_product_image_url"
down_revision = "0009_orders_delivery_coordinates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("catalog_product", sa.Column("image_url", sa.String(length=500), nullable=True))
    op.execute(
        """
        UPDATE catalog_product
        SET image_url = CASE category_id
            WHEN 1 THEN '/media/card_meat1.jpg'
            WHEN 2 THEN '/media/card_milk1.jpg'
            WHEN 3 THEN '/media/card_fish1.jpg'
            WHEN 4 THEN '/media/card_bread1.jpg'
            WHEN 5 THEN '/media/card_fruit1.jpg'
            WHEN 6 THEN '/media/card_grain1.jpg'
            ELSE image_url
        END
        WHERE image_url IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("catalog_product", "image_url")
