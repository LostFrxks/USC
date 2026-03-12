from __future__ import annotations

import pytest

from app.services.notifications import (
    create_notification_event,
    list_notifications_for_user,
    mark_all_notifications_read,
    mark_notification_read,
)
from tests.test_helpers import seed_user


def test_create_and_list_notifications(db_session):
    if db_session.bind is not None and db_session.bind.dialect.name == "sqlite":
        pytest.skip("create_notification_event requires PostgreSQL sequence behavior")
    seed_user(db_session, user_id=1, email="u1@test.local")
    seed_user(db_session, user_id=2, email="u2@test.local")
    db_session.commit()

    event_id = create_notification_event(
        db_session,
        domain="order",
        event_type="order_created",
        resource_type="order",
        resource_id="101",
        title="Order created",
        text="Status: PENDING",
        user_ids=[1, 2, 2],
        payload={"order_id": 101},
    )
    db_session.commit()

    assert event_id is not None
    u1 = list_notifications_for_user(db_session, user_id=1, limit=10)
    assert u1.unread_count == 1
    assert len(u1.items) == 1
    assert u1.items[0]["is_read"] is False
    assert u1.items[0]["payload"]["order_id"] == 101


def test_mark_read_and_mark_all(db_session):
    if db_session.bind is not None and db_session.bind.dialect.name == "sqlite":
        pytest.skip("create_notification_event requires PostgreSQL sequence behavior")
    seed_user(db_session, user_id=1, email="u1@test.local")
    seed_user(db_session, user_id=2, email="u2@test.local")
    db_session.commit()

    n1 = create_notification_event(
        db_session,
        domain="order",
        event_type="order_created",
        resource_type="order",
        resource_id="1",
        title="n1",
        text="n1",
        user_ids=[1, 2],
    )
    n2 = create_notification_event(
        db_session,
        domain="order",
        event_type="order_confirmed",
        resource_type="order",
        resource_id="2",
        title="n2",
        text="n2",
        user_ids=[2],
    )
    db_session.commit()

    assert mark_notification_read(db_session, user_id=2, notification_id=int(n1)) is True
    assert mark_notification_read(db_session, user_id=2, notification_id=int(n1)) is False
    db_session.commit()

    u2_after_one = list_notifications_for_user(db_session, user_id=2, limit=10)
    assert u2_after_one.unread_count == 1

    updated = mark_all_notifications_read(db_session, user_id=2)
    db_session.commit()
    assert updated == 1

    u2_final = list_notifications_for_user(db_session, user_id=2, limit=10)
    assert u2_final.unread_count == 0
    assert any(item["id"] == int(n2) for item in u2_final.items)
