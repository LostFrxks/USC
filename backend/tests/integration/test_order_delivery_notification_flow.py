from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select

from app.db.schema import notification_event, notification_user_state
from backend.tests.test_helpers import auth_headers, seed_company, seed_membership, seed_product, seed_user


def test_auth_create_order_creates_notifications(client, db_session):
    seed_user(db_session, user_id=1, email="buyer@test.local", password="buyer-pass")
    seed_user(db_session, user_id=2, email="supplier@test.local", password="supplier-pass")
    seed_company(db_session, company_id=10, name="Buyer Co", company_type="BUYER")
    seed_company(db_session, company_id=20, name="Supplier Co", company_type="SUPPLIER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10)
    seed_membership(db_session, member_id=2, user_id=2, company_id=20)
    seed_product(db_session, product_id=1000, supplier_company_id=20, category_id=1, price=Decimal("20"))
    db_session.commit()

    login = client.post(
        "/api/auth/login/",
        json={"email": "buyer@test.local", "password": "buyer-pass"},
    )
    assert login.status_code == 200
    access = login.json()["access"]

    create = client.post(
        "/api/orders/create/",
        json={
            "buyer_company_id": 10,
            "supplier_company_id": 20,
            "delivery_address": "Bishkek",
            "comment": "Integration create",
            "items": [{"product_id": 1000, "qty": 3}],
        },
        headers={"Authorization": f"Bearer {access}", "Idempotency-Key": "int-order-1"},
    )
    assert create.status_code == 200

    event_count = db_session.execute(select(func.count(notification_event.c.id))).scalar_one()
    state_count = db_session.execute(select(func.count(notification_user_state.c.id))).scalar_one()
    assert int(event_count) >= 1
    assert int(state_count) >= 2


def test_delivery_status_change_syncs_order_and_fulfillment(client, db_session):
    seed_user(db_session, user_id=1, email="buyer@test.local")
    seed_user(db_session, user_id=2, email="supplier@test.local")
    seed_company(db_session, company_id=10, name="Buyer Co", company_type="BUYER")
    seed_company(db_session, company_id=20, name="Supplier Co", company_type="SUPPLIER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10)
    seed_membership(db_session, member_id=2, user_id=2, company_id=20)

    # Use API create to ensure delivery assignment exists.
    seed_product(db_session, product_id=1000, supplier_company_id=20, category_id=1, price=Decimal("30"))
    db_session.commit()

    create = client.post(
        "/api/orders/create/",
        json={
            "buyer_company_id": 10,
            "supplier_company_id": 20,
            "delivery_address": "Bishkek",
            "comment": "Delivery flow",
            "items": [{"product_id": 1000, "qty": 10}],
        },
        headers={**auth_headers(1, "buyer@test.local"), "Idempotency-Key": "int-order-2"},
    )
    assert create.status_code == 200
    order_id = int(create.json()["id"])

    delivery = client.get(f"/api/deliveries/by_order/{order_id}/", headers=auth_headers(1, "buyer@test.local"))
    assert delivery.status_code == 200
    delivery_id = int(delivery.json()["id"])

    on_way = client.post(
        f"/api/deliveries/{delivery_id}/set_status/",
        json={"status": "PICKED_UP"},
        headers=auth_headers(1, "buyer@test.local"),
    )
    assert on_way.status_code == 200

    to_route = client.post(
        f"/api/deliveries/{delivery_id}/set_status/",
        json={"status": "ON_THE_WAY"},
        headers=auth_headers(1, "buyer@test.local"),
    )
    assert to_route.status_code == 200

    partial = client.post(
        f"/api/deliveries/{delivery_id}/set_status/",
        json={
            "status": "PARTIALLY_DELIVERED",
            "items": [{"product_id": 1000, "fulfilled_qty": 6, "undelivered_qty": 4}],
        },
        headers=auth_headers(1, "buyer@test.local"),
    )
    assert partial.status_code == 200

    detail = client.get(f"/api/orders/{order_id}/?buyer_company_id=10", headers=auth_headers(1, "buyer@test.local"))
    assert detail.status_code == 200
    body = detail.json()
    assert body["status"] == "PARTIALLY_DELIVERED"
    assert float(body["items"][0]["fulfilled_qty"]) == 6
    assert float(body["items"][0]["undelivered_qty"]) == 4
