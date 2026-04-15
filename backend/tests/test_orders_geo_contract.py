from decimal import Decimal

from app.routers.orders import _append_geo_tag
from tests.test_helpers import (
    auth_headers,
    seed_company,
    seed_membership,
    seed_order,
    seed_user,
)


def test_append_geo_tag_keeps_plain_comment_and_adds_backend_geo_tag():
    comment = _append_geo_tag("Door 3", 42.8746, 74.5698)
    assert comment == "Door 3\n[geo:42.874600,74.569800]"


def test_order_detail_returns_explicit_delivery_coordinates(client, db_session):
    seed_user(db_session, user_id=1, email="buyer@test.local")
    seed_company(db_session, company_id=10, name="Buyer", company_type="BUYER")
    seed_company(db_session, company_id=20, name="Supplier", company_type="SUPPLIER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10, role="OWNER")
    seed_order(
        db_session,
        order_id=101,
        buyer_company_id=10,
        supplier_company_id=20,
        status="PENDING",
        delivery_address="Mederova 161a",
        delivery_lat=Decimal("42.874600"),
        delivery_lng=Decimal("74.569800"),
        comment="Door 3\n[geo:42.874600,74.569800]",
    )
    db_session.commit()

    detail = client.get("/api/orders/101/?buyer_company_id=10", headers=auth_headers(1, "buyer@test.local"))
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["delivery_lat"] == 42.8746
    assert payload["delivery_lng"] == 74.5698
    assert payload["comment"].endswith("[geo:42.874600,74.569800]")


def test_order_detail_and_list_fallback_to_geo_tag_when_columns_are_empty(client, db_session):
    seed_user(db_session, user_id=1, email="buyer@test.local")
    seed_company(db_session, company_id=10, name="Buyer", company_type="BUYER")
    seed_company(db_session, company_id=20, name="Supplier", company_type="SUPPLIER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10, role="OWNER")
    seed_order(
        db_session,
        order_id=101,
        buyer_company_id=10,
        supplier_company_id=20,
        status="PENDING",
        delivery_address="Door 3",
        comment="Courier call first\n[geo:42.874600,74.569800]",
    )
    db_session.commit()

    detail = client.get("/api/orders/101/?buyer_company_id=10", headers=auth_headers(1, "buyer@test.local"))
    listing = client.get("/api/orders/?buyer_company_id=10", headers=auth_headers(1, "buyer@test.local"))

    assert detail.status_code == 200
    assert detail.json()["delivery_lat"] == 42.8746
    assert detail.json()["delivery_lng"] == 74.5698

    assert listing.status_code == 200
    assert listing.json()[0]["delivery_lat"] == 42.8746
    assert listing.json()[0]["delivery_lng"] == 74.5698
