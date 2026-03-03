from __future__ import annotations

from tests.test_helpers import auth_headers, seed_company, seed_membership, seed_user


def _seed_actor(db_session) -> None:
    seed_user(db_session, user_id=1, email="buyer@test.local")
    seed_company(db_session, company_id=10, name="Buyer Co", company_type="BUYER")
    seed_membership(db_session, member_id=100, user_id=1, company_id=10, role="OWNER")
    db_session.commit()


def _summary_fixture() -> dict:
    return {
        "company_id": 10,
        "role": "buyer",
        "days": 365,
        "total_orders": 92,
        "total_revenue": 1_325_000,
        "sales_trends": [
            {"month": "2026-01", "revenue": 580000},
            {"month": "2026-02", "revenue": 640000},
            {"month": "2026-03", "revenue": 520000},
        ],
        "market_trends": [
            {"month": "2026-01", "revenue": 2500000},
            {"month": "2026-02", "revenue": 2600000},
            {"month": "2026-03", "revenue": 2400000},
        ],
        "top_products": [
            {"product_id": 1, "name": "Beef Premium", "revenue": 210000, "qty_total": 580},
            {"product_id": 2, "name": "Chicken Fillet", "revenue": 160000, "qty_total": 700},
            {"product_id": 3, "name": "Milk 3.2%", "revenue": 120000, "qty_total": 880},
        ],
        "status_funnel": [
            {"status": "PENDING", "count": 15},
            {"status": "CONFIRMED", "count": 18},
            {"status": "DELIVERING", "count": 14},
            {"status": "DELIVERED", "count": 120},
            {"status": "CANCELLED", "count": 8},
        ],
        "category_breakdown": [
            {"name": "Meat", "share_pct": 68.0, "revenue": 900000},
            {"name": "Dairy", "share_pct": 20.0, "revenue": 250000},
            {"name": "Bakery", "share_pct": 12.0, "revenue": 175000},
        ],
        "market": {"company_share_pct": 5.2},
        "analytics_modules": {
            "alerts": [],
            "actions": [],
            "buyer": {
                "savings_watchlist": [
                    {
                        "anchor_product_id": 1,
                        "anchor_product_name": "Beef Premium",
                        "current_supplier_name": "Old Supplier",
                        "current_price": 690,
                        "alt_supplier_name": "NorthPeak Foods",
                        "alt_product_name": "Beef Premium Alt",
                        "alt_price": 510,
                        "savings_abs": 180,
                        "savings_pct": 26.1,
                    }
                ],
                "supplier_reliability": [],
                "concentration": {"supplier_hhi": 0.31, "category_hhi": 0.51, "risk_level": "high"},
            },
        },
        "buyer_recommendations": {
            "cheaper_alternatives": [],
            "reliable_suppliers": [],
            "generated_at": "2026-03-03T12:00:00Z",
        },
    }


def test_what_if_simulation_api_returns_structured_payload(client, db_session, monkeypatch):
    _seed_actor(db_session)
    from app.routers import analytics as analytics_router

    monkeypatch.setattr(analytics_router, "analytics_summary", lambda **kwargs: _summary_fixture())

    res = client.post(
        "/api/analytics/what-if",
        json={
            "company_id": 10,
            "role": "buyer",
            "days": 365,
            "horizon_days": 60,
            "selected_month": "2026-03",
            "drilldown_by": "category",
            "levers": {
                "delivery_improve_pp": 8,
                "cancel_reduce_pp": 4,
                "promo_intensity_pct": 12,
                "top_category_share_reduce_pp": 10,
                "cheaper_supplier_shift_pct": 35,
                "reliable_supplier_shift_pct": 25,
                "price_cut_overpriced_pct": 9,  # should be zeroed for buyer
            },
        },
        headers=auth_headers(1, "buyer@test.local"),
    )
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body.get("baseline"), dict)
    assert isinstance(body.get("scenario"), dict)
    assert isinstance(body.get("delta"), dict)
    assert isinstance(body.get("compare_series"), list)
    assert len(body.get("compare_series") or []) == 2
    assert (body.get("drilldown") or {}).get("by") == "category"
    assert isinstance(body.get("drivers"), list) and body["drivers"]
    assert body.get("levers", {}).get("price_cut_overpriced_pct") == 0.0
    assert body.get("scenario", {}).get("revenue_forecast_som", 0) >= body.get("baseline", {}).get(
        "revenue_forecast_som", 0
    )


def test_what_if_scenarios_crud(client, db_session):
    _seed_actor(db_session)
    headers = auth_headers(1, "buyer@test.local")

    created = client.post(
        "/api/analytics/what-if/scenarios",
        json={
            "company_id": 10,
            "role": "buyer",
            "title": "Антикризис 30 дней",
            "horizon_days": 30,
            "selected_month": "2026-03",
            "levers": {
                "delivery_improve_pp": 5,
                "cancel_reduce_pp": 3,
                "promo_intensity_pct": 8,
                "cheaper_supplier_shift_pct": 20,
            },
        },
        headers=headers,
    )
    assert created.status_code == 200
    item = created.json()
    scenario_id = int(item["id"])
    assert item["title"] == "Антикризис 30 дней"
    assert item["horizon_days"] == 30
    assert isinstance(item["levers"], dict)

    listed = client.get(
        "/api/analytics/what-if/scenarios",
        params={"company_id": 10, "role": "buyer", "limit": 20},
        headers=headers,
    )
    assert listed.status_code == 200
    items = listed.json().get("items") or []
    assert any(int(x.get("id")) == scenario_id for x in items)

    renamed = client.patch(
        f"/api/analytics/what-if/scenarios/{scenario_id}",
        json={"title": "Рост с контролем риска"},
        headers=headers,
    )
    assert renamed.status_code == 200
    assert renamed.json().get("updated") is True

    deleted = client.delete(f"/api/analytics/what-if/scenarios/{scenario_id}", headers=headers)
    assert deleted.status_code == 200
    assert deleted.json().get("deleted") is True
