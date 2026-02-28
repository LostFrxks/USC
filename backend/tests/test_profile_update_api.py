from __future__ import annotations

from sqlalchemy import select

from app.db.schema import accounts_user, companies_company
from backend.tests.test_helpers import auth_headers, seed_company, seed_membership, seed_user


def test_profile_patch_success_updates_user_and_company(client, db_session):
    seed_user(db_session, user_id=10, email="owner@test.local", phone="+996700111111")
    seed_company(db_session, company_id=100, name="Old Co", company_type="BUYER")
    seed_membership(db_session, member_id=1, user_id=10, company_id=100)
    db_session.commit()

    response = client.patch(
        "/api/profile/me/",
        json={
            "first_name": "Alice",
            "last_name": "Owner",
            "phone": "+996 700 222 333",
            "email": "owner_new@test.local",
            "active_company_id": 100,
            "company_name": "New Co",
            "company_phone": "+996 777 123 123",
            "company_address": "Bishkek",
        },
        headers=auth_headers(10, "owner@test.local"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["email"] == "owner_new@test.local"
    assert payload["first_name"] == "Alice"
    assert payload["companies"][0]["name"] == "New Co"

    user_row = db_session.execute(select(accounts_user).where(accounts_user.c.id == 10)).mappings().one()
    company_row = db_session.execute(select(companies_company).where(companies_company.c.id == 100)).mappings().one()
    assert user_row["email"] == "owner_new@test.local"
    assert company_row["name"] == "New Co"


def test_profile_patch_email_conflict_returns_409(client, db_session):
    seed_user(db_session, user_id=10, email="owner@test.local")
    seed_user(db_session, user_id=11, email="taken@test.local")
    db_session.commit()

    response = client.patch(
        "/api/profile/me/",
        json={"email": "taken@test.local"},
        headers=auth_headers(10, "owner@test.local"),
    )

    assert response.status_code == 409


def test_profile_patch_company_without_membership_returns_403(client, db_session):
    seed_user(db_session, user_id=10, email="owner@test.local")
    seed_company(db_session, company_id=100, name="Allowed", company_type="BUYER")
    seed_company(db_session, company_id=200, name="Forbidden", company_type="BUYER")
    seed_membership(db_session, member_id=1, user_id=10, company_id=100)
    db_session.commit()

    response = client.patch(
        "/api/profile/me/",
        json={
            "active_company_id": 200,
            "company_name": "Should Fail",
        },
        headers=auth_headers(10, "owner@test.local"),
    )

    assert response.status_code == 403
