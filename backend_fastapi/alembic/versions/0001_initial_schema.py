"""initial schema (managed by FastAPI + Alembic, not Django)

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-01-31
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ----------------------------
    # accounts_user
    # ----------------------------
    op.create_table(
        "accounts_user",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("password", sa.String(length=128), nullable=False),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("first_name", sa.String(length=50), nullable=False, server_default=""),
        sa.Column("last_name", sa.String(length=50), nullable=False, server_default=""),
        sa.Column("phone", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("is_courier_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_staff", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("email", name="accounts_user_email_key"),
    )
    # Django typically creates a LIKE index for pattern ops; not strictly required.
    op.create_index("ix_accounts_user_email", "accounts_user", ["email"])

    # ----------------------------
    # companies
    # ----------------------------
    op.create_table(
        "companies_company",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("company_type", sa.String(length=20), nullable=False, server_default="BUYER"),
        sa.Column("phone", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("address", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "companies_companymember",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="OWNER"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("company_id", sa.BigInteger(), sa.ForeignKey("companies_company.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("accounts_user.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("user_id", "company_id", name="companies_companymember_user_id_company_id_uniq"),
    )
    op.create_index("ix_companymember_company_id", "companies_companymember", ["company_id"])
    op.create_index("ix_companymember_user_id", "companies_companymember", ["user_id"])

    # ----------------------------
    # catalog
    # ----------------------------
    op.create_table(
        "catalog_category",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.UniqueConstraint("name", name="catalog_category_name_key"),
    )
    op.create_index("ix_catalog_category_name", "catalog_category", ["name"])

    op.create_table(
        "catalog_product",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("unit", sa.String(length=50), nullable=False, server_default=""),
        sa.Column("min_qty", sa.Numeric(12, 2), nullable=False, server_default="1"),
        sa.Column("in_stock", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("category_id", sa.BigInteger(), sa.ForeignKey("catalog_category.id", ondelete="SET NULL"), nullable=True),
        sa.Column("supplier_company_id", sa.BigInteger(), sa.ForeignKey("companies_company.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("stock_qty", sa.Numeric(12, 2), nullable=True),
        sa.Column("track_inventory", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_catalog_product_supplier_company_id", "catalog_product", ["supplier_company_id"])
    op.create_index("ix_catalog_product_category_id", "catalog_product", ["category_id"])

    # ----------------------------
    # orders
    # ----------------------------
    op.create_table(
        "orders_order",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
        sa.Column("delivery_mode", sa.String(length=30), nullable=False, server_default="YANDEX"),
        sa.Column("comment", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("buyer_company_id", sa.BigInteger(), sa.ForeignKey("companies_company.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("supplier_company_id", sa.BigInteger(), sa.ForeignKey("companies_company.id", ondelete="RESTRICT"), nullable=False),
    )
    op.create_index("ix_orders_order_buyer_company_id", "orders_order", ["buyer_company_id"])
    op.create_index("ix_orders_order_supplier_company_id", "orders_order", ["supplier_company_id"])

    op.create_table(
        "orders_orderitem",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("qty", sa.Numeric(12, 2), nullable=False),
        sa.Column("price_snapshot", sa.Numeric(12, 2), nullable=False),
        sa.Column("order_id", sa.BigInteger(), sa.ForeignKey("orders_order.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.BigInteger(), sa.ForeignKey("catalog_product.id", ondelete="RESTRICT"), nullable=False),
    )
    op.create_index("ix_orders_orderitem_order_id", "orders_orderitem", ["order_id"])
    op.create_index("ix_orders_orderitem_product_id", "orders_orderitem", ["product_id"])

    # ----------------------------
    # deliveries
    # ----------------------------
    op.create_table(
        "delivery_deliveryassignment",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ASSIGNED"),
        sa.Column("tracking_link", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("courier_id", sa.BigInteger(), sa.ForeignKey("accounts_user.id", ondelete="SET NULL"), nullable=True),
        sa.Column("order_id", sa.BigInteger(), sa.ForeignKey("orders_order.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("order_id", name="delivery_deliveryassignment_order_id_key"),
    )
    op.create_index("ix_delivery_assignment_courier_id", "delivery_deliveryassignment", ["courier_id"])


def downgrade() -> None:
    op.drop_index("ix_delivery_assignment_courier_id", table_name="delivery_deliveryassignment")
    op.drop_table("delivery_deliveryassignment")

    op.drop_index("ix_orders_orderitem_product_id", table_name="orders_orderitem")
    op.drop_index("ix_orders_orderitem_order_id", table_name="orders_orderitem")
    op.drop_table("orders_orderitem")

    op.drop_index("ix_orders_order_supplier_company_id", table_name="orders_order")
    op.drop_index("ix_orders_order_buyer_company_id", table_name="orders_order")
    op.drop_table("orders_order")

    op.drop_index("ix_catalog_product_category_id", table_name="catalog_product")
    op.drop_index("ix_catalog_product_supplier_company_id", table_name="catalog_product")
    op.drop_table("catalog_product")

    op.drop_index("ix_catalog_category_name", table_name="catalog_category")
    op.drop_table("catalog_category")

    op.drop_index("ix_companymember_user_id", table_name="companies_companymember")
    op.drop_index("ix_companymember_company_id", table_name="companies_companymember")
    op.drop_table("companies_companymember")

    op.drop_table("companies_company")

    op.drop_index("ix_accounts_user_email", table_name="accounts_user")
    op.drop_table("accounts_user")

