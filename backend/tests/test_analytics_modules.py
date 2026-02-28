import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://usc:usc123@127.0.0.1:5432/usc_db")

from app.routers.analytics import (
    _assistant_answer,
    _build_alerts_and_actions,
    _compute_hhi_from_shares,
    _hhi_risk_level,
    _ndjson_event,
    _priority_score,
    _stream_text_chunks,
)


def test_compute_hhi_from_shares_basic():
    hhi = _compute_hhi_from_shares([50, 30, 20])
    assert abs(hhi - 0.38) < 1e-6


def test_hhi_risk_level_thresholds():
    assert _hhi_risk_level(0.10) == "low"
    assert _hhi_risk_level(0.18) == "medium"
    assert _hhi_risk_level(0.25) == "medium"
    assert _hhi_risk_level(0.251) == "high"


def test_priority_score_formula():
    score = _priority_score(impact_score=80, urgency_score=60, confidence=0.8)
    assert abs(score - 74.0) < 1e-6


def test_assistant_answer_uses_analytics_modules_actions():
    summary = {
        "role": "buyer",
        "market": {"company_share_pct": 5.2},
        "sales_trends": [
            {"month": "2026-01", "revenue": 120000},
            {"month": "2026-02", "revenue": 98000},
        ],
        "market_trends": [
            {"month": "2026-01", "revenue": 400000},
            {"month": "2026-02", "revenue": 380000},
        ],
        "category_breakdown": [{"name": "Meat", "share_pct": 58.0, "revenue": 70000}],
        "status_funnel": [
            {"status": "DELIVERED", "count": 40},
            {"status": "CANCELLED", "count": 5},
        ],
        "analytics_modules": {
            "alerts": [
                {
                    "id": "mom_drop",
                    "severity": "critical",
                    "title": "Резкая просадка",
                    "message": "Падение к прошлому месяцу: 18.3%.",
                    "metric_key": "mom_pct",
                    "metric_value": -18.3,
                    "action_hint": "Ускорить восстановление объема",
                }
            ],
            "actions": [
                {
                    "id": "buyer_switch_cheaper",
                    "priority": 82.5,
                    "title": "Переключить закупку Beef",
                    "rationale": "Перевести объем на более выгодного поставщика.",
                    "expected_impact_pct": 12.0,
                    "confidence": 0.82,
                    "owner": "buyer",
                }
            ],
        },
    }

    out = _assistant_answer(summary, "что делать", "2026-02")
    assert isinstance(out.get("actions"), list)
    assert any("Переключить закупку Beef" in str(x) for x in out["actions"])


def test_build_alerts_and_actions_sorted_and_non_empty():
    alerts, actions = _build_alerts_and_actions(
        role="supplier",
        total_revenue=300000,
        sales_trends=[
            {"month": "2026-01", "revenue": 180000},
            {"month": "2026-02", "revenue": 120000},
        ],
        category_breakdown=[{"name": "Meat", "share_pct": 62.0}],
        status_funnel=[
            {"status": "DELIVERED", "count": 32},
            {"status": "CANCELLED", "count": 7},
            {"status": "PENDING", "count": 6},
        ],
        buyer_modules=None,
        supplier_modules={
            "price_competitiveness": {
                "sku_compared": 8,
                "overpriced_share_pct": 42.0,
                "underpriced_share_pct": 8.0,
                "median_gap_pct": 9.2,
                "top_overpriced_skus": [{"product_id": 1, "name": "Milk", "gap_pct": 14.0}],
            },
            "buyer_retention": {
                "new_buyers": 2,
                "returning_buyers": 6,
                "at_risk_buyers": 3,
                "repeat_rate_pct": 75.0,
            },
            "revenue_leakage": {
                "cancelled_orders": 7,
                "cancelled_value_estimate": 42000.0,
                "pipeline_orders": 6,
                "pipeline_value_estimate": 36000.0,
                "leakage_score": 38.0,
            },
        },
    )
    assert alerts
    assert actions
    priorities = [float(x["priority"]) for x in actions]
    assert priorities == sorted(priorities, reverse=True)


def test_stream_helpers():
    chunks = _stream_text_chunks("Привет, мир", chunk_size=4)
    assert chunks
    assert "".join(chunks) == "Привет, мир"
    line = _ndjson_event({"type": "delta", "text": "ok"})
    assert line.endswith("\n")
