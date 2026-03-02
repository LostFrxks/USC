from __future__ import annotations

from backend.tests.test_helpers import (
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
