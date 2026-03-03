import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://usc:usc123@127.0.0.1:5432/usc_db")

from app.routers.analytics import _assistant_answer, _sanitize_assistant_line


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


def test_assistant_answer_why_question_returns_causes_only():
    summary = {
        "market": {"company_share_pct": 4.2},
        "sales_trends": [
            {"month": "2026-01", "revenue": 100000},
            {"month": "2026-02", "revenue": 80000},
        ],
        "category_breakdown": [{"name": "Meat", "share_pct": 61.3, "revenue": 70000}],
        "status_funnel": [
            {"status": "DELIVERED", "count": 50},
            {"status": "CANCELLED", "count": 3},
        ],
    }
    out = _assistant_answer(summary, "почему просела выручка?", "2026-02")
    assert out.get("probable_causes")
    assert out.get("actions") == []


def test_assistant_answer_actions_question_returns_actions_only():
    summary = {
        "market": {"company_share_pct": 4.2},
        "sales_trends": [
            {"month": "2026-01", "revenue": 100000},
            {"month": "2026-02", "revenue": 80000},
        ],
        "category_breakdown": [{"name": "Meat", "share_pct": 61.3, "revenue": 70000}],
        "status_funnel": [
            {"status": "DELIVERED", "count": 50},
            {"status": "CANCELLED", "count": 3},
        ],
    }
    out = _assistant_answer(summary, "что делать с просадкой?", "2026-02")
    assert out.get("actions")
    assert out.get("probable_causes") == []


def test_sanitize_assistant_line_strips_technical_prefix():
    raw = "1. analytics_modules.actions.buyer_switch_cheaper: Переключите закупку на альтернативу."
    cleaned = _sanitize_assistant_line(raw)
    assert cleaned == "Переключите закупку на альтернативу."


def test_sanitize_assistant_line_strips_inline_module_token_and_quotes():
    raw = 'Используйте analytics_modules.actions.supplier_reprice_top_sku для категории "Meat".'
    cleaned = _sanitize_assistant_line(raw)
    assert "analytics_modules" not in cleaned.lower()
    assert '"Meat"' not in cleaned
    assert "Meat" in cleaned


def test_assistant_answer_does_not_quote_top_category_name():
    summary = {
        "market": {"company_share_pct": 4.2},
        "sales_trends": [
            {"month": "2026-01", "revenue": 100000},
            {"month": "2026-02", "revenue": 80000},
        ],
        "category_breakdown": [{"name": "Meat", "share_pct": 84.05, "revenue": 70000}],
        "status_funnel": [
            {"status": "DELIVERED", "count": 50},
            {"status": "CANCELLED", "count": 3},
        ],
    }
    out = _assistant_answer(summary, "почему просадка", "2026-02")
    joined = " ".join(str(x) for x in (out.get("probable_causes") or []))
    assert '"Meat"' not in joined
    assert "«Meat»" not in joined
