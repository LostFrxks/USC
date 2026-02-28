from __future__ import annotations

from app.services.notifications import create_notification_event
from backend.tests.test_helpers import auth_headers, seed_company, seed_membership, seed_user


def test_profile_patch_returns_updated_profile(client, db_session):
    seed_user(db_session, user_id=1, email="owner@test.local")
    seed_company(db_session, company_id=10, name="Old Name", company_type="BUYER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=10)
    db_session.commit()

    response = client.patch(
        "/api/profile/me/",
        json={
            "first_name": "John",
            "last_name": "Doe",
            "email": "owner-updated@test.local",
            "active_company_id": 10,
            "company_name": "New Name LLC",
        },
        headers=auth_headers(1, "owner@test.local"),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["first_name"] == "John"
    assert payload["email"] == "owner-updated@test.local"
    assert payload["companies"][0]["name"] == "New Name LLC"


def test_notifications_read_lifecycle(client, db_session):
    seed_user(db_session, user_id=1, email="user@test.local")
    db_session.commit()

    n1 = create_notification_event(
        db_session,
        domain="system",
        event_type="one",
        resource_type="misc",
        resource_id="1",
        title="N1",
        text="One",
        user_ids=[1],
    )
    n2 = create_notification_event(
        db_session,
        domain="system",
        event_type="two",
        resource_type="misc",
        resource_id="2",
        title="N2",
        text="Two",
        user_ids=[1],
    )
    db_session.commit()

    listed = client.get("/api/notifications/?limit=20", headers=auth_headers(1, "user@test.local"))
    assert listed.status_code == 200
    assert listed.json()["unread_count"] == 2

    read_one = client.post(f"/api/notifications/{int(n1)}/read/", headers=auth_headers(1, "user@test.local"))
    assert read_one.status_code == 200
    assert read_one.json()["updated"] is True

    listed_after_one = client.get("/api/notifications/?limit=20", headers=auth_headers(1, "user@test.local"))
    assert listed_after_one.status_code == 200
    assert listed_after_one.json()["unread_count"] == 1

    read_all = client.post("/api/notifications/read_all/", headers=auth_headers(1, "user@test.local"))
    assert read_all.status_code == 200
    assert read_all.json()["updated_count"] == 1

    listed_after_all = client.get("/api/notifications/?limit=20", headers=auth_headers(1, "user@test.local"))
    assert listed_after_all.status_code == 200
    assert listed_after_all.json()["unread_count"] == 0
    assert {item["id"] for item in listed_after_all.json()["items"]} == {int(n1), int(n2)}
