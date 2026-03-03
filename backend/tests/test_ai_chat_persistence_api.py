from __future__ import annotations

from tests.test_helpers import auth_headers, seed_company, seed_membership, seed_user


def _seed_actor(db_session) -> None:
    seed_user(db_session, user_id=1, email="buyer@test.local")
    seed_company(db_session, company_id=10, name="Buyer Co", company_type="BUYER")
    seed_membership(db_session, member_id=100, user_id=1, company_id=10, role="OWNER")
    db_session.commit()


def test_assistant_query_persists_chat_messages(client, db_session, monkeypatch):
    _seed_actor(db_session)
    from app.routers import analytics as analytics_router

    monkeypatch.setattr(
        analytics_router,
        "analytics_summary",
        lambda **kwargs: {
            "company_id": 10,
            "role": "buyer",
            "days": 365,
            "sales_trends": [{"month": "2026-02", "revenue": 100000}, {"month": "2026-03", "revenue": 80000}],
            "market_trends": [{"month": "2026-02", "revenue": 500000}, {"month": "2026-03", "revenue": 450000}],
            "status_funnel": [{"status": "DELIVERED", "count": 10}, {"status": "CANCELLED", "count": 1}],
            "category_breakdown": [{"name": "Meat", "share_pct": 60.0, "revenue": 48000}],
            "market": {"company_share_pct": 4.5},
            "analytics_modules": {"alerts": [], "actions": []},
            "buyer_recommendations": {},
        },
    )

    res = client.post(
        "/api/analytics/assistant/query",
        json={
            "company_id": 10,
            "role": "buyer",
            "days": 365,
            "question": "что делать с просадкой выручки?",
        },
        headers=auth_headers(1, "buyer@test.local"),
    )
    assert res.status_code == 200
    body = res.json()
    session_id = body.get("chat_session_id")
    assert isinstance(session_id, int)
    assert session_id > 0

    listed = client.get(
        "/api/analytics/assistant/chats",
        params={"company_id": 10, "role": "buyer", "limit": 20, "message_limit": 50},
        headers=auth_headers(1, "buyer@test.local"),
    )
    assert listed.status_code == 200
    payload = listed.json()
    sessions = payload.get("sessions") or []
    assert sessions
    target = next((s for s in sessions if int(s.get("id")) == int(session_id)), None)
    assert target is not None
    msgs = target.get("messages") or []
    assert len(msgs) >= 2
    assert msgs[-2]["role"] == "user"
    assert msgs[-1]["role"] == "assistant"


def test_chat_session_crud_endpoints(client, db_session):
    _seed_actor(db_session)
    headers = auth_headers(1, "buyer@test.local")

    created = client.post(
        "/api/analytics/assistant/chats",
        json={"company_id": 10, "role": "buyer", "title": "Мой чат"},
        headers=headers,
    )
    assert created.status_code == 200
    session_id = int(created.json()["id"])

    renamed = client.patch(
        f"/api/analytics/assistant/chats/{session_id}",
        json={"title": "Новый заголовок"},
        headers=headers,
    )
    assert renamed.status_code == 200
    assert renamed.json().get("title") == "Новый заголовок"

    deleted = client.delete(f"/api/analytics/assistant/chats/{session_id}", headers=headers)
    assert deleted.status_code == 200
    assert deleted.json().get("deleted") is True
