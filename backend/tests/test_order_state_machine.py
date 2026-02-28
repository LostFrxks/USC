from app.domain.order_state import (
    ORDER_STATUS_CONFIRMED,
    ORDER_STATUS_DELIVERED,
    ORDER_STATUS_DELIVERING,
    ORDER_STATUS_PARTIALLY_DELIVERED,
    ORDER_STATUS_PENDING,
    can_transition_delivery,
    can_transition_order,
)


def test_order_transitions_happy_path() -> None:
    assert can_transition_order(ORDER_STATUS_PENDING, ORDER_STATUS_CONFIRMED)
    assert can_transition_order(ORDER_STATUS_CONFIRMED, ORDER_STATUS_DELIVERING)
    assert can_transition_order(ORDER_STATUS_DELIVERING, ORDER_STATUS_PARTIALLY_DELIVERED)
    assert can_transition_order(ORDER_STATUS_PARTIALLY_DELIVERED, ORDER_STATUS_DELIVERED)


def test_order_transition_rejects_invalid() -> None:
    assert not can_transition_order(ORDER_STATUS_PENDING, ORDER_STATUS_DELIVERED)


def test_delivery_transition_rejects_invalid() -> None:
    assert not can_transition_delivery("ASSIGNED", "DELIVERED")

