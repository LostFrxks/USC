import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://usc:usc123@127.0.0.1:5432/usc_db")

from app.routers.analytics import _assistant_answer


def test_assistant_answer_shape():
    summary = {
        "market": {"company_share_pct": 4.2},
        "sales_trends": [
            {"month": "2026-01", "revenue": 100000},
            {"month": "2026-02", "revenue": 110000},
        ],
        "market_trends": [
            {"month": "2026-01", "revenue": 400000},
            {"month": "2026-02", "revenue": 430000},
        ],
        "category_breakdown": [{"name": "Meat", "share_pct": 61.3, "revenue": 70000}],
        "status_funnel": [
            {"status": "DELIVERED", "count": 50},
            {"status": "CANCELLED", "count": 3},
        ],
    }
    out = _assistant_answer(summary, "что делать", "2026-02")
    assert isinstance(out, dict)
    assert isinstance(out.get("summary"), str)
    assert isinstance(out.get("probable_causes"), list)
    assert isinstance(out.get("actions"), list)
    assert "metrics" in out
    assert "delivery_rate_pct" in out["metrics"]
