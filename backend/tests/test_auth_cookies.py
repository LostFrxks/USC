from __future__ import annotations

from tests.test_helpers import seed_user


def test_login_sets_refresh_cookie(client, db_session):
    seed_user(db_session, user_id=1, email="user@test.local", password="pass123456")
    db_session.commit()

    response = client.post(
        "/api/auth/login/",
        json={"email": "user@test.local", "password": "pass123456"},
    )

    assert response.status_code == 200
    assert response.json()["access"]
    assert response.cookies.get("usc_refresh_token")


def test_refresh_uses_cookie_when_body_missing(client, db_session):
    seed_user(db_session, user_id=1, email="user@test.local", password="pass123456")
    db_session.commit()

    login = client.post(
        "/api/auth/login/",
        json={"email": "user@test.local", "password": "pass123456"},
    )
    assert login.status_code == 200

    refreshed = client.post("/api/auth/token/refresh/", json={})

    assert refreshed.status_code == 200
    assert refreshed.json()["access"]
    assert refreshed.cookies.get("usc_refresh_token")


def test_logout_clears_refresh_cookie(client, db_session):
    seed_user(db_session, user_id=1, email="user@test.local", password="pass123456")
    db_session.commit()

    login = client.post(
        "/api/auth/login/",
        json={"email": "user@test.local", "password": "pass123456"},
    )
    assert login.status_code == 200
    assert client.cookies.get("usc_refresh_token")

    logout = client.post("/api/auth/logout/", json={})

    assert logout.status_code == 200
    assert logout.json()["revoked"] is True
    assert not client.cookies.get("usc_refresh_token")
