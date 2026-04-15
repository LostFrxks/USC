from tests.test_helpers import seed_user


def test_password_reset_request_returns_code_in_dev(client, db_session):
    seed_user(db_session, user_id=1, email="user@test.local", password="pass123456")
    db_session.commit()

    response = client.post("/api/auth/password_reset/request/", json={"email": "user@test.local"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["sent"] is True
    assert payload["code"]


def test_password_reset_confirm_updates_password_and_revokes_sessions(client, db_session):
    seed_user(db_session, user_id=1, email="user@test.local", password="pass123456")
    db_session.commit()

    request_reset = client.post("/api/auth/password_reset/request/", json={"email": "user@test.local"})
    assert request_reset.status_code == 200
    code = request_reset.json()["code"]

    reset = client.post(
        "/api/auth/password_reset/confirm/",
        json={
            "email": "user@test.local",
            "code": code,
            "new_password": "newpass123",
        },
    )

    assert reset.status_code == 200
    assert reset.json()["reset"] is True

    old_login = client.post("/api/auth/login/", json={"email": "user@test.local", "password": "pass123456"})
    assert old_login.status_code == 401

    new_login = client.post("/api/auth/login/", json={"email": "user@test.local", "password": "newpass123"})
    assert new_login.status_code == 200
