from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import insert

from app.services.idempotency import canonical_body_hash
from app.db.schema import idempotency_record
from tests.test_helpers import (
    auth_headers,
    seed_company,
    seed_membership,
    seed_order,
    seed_product,
    seed_user,
)


def _base_order_payload() -> dict:
    return {
        "buyer_company_id": 10,
        "supplier_company_id": 20,
        "delivery_address": "Addr",
        "comment": "test",
        "items": [{"product_id": 1000, "qty": 2}],
    }


def test_create_order_rejects_supplier_mismatch(client, db_session):
    seed_user(db_session, user_id=1, email="buyer@test.local")
    seed_company(db_session, company_id=10, name="Buyer Co", company_type="BUYER")
    seed_company(db_session, company_id=20, name="Supplier A", company_type="SUPPLIER")
    seed_company(db_session, company_id=30, name="Supplier B", company_type="SUPPLIER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10)
    seed_product(db_session, product_id=1000, supplier_company_id=30, category_id=1, price=Decimal("15"))
    db_session.commit()

    response = client.post(
        "/api/orders/create/",
        json=_base_order_payload(),
        headers=auth_headers(1, "buyer@test.local"),
    )

    assert response.status_code == 422
    detail = response.json().get("detail", {})
    assert detail.get("error", {}).get("code") == "PRODUCT_SUPPLIER_MISMATCH"


def test_create_order_idempotency_conflict_returns_409(client, db_session, monkeypatch):
    monkeypatch.setattr("app.routers.orders.create_notification_event", lambda *args, **kwargs: None)
    seed_user(db_session, user_id=1, email="buyer@test.local")
    seed_user(db_session, user_id=2, email="supplier@test.local")
    seed_company(db_session, company_id=10, name="Buyer Co", company_type="BUYER")
    seed_company(db_session, company_id=20, name="Supplier Co", company_type="SUPPLIER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10)
    seed_membership(db_session, member_id=2, user_id=2, company_id=20)
    seed_product(db_session, product_id=1000, supplier_company_id=20, category_id=1, price=Decimal("15"))
    db_session.commit()

    headers = {
        **auth_headers(1, "buyer@test.local"),
        "Idempotency-Key": "same-key-001",
    }

    base_payload = _base_order_payload()
    db_session.execute(
        insert(idempotency_record).values(
            {
                "id": 1,
                "scope": "buyer:10:POST:/orders/create",
                "idempotency_key": "same-key-001",
                "body_hash": canonical_body_hash(base_payload),
                "response_status": None,
                "response_body_json": None,
                "resource_type": "order",
                "resource_id": None,
                "created_at": datetime.now(timezone.utc),
                "expires_at": datetime(2099, 1, 1, tzinfo=timezone.utc),
            }
        )
    )
    db_session.commit()

    changed_payload = _base_order_payload()
    changed_payload["items"] = [{"product_id": 1000, "qty": 5}]
    second = client.post("/api/orders/create/", json=changed_payload, headers=headers)

    assert second.status_code == 409
    detail = second.json().get("detail", {})
    assert detail.get("error", {}).get("code") == "IDEMPOTENCY_CONFLICT"


def test_order_detail_exposes_delivery_address_separately_from_comment(client, db_session):
    seed_user(db_session, user_id=1, email="buyer@test.local")
    seed_company(db_session, company_id=10, name="Buyer Co", company_type="BUYER")
    seed_company(db_session, company_id=20, name="Supplier Co", company_type="SUPPLIER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10)
    seed_order(
        db_session,
        order_id=900,
        buyer_company_id=10,
        supplier_company_id=20,
        status="PENDING",
        delivery_address="Addr",
        comment="test",
    )
    db_session.commit()

    response = client.get(
        "/api/orders/900/?buyer_company_id=10",
        headers=auth_headers(1, "buyer@test.local"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["delivery_address"] == "Addr"
    assert payload["comment"] == "test"
