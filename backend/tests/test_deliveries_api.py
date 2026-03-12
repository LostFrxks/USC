from __future__ import annotations

from sqlalchemy import update

from app.db.schema import accounts_user
from tests.test_helpers import (
    auth_headers,
    seed_company,
    seed_delivery,
    seed_membership,
    seed_order,
    seed_user,
)


def test_deliveries_list_includes_order_comment(client, db_session):
    seed_user(db_session, user_id=1, email="buyer@test.local")
    seed_company(db_session, company_id=10, name="Buyer", company_type="BUYER")
    seed_company(db_session, company_id=20, name="Supplier", company_type="SUPPLIER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10)
    seed_order(
        db_session,
        order_id=101,
        buyer_company_id=10,
        supplier_company_id=20,
        status="CONFIRMED",
        comment="Door 3\n[geo:42.874600,74.569800]",
    )
    seed_delivery(db_session, delivery_id=900, order_id=101, status="ASSIGNED")
    db_session.commit()

    response = client.get("/api/deliveries/", headers=auth_headers(1, "buyer@test.local"))

    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["order_comment"] == "Door 3\n[geo:42.874600,74.569800]"


def test_buyer_cannot_change_delivery_status(client, db_session):
    seed_user(db_session, user_id=1, email="buyer@test.local")
    seed_user(db_session, user_id=2, email="supplier@test.local")
    seed_company(db_session, company_id=10, name="Buyer", company_type="BUYER")
    seed_company(db_session, company_id=20, name="Supplier", company_type="SUPPLIER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10, role="OWNER")
    seed_membership(db_session, member_id=2, user_id=2, company_id=20, role="OWNER")
    seed_order(db_session, order_id=101, buyer_company_id=10, supplier_company_id=20, status="CONFIRMED", comment="Door 3")
    seed_delivery(db_session, delivery_id=900, order_id=101, status="ASSIGNED")
    db_session.commit()

    response = client.post(
        "/api/deliveries/900/set_status/",
        json={"status": "ON_THE_WAY"},
        headers=auth_headers(1, "buyer@test.local"),
    )

    assert response.status_code == 403
    assert "supplier delivery manager" in response.json()["detail"]


def test_only_supplier_delivery_manager_can_upsert_delivery(client, db_session):
    seed_user(db_session, user_id=1, email="buyer@test.local")
    seed_company(db_session, company_id=10, name="Buyer", company_type="BUYER")
    seed_company(db_session, company_id=20, name="Supplier", company_type="SUPPLIER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10, role="OWNER")
    seed_order(db_session, order_id=101, buyer_company_id=10, supplier_company_id=20, status="PENDING", comment="Door 3")
    db_session.commit()

    response = client.post(
        "/api/deliveries/upsert_for_order/",
        json={"order": 101, "tracking_link": "https://track.local/1", "notes": "x"},
        headers=auth_headers(1, "buyer@test.local"),
    )

    assert response.status_code == 403
    assert "supplier delivery managers" in response.json()["detail"]


def test_courier_must_belong_to_order_companies(client, db_session):
    seed_user(db_session, user_id=2, email="supplier@test.local")
    seed_user(db_session, user_id=50, email="courier@test.local")
    db_session.execute(update(accounts_user).where(accounts_user.c.id == 50).values({"is_courier_enabled": True}))
    seed_company(db_session, company_id=10, name="Buyer", company_type="BUYER")
    seed_company(db_session, company_id=20, name="Supplier", company_type="SUPPLIER")
    seed_company(db_session, company_id=30, name="Other", company_type="SUPPLIER")
    seed_membership(db_session, member_id=2, user_id=2, company_id=20, role="MANAGER")
    seed_membership(db_session, member_id=3, user_id=50, company_id=30, role="MEMBER")
    seed_order(db_session, order_id=101, buyer_company_id=10, supplier_company_id=20, status="CONFIRMED", comment="Door 3")
    db_session.commit()

    response = client.post(
        "/api/deliveries/upsert_for_order/",
        json={"order": 101, "courier": 50, "tracking_link": "", "notes": ""},
        headers=auth_headers(2, "supplier@test.local"),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "courier must belong to buyer or supplier company"
