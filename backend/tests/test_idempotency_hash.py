from app.services.idempotency import canonical_body_hash


def test_canonical_body_hash_is_order_independent() -> None:
    payload_a = {"buyer_company_id": 1, "items": [{"product_id": 10, "qty": 2}], "comment": "x"}
    payload_b = {"comment": "x", "items": [{"qty": 2, "product_id": 10}], "buyer_company_id": 1}

    assert canonical_body_hash(payload_a) == canonical_body_hash(payload_b)

