from __future__ import annotations

from tests.test_helpers import auth_headers, seed_company, seed_membership, seed_user


def test_non_admin_member_cannot_update_company(client, db_session):
    seed_user(db_session, user_id=1, email="member@test.local")
    seed_company(db_session, company_id=10, name="Acme", company_type="BUYER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10, role="MEMBER")
    db_session.commit()

    response = client.patch(
        "/api/companies/10/",
        json={"name": "Renamed"},
        headers=auth_headers(1, "member@test.local"),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Only company admins can update company settings"


def test_admin_can_update_company(client, db_session):
    seed_user(db_session, user_id=1, email="admin@test.local")
    seed_company(db_session, company_id=10, name="Acme", company_type="BUYER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10, role="ADMIN")
    db_session.commit()

    response = client.patch(
        "/api/companies/10/",
        json={"name": "Renamed"},
        headers=auth_headers(1, "admin@test.local"),
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"


def test_only_owner_can_delete_company(client, db_session):
    seed_user(db_session, user_id=1, email="admin@test.local")
    seed_company(db_session, company_id=10, name="Acme", company_type="BUYER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10, role="ADMIN")
    db_session.commit()

    response = client.delete("/api/companies/10/", headers=auth_headers(1, "admin@test.local"))

    assert response.status_code == 403
    assert response.json()["detail"] == "Only company owners can delete company"


def test_company_type_cannot_be_changed_from_update_endpoint(client, db_session):
    seed_user(db_session, user_id=1, email="admin@test.local")
    seed_company(db_session, company_id=10, name="Acme", company_type="BUYER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10, role="ADMIN")
    db_session.commit()

    response = client.patch(
        "/api/companies/10/",
        json={"company_type": "SUPPLIER"},
        headers=auth_headers(1, "admin@test.local"),
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "company_type is immutable and cannot be changed via this endpoint"
