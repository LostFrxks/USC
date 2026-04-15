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

# --- Auth refresh sessions ---
auth_refresh_session = Table(
    "auth_refresh_session",
    metadata,
    Column("id", BigInteger, primary_key=True),
    Column("user_id", BigInteger, ForeignKey("accounts_user.id", ondelete="CASCADE"), nullable=False),
    Column("jti", String(64), nullable=False, unique=True),
    Column("sid", String(64), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("revoked_at", DateTime(timezone=True), nullable=True),
    Column("replaced_by_jti", String(64), nullable=True),
    Column("ip", String(64), nullable=True),
    Column("user_agent", String(255), nullable=True),
    Column("metadata_json", Text, nullable=True),
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
    Column("shelf_life_days", BigInteger, nullable=True),
    Column("storage_condition", String(120), nullable=True),
    Column("origin_country", String(80), nullable=True),
    Column("brand", String(120), nullable=True),
    Column("manufacturer", String(120), nullable=True),
    Column("package_type", String(80), nullable=True),
    Column("net_weight_grams", Numeric(12, 3), nullable=True),
    Column("allergens", Text, nullable=True),
    Column("certifications", Text, nullable=True),
    Column("lead_time_days", BigInteger, nullable=True),
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
    Column("delivery_address", Text, nullable=True),
    Column("delivery_lat", Numeric(9, 6), nullable=True),
    Column("delivery_lng", Numeric(9, 6), nullable=True),
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
    Column("fulfilled_qty", Numeric(12, 2), nullable=False),
    Column("undelivered_qty", Numeric(12, 2), nullable=False),
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


# --- Audit / Idempotency ---
audit_event = Table(
    "audit_event",
    metadata,
    Column("id", BigInteger, primary_key=True),
    Column("occurred_at", DateTime(timezone=True), nullable=False),
    Column("actor_user_id", BigInteger, ForeignKey("accounts_user.id", ondelete="SET NULL"), nullable=True),
    Column("actor_company_id", BigInteger, ForeignKey("companies_company.id", ondelete="SET NULL"), nullable=True),
    Column("domain", String(32), nullable=False),
    Column("action", String(64), nullable=False),
    Column("resource_type", String(64), nullable=False),
    Column("resource_id", String(128), nullable=False),
    Column("request_id", String(64), nullable=False),
    Column("ip", String(64), nullable=True),
    Column("user_agent", String(255), nullable=True),
    Column("outcome", String(32), nullable=False),
    Column("payload_json", Text, nullable=False),
)

idempotency_record = Table(
    "idempotency_record",
    metadata,
    Column("id", BigInteger, primary_key=True),
    Column("scope", String(128), nullable=False),
    Column("idempotency_key", String(128), nullable=False),
    Column("body_hash", String(64), nullable=False),
    Column("response_status", BigInteger, nullable=True),
    Column("response_body_json", Text, nullable=True),
    Column("resource_type", String(64), nullable=False),
    Column("resource_id", String(128), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
)

# --- Notifications ---
notification_event = Table(
    "notification_event",
    metadata,
    Column("id", BigInteger, primary_key=True),
    Column("domain", String(32), nullable=False),
    Column("event_type", String(64), nullable=False),
    Column("resource_type", String(64), nullable=False),
    Column("resource_id", String(128), nullable=False),
    Column("title", String(255), nullable=False),
    Column("text", Text, nullable=False),
    Column("payload_json", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

notification_user_state = Table(
    "notification_user_state",
    metadata,
    Column("id", BigInteger, primary_key=True),
    Column("notification_id", BigInteger, ForeignKey("notification_event.id", ondelete="CASCADE"), nullable=False),
    Column("user_id", BigInteger, ForeignKey("accounts_user.id", ondelete="CASCADE"), nullable=False),
    Column("is_read", Boolean, nullable=False),
    Column("read_at", DateTime(timezone=True), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
)


# --- AI chat persistence ---
ai_chat_session = Table(
    "ai_chat_session",
    metadata,
    Column("id", BigInteger, primary_key=True),
    Column("user_id", BigInteger, ForeignKey("accounts_user.id", ondelete="CASCADE"), nullable=False),
    Column("company_id", BigInteger, ForeignKey("companies_company.id", ondelete="CASCADE"), nullable=False),
    Column("role", String(20), nullable=False),
    Column("title", String(120), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    Column("last_message_at", DateTime(timezone=True), nullable=True),
)

ai_chat_message = Table(
    "ai_chat_message",
    metadata,
    Column("id", BigInteger, primary_key=True),
    Column("session_id", BigInteger, ForeignKey("ai_chat_session.id", ondelete="CASCADE"), nullable=False),
    Column("role", String(20), nullable=False),
    Column("text", Text, nullable=False),
    Column("payload_json", Text, nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
)


# --- AI what-if scenarios ---
ai_what_if_scenario = Table(
    "ai_what_if_scenario",
    metadata,
    Column("id", BigInteger, primary_key=True),
    Column("user_id", BigInteger, ForeignKey("accounts_user.id", ondelete="CASCADE"), nullable=False),
    Column("company_id", BigInteger, ForeignKey("companies_company.id", ondelete="CASCADE"), nullable=False),
    Column("role", String(20), nullable=False),
    Column("title", String(120), nullable=False),
    Column("horizon_days", BigInteger, nullable=False),
    Column("selected_month", String(7), nullable=True),
    Column("levers_json", Text, nullable=False),
    Column("result_json", Text, nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)
