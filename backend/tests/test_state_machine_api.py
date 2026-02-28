from __future__ import annotations

from decimal import Decimal

from backend.tests.test_helpers import (
    auth_headers,
    seed_company,
    seed_delivery,
    seed_membership,
    seed_order,
    seed_order_item,
    seed_product,
    seed_user,
)


def test_supplier_confirm_rejects_invalid_order_transition(client, db_session):
    seed_user(db_session, user_id=1, email="supplier@test.local")
    seed_company(db_session, company_id=10, name="Buyer", company_type="BUYER")
    seed_company(db_session, company_id=20, name="Supplier", company_type="SUPPLIER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=20)
    seed_product(db_session, product_id=1000, supplier_company_id=20, category_id=1, price=Decimal("10"))
    seed_order(
        db_session,
        order_id=500,
        buyer_company_id=10,
        supplier_company_id=20,
        status="DELIVERED",
    )
    seed_order_item(
        db_session,
        item_id=1,
        order_id=500,
        product_id=1000,
        qty=Decimal("2"),
        fulfilled_qty=Decimal("2"),
        price_snapshot=Decimal("10"),
    )
    db_session.commit()

    response = client.post(
        "/api/orders/500/supplier_confirm/",
        headers=auth_headers(1, "supplier@test.local"),
    )

    assert response.status_code == 409
    detail = response.json().get("detail", {})
    assert detail.get("error", {}).get("code") == "INVALID_STATE_TRANSITION"


def test_delivery_set_status_rejects_invalid_transition(client, db_session):
    seed_user(db_session, user_id=1, email="buyer@test.local")
    seed_company(db_session, company_id=10, name="Buyer", company_type="BUYER")
    seed_company(db_session, company_id=20, name="Supplier", company_type="SUPPLIER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10)
    seed_order(
        db_session,
        order_id=600,
        buyer_company_id=10,
        supplier_company_id=20,
        status="CONFIRMED",
    )
    seed_delivery(db_session, delivery_id=700, order_id=600, status="ASSIGNED")
    db_session.commit()

    response = client.post(
        "/api/deliveries/700/set_status/",
        json={"status": "DELIVERED"},
        headers=auth_headers(1, "buyer@test.local"),
    )

    assert response.status_code == 409
    detail = response.json().get("detail", {})
    assert detail.get("error", {}).get("code") == "INVALID_STATE_TRANSITION"
