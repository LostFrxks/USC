"""
Explicit SQLAlchemy table definitions for USC.

Why this exists:
- Previously the FastAPI backend used SQLAlchemy reflection/autoload to read tables that
  were originally created by Django. That made the FastAPI runtime dependent on an
  existing Django-shaped database.
- With explicit tables + Alembic migrations we can create/maintain the schema from
  FastAPI, without Django.
"""

from __future__ import annotations

from sqlalchemy import Boolean, BigInteger, Column, DateTime, ForeignKey, MetaData, Numeric, String, Table, Text

metadata = MetaData()


# --- Accounts / Users ---
accounts_user = Table(
    "accounts_user",
    metadata,
    # Matches existing PostgreSQL schema (originally created via Django), but is now managed via Alembic.
    Column("id", BigInteger, primary_key=True),
    Column("password", String(128), nullable=False),
    Column("last_login", DateTime(timezone=True), nullable=True),
    Column("is_superuser", Boolean, nullable=False),
    Column("email", String(254), nullable=False, unique=True),
    Column("first_name", String(50), nullable=False),
    Column("last_name", String(50), nullable=False),
    Column("phone", String(32), nullable=False),
    Column("is_courier_enabled", Boolean, nullable=False),
    Column("is_active", Boolean, nullable=False),
    Column("is_staff", Boolean, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)


# --- Companies / Memberships ---
companies_company = Table(
    "companies_company",
    metadata,
    Column("id", BigInteger, primary_key=True),
    Column("name", String(255), nullable=False),
    Column("company_type", String(20), nullable=False),  # BUYER / SUPPLIER
    Column("phone", String(32), nullable=False),
    Column("address", String(255), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

companies_companymember = Table(
    "companies_companymember",
    metadata,
    Column("id", BigInteger, primary_key=True),
    Column("role", String(20), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("company_id", BigInteger, ForeignKey("companies_company.id", ondelete="CASCADE"), nullable=False),
    Column("user_id", BigInteger, ForeignKey("accounts_user.id", ondelete="CASCADE"), nullable=False),
)


# --- Catalog ---
catalog_category = Table(
    "catalog_category",
    metadata,
    Column("id", BigInteger, primary_key=True),
    Column("name", String(120), nullable=False, unique=True),
)

catalog_product = Table(
    "catalog_product",
    metadata,
    Column("id", BigInteger, primary_key=True),
    Column("name", String(255), nullable=False),
    Column("description", Text, nullable=False),
    Column("price", Numeric(12, 2), nullable=False),
    Column("unit", String(50), nullable=False),
    Column("min_qty", Numeric(12, 2), nullable=False),
    Column("in_stock", Boolean, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("category_id", BigInteger, ForeignKey("catalog_category.id", ondelete="SET NULL"), nullable=True),
    Column("supplier_company_id", BigInteger, ForeignKey("companies_company.id", ondelete="RESTRICT"), nullable=False),
    Column("stock_qty", Numeric(12, 2), nullable=True),
    Column("track_inventory", Boolean, nullable=False),
)


# --- Orders ---
orders_order = Table(
    "orders_order",
    metadata,
    Column("id", BigInteger, primary_key=True),
    Column("status", String(20), nullable=False),
    Column("delivery_mode", String(30), nullable=False),
    Column("comment", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("buyer_company_id", BigInteger, ForeignKey("companies_company.id", ondelete="RESTRICT"), nullable=False),
    Column("supplier_company_id", BigInteger, ForeignKey("companies_company.id", ondelete="RESTRICT"), nullable=False),
)

orders_orderitem = Table(
    "orders_orderitem",
    metadata,
    Column("id", BigInteger, primary_key=True),
    Column("qty", Numeric(12, 2), nullable=False),
    Column("price_snapshot", Numeric(12, 2), nullable=False),
    Column("order_id", BigInteger, ForeignKey("orders_order.id", ondelete="CASCADE"), nullable=False),
    Column("product_id", BigInteger, ForeignKey("catalog_product.id", ondelete="RESTRICT"), nullable=False),
)


# --- Delivery ---
delivery_deliveryassignment = Table(
    "delivery_deliveryassignment",
    metadata,
    Column("id", BigInteger, primary_key=True),
    Column("status", String(20), nullable=False),
    Column("tracking_link", String(500), nullable=False),
    Column("notes", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("courier_id", BigInteger, ForeignKey("accounts_user.id", ondelete="SET NULL"), nullable=True),
    Column("order_id", BigInteger, ForeignKey("orders_order.id", ondelete="CASCADE"), nullable=False, unique=True),
)
