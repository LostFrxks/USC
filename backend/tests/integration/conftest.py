from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.db.deps import get_db
from app.main import app

DB_URL = os.getenv("INTEGRATION_DATABASE_URL") or os.getenv("DATABASE_URL", "")
if not DB_URL.startswith("postgresql"):
    pytest.skip("Integration tests require PostgreSQL DATABASE_URL/INTEGRATION_DATABASE_URL", allow_module_level=True)

engine = create_engine(DB_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@pytest.fixture()
def db_session() -> Session:
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, autoflush=False, autocommit=False)
    try:
        # Keep tests isolated while staying on migrated schema.
        for table in (
            "notification_user_state",
            "notification_event",
            "audit_event",
            "idempotency_record",
            "delivery_deliveryassignment",
            "orders_orderitem",
            "orders_order",
            "catalog_product",
            "catalog_category",
            "companies_companymember",
            "companies_company",
            "auth_refresh_session",
            "accounts_user",
        ):
            session.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
        session.commit()
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session: Session) -> TestClient:
    def _get_test_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_test_db
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        app.dependency_overrides.clear()
