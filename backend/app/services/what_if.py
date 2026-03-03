from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, delete, func, insert, select, update
from sqlalchemy.orm import Session

from app.cache.redis_cache import invalidate_patterns
from app.db.schema import ai_what_if_scenario

ROLE_BUYER = "buyer"
ROLE_SUPPLIER = "supplier"
ALLOWED_HORIZONS = {30, 60, 90}

DEFAULT_LEVERS: dict[str, float] = {
    "delivery_improve_pp": 0.0,
    "cancel_reduce_pp": 0.0,
    "top_category_share_reduce_pp": 0.0,
    "promo_intensity_pct": 0.0,
    "cheaper_supplier_shift_pct": 0.0,
    "reliable_supplier_shift_pct": 0.0,
    "price_cut_overpriced_pct": 0.0,
    "pipeline_recovery_pct": 0.0,
}

LEVER_LIMITS: dict[str, tuple[float, float]] = {
    "delivery_improve_pp": (0.0, 20.0),
    "cancel_reduce_pp": (0.0, 15.0),
    "top_category_share_reduce_pp": (0.0, 25.0),
    "promo_intensity_pct": (0.0, 20.0),
    "cheaper_supplier_shift_pct": (0.0, 100.0),
    "reliable_supplier_shift_pct": (0.0, 100.0),
    "price_cut_overpriced_pct": (0.0, 20.0),
    "pipeline_recovery_pct": (0.0, 60.0),
}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _next_id(db: Session, table) -> int:
    return int(db.execute(select(func.coalesce(func.max(table.c.id), 0) + 1)).scalar_one())


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return min(max_value, max(min_value, float(value)))


def normalize_role(role: str | None) -> str:
    role_norm = (role or "").strip().lower()
    if role_norm not in {ROLE_BUYER, ROLE_SUPPLIER}:
        return ROLE_BUYER
    return role_norm


def normalize_horizon_days(horizon_days: int | None) -> int:
    try:
        candidate = int(horizon_days or 30)
    except Exception:
        candidate = 30
    if candidate not in ALLOWED_HORIZONS:
        return 30
    return candidate


def normalize_levers(role: str, incoming: dict[str, Any] | None) -> dict[str, float]:
    role_norm = normalize_role(role)
    out = dict(DEFAULT_LEVERS)
    payload = incoming or {}
    for key, base in DEFAULT_LEVERS.items():
        raw = payload.get(key, base)
        try:
            value = float(raw)
        except Exception:
            value = float(base)
        min_v, max_v = LEVER_LIMITS[key]
        out[key] = round(_clamp(value, min_v, max_v), 2)

    if role_norm == ROLE_BUYER:
        out["price_cut_overpriced_pct"] = 0.0
        out["pipeline_recovery_pct"] = 0.0
    else:
        out["cheaper_supplier_shift_pct"] = 0.0
        out["reliable_supplier_shift_pct"] = 0.0
    return out


def _pct_delta(prev: float, cur: float) -> float | None:
    if prev <= 0:
        return None
    return ((cur - prev) / prev) * 100.0


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _average(values: list[float]) -> float:
    clean = [float(v) for v in values if v is not None]
    if not clean:
        return 0.0
    return sum(clean) / len(clean)


def _compute_hhi_from_shares(shares: list[float]) -> float:
    clean = [max(0.0, float(s)) for s in shares if s is not None]
    total = sum(clean)
    if total <= 0:
        return 0.0
    norm = [s / total for s in clean]
    return round(sum(s * s for s in norm), 4)


def _baseline_from_summary(summary: dict[str, Any], *, horizon_days: int) -> dict[str, Any]:
    sales_trends = summary.get("sales_trends") or []
    monthly_values = [_safe_float(x.get("revenue")) for x in sales_trends if isinstance(x, dict)]
    latest_monthly = monthly_values[-1] if monthly_values else 0.0
    prev_monthly = monthly_values[-2] if len(monthly_values) >= 2 else 0.0
    mom_pct = _pct_delta(prev_monthly, latest_monthly)

    periods = max(1, int(round(horizon_days / 30)))
    revenue_forecast_som = max(0.0, latest_monthly * periods)

    funnel = summary.get("status_funnel") or []
    delivered = sum(
        int(x.get("count") or 0) for x in funnel if str(x.get("status") or "").upper() == "DELIVERED"
    )
    cancelled = sum(
        int(x.get("count") or 0)
        for x in funnel
        if str(x.get("status") or "").upper() in {"CANCELLED", "CANCELED"}
    )
    total_funnel = max(1, sum(int(x.get("count") or 0) for x in funnel))
    delivery_rate_pct = (delivered / total_funnel) * 100.0
    cancel_rate_pct = (cancelled / total_funnel) * 100.0

    market_share_pct = _safe_float((summary.get("market") or {}).get("company_share_pct"), 0.0)
    cat_breakdown = summary.get("category_breakdown") or []
    top_category_name = str((cat_breakdown[0] or {}).get("name") or "—") if cat_breakdown else "—"
    top_category_share_pct = _safe_float((cat_breakdown[0] or {}).get("share_pct"), 0.0) if cat_breakdown else 0.0

    analytics_modules = summary.get("analytics_modules") or {}
    buyer_mod = analytics_modules.get("buyer") or {}
    supplier_mod = analytics_modules.get("supplier") or {}
    concentration = buyer_mod.get("concentration") or {}
    leakage = supplier_mod.get("revenue_leakage") or {}
    retention = supplier_mod.get("buyer_retention") or {}
    watchlist = buyer_mod.get("savings_watchlist") or []

    avg_watch_savings_pct = _average([_safe_float(x.get("savings_pct"), 0.0) for x in watchlist[:4]])
    leakage_value_som = _safe_float(leakage.get("cancelled_value_estimate"), 0.0) + _safe_float(
        leakage.get("pipeline_value_estimate"), 0.0
    )

    return {
        "horizon_days": int(horizon_days),
        "periods": periods,
        "monthly_base_som": round(latest_monthly, 2),
        "revenue_forecast_som": round(revenue_forecast_som, 2),
        "mom_pct": None if mom_pct is None else round(mom_pct, 2),
        "delivery_rate_pct": round(delivery_rate_pct, 2),
        "cancel_rate_pct": round(cancel_rate_pct, 2),
        "market_share_pct": round(market_share_pct, 2),
        "top_category_name": top_category_name,
        "top_category_share_pct": round(top_category_share_pct, 2),
        "supplier_hhi": round(_safe_float(concentration.get("supplier_hhi"), 0.0), 4),
        "category_hhi": round(_safe_float(concentration.get("category_hhi"), 0.0), 4),
        "savings_potential_som": 0.0,
        "avg_watch_savings_pct": round(avg_watch_savings_pct, 2),
        "leakage_score": round(_safe_float(leakage.get("leakage_score"), 0.0), 2),
        "leakage_value_som": round(leakage_value_som, 2),
        "repeat_rate_pct": round(_safe_float(retention.get("repeat_rate_pct"), 0.0), 2),
    }


def _build_compare_series(
    *,
    base_total: float,
    scenario_total: float,
    periods: int,
    selected_month: str | None = None,
) -> list[dict[str, Any]]:
    if periods <= 0:
        periods = 1
    base_month = base_total / periods if periods else base_total
    scenario_month = scenario_total / periods if periods else scenario_total
    out: list[dict[str, Any]] = []
    for i in range(periods):
        progress = (i + 1) / periods
        smoothed = base_month + (scenario_month - base_month) * progress
        out.append(
            {
                "period": f"M+{i + 1}" if not selected_month else f"{selected_month}+{i + 1}",
                "baseline": round(base_month * (i + 1), 2),
                "scenario": round(smoothed * (i + 1), 2),
            }
        )
    return out


def _build_category_drilldown(
    *,
    summary: dict[str, Any],
    top_category_share_reduce_pp: float,
) -> list[dict[str, Any]]:
    categories = (summary.get("category_breakdown") or [])[:6]
    if not categories:
        return []
    shares = [max(0.0, _safe_float(x.get("share_pct"))) for x in categories]
    names = [str(x.get("name") or "—") for x in categories]
    base_total = sum(shares) or 1.0
    base_norm = [s / base_total for s in shares]
    reduce_share = min(base_norm[0], top_category_share_reduce_pp / 100.0)
    scenario = base_norm[:]
    scenario[0] = max(0.0, scenario[0] - reduce_share)
    if len(scenario) > 1 and reduce_share > 0:
        per = reduce_share / (len(scenario) - 1)
        for i in range(1, len(scenario)):
            scenario[i] += per
    return [
        {
            "key": names[i],
            "baseline": round(base_norm[i] * 100, 2),
            "scenario": round(scenario[i] * 100, 2),
            "delta_pct": round((scenario[i] - base_norm[i]) * 100, 2),
        }
        for i in range(len(names))
    ]


def _build_sku_drilldown(
    *,
    summary: dict[str, Any],
    promo_intensity_pct: float,
    price_cut_overpriced_pct: float,
) -> list[dict[str, Any]]:
    products = (summary.get("top_products") or [])[:6]
    if not products:
        return []
    uplift = (promo_intensity_pct * 0.004) + (price_cut_overpriced_pct * 0.006)
    out: list[dict[str, Any]] = []
    for idx, row in enumerate(products):
        base = _safe_float(row.get("revenue"), 0.0)
        factor = 1.0 + uplift * max(0.5, 1.0 - idx * 0.08)
        scenario = max(0.0, base * factor)
        out.append(
            {
                "key": str(row.get("name") or f"SKU-{idx + 1}"),
                "baseline": round(base, 2),
                "scenario": round(scenario, 2),
                "delta_pct": round(_pct_delta(base, scenario) or 0.0, 2),
            }
        )
    return out


def simulate_what_if(
    *,
    summary: dict[str, Any],
    role: str,
    horizon_days: int,
    levers: dict[str, Any] | None,
    selected_month: str | None = None,
    drilldown_by: str = "category",
) -> dict[str, Any]:
    role_norm = normalize_role(role)
    horizon = normalize_horizon_days(horizon_days)
    normalized = normalize_levers(role_norm, levers)
    baseline = _baseline_from_summary(summary, horizon_days=horizon)

    delivery_gain = normalized["delivery_improve_pp"]
    cancel_gain = normalized["cancel_reduce_pp"]
    category_diversification = normalized["top_category_share_reduce_pp"]
    promo_intensity = normalized["promo_intensity_pct"]
    cheaper_shift = normalized["cheaper_supplier_shift_pct"]
    reliable_shift = normalized["reliable_supplier_shift_pct"]
    price_cut = normalized["price_cut_overpriced_pct"]
    pipeline_recovery = normalized["pipeline_recovery_pct"]

    base_revenue = _safe_float(baseline["revenue_forecast_som"], 0.0)
    execution_uplift = (delivery_gain * 0.004) + (cancel_gain * 0.005)
    diversification_uplift = category_diversification * 0.001
    promo_uplift = promo_intensity * 0.003
    role_uplift = 0.0

    scenario: dict[str, Any] = dict(baseline)
    scenario["delivery_rate_pct"] = round(_clamp(baseline["delivery_rate_pct"] + delivery_gain, 0.0, 100.0), 2)
    scenario["cancel_rate_pct"] = round(_clamp(baseline["cancel_rate_pct"] - cancel_gain, 0.0, 100.0), 2)
    scenario["top_category_share_pct"] = round(
        _clamp(baseline["top_category_share_pct"] - category_diversification, 0.0, 100.0), 2
    )

    drivers: list[tuple[str, float]] = []
    drivers.append(("Улучшение delivery/cancel исполнения", execution_uplift))
    if promo_uplift:
        drivers.append(("Промо-интенсивность", promo_uplift))
    if diversification_uplift:
        drivers.append(("Диверсификация категории", diversification_uplift))

    if role_norm == ROLE_BUYER:
        avg_savings_pct = _safe_float(baseline.get("avg_watch_savings_pct"), 0.0) / 100.0
        savings_potential = base_revenue * (cheaper_shift / 100.0) * avg_savings_pct
        scenario["savings_potential_som"] = round(max(0.0, savings_potential), 2)
        buyer_uplift = (reliable_shift / 100.0) * 0.04 + (cheaper_shift / 100.0) * 0.015
        role_uplift += buyer_uplift
        drivers.append(("Сдвиг объема к надежным/дешевым поставщикам", buyer_uplift))

        supplier_hhi_base = _safe_float(baseline.get("supplier_hhi"), 0.0)
        category_hhi_base = _safe_float(baseline.get("category_hhi"), 0.0)
        scenario["supplier_hhi"] = round(
            _clamp(supplier_hhi_base * (1.0 - (reliable_shift / 100.0) * 0.35 - (cheaper_shift / 100.0) * 0.2), 0.0, 1.0),
            4,
        )
        scenario["category_hhi"] = round(
            _clamp(category_hhi_base * (1.0 - category_diversification * 0.015), 0.0, 1.0),
            4,
        )
    else:
        supplier_uplift = (price_cut * 0.006) + (pipeline_recovery / 100.0) * 0.14
        role_uplift += supplier_uplift
        drivers.append(("Коррекция цены и recovery pipeline", supplier_uplift))
        leakage_base = _safe_float(baseline.get("leakage_value_som"), 0.0)
        leakage_after = leakage_base * (
            1.0 - (pipeline_recovery / 100.0) * 0.55 - (cancel_gain / 100.0) * 0.35
        )
        scenario["leakage_value_som"] = round(max(0.0, leakage_after), 2)
        leakage_score_base = _safe_float(baseline.get("leakage_score"), 0.0)
        scenario["leakage_score"] = round(
            _clamp(leakage_score_base * (1.0 - (pipeline_recovery / 100.0) * 0.5 - (cancel_gain / 100.0) * 0.2), 0.0, 100.0),
            2,
        )
        repeat_base = _safe_float(baseline.get("repeat_rate_pct"), 0.0)
        scenario["repeat_rate_pct"] = round(_clamp(repeat_base + promo_intensity * 0.2 + delivery_gain * 0.15, 0.0, 100.0), 2)

    total_uplift = execution_uplift + diversification_uplift + promo_uplift + role_uplift
    revenue_after = max(0.0, base_revenue * (1.0 + total_uplift))
    scenario["revenue_forecast_som"] = round(revenue_after, 2)
    scenario["mom_pct"] = None if baseline["mom_pct"] is None else round(_safe_float(baseline["mom_pct"]) + total_uplift * 100.0, 2)
    scenario["market_share_pct"] = round(_clamp(_safe_float(baseline["market_share_pct"]) * (1.0 + total_uplift), 0.0, 100.0), 2)

    delta: dict[str, Any] = {}
    delta["revenue_forecast_som"] = round(scenario["revenue_forecast_som"] - baseline["revenue_forecast_som"], 2)
    delta["mom_pct"] = None if baseline["mom_pct"] is None else round(_safe_float(scenario["mom_pct"]) - _safe_float(baseline["mom_pct"]), 2)
    delta["delivery_rate_pct"] = round(_safe_float(scenario["delivery_rate_pct"]) - _safe_float(baseline["delivery_rate_pct"]), 2)
    delta["cancel_rate_pct"] = round(_safe_float(scenario["cancel_rate_pct"]) - _safe_float(baseline["cancel_rate_pct"]), 2)
    delta["market_share_pct"] = round(_safe_float(scenario["market_share_pct"]) - _safe_float(baseline["market_share_pct"]), 2)
    delta["top_category_share_pct"] = round(
        _safe_float(scenario["top_category_share_pct"]) - _safe_float(baseline["top_category_share_pct"]),
        2,
    )
    delta["supplier_hhi"] = round(_safe_float(scenario.get("supplier_hhi")) - _safe_float(baseline.get("supplier_hhi")), 4)
    delta["category_hhi"] = round(_safe_float(scenario.get("category_hhi")) - _safe_float(baseline.get("category_hhi")), 4)
    delta["savings_potential_som"] = round(
        _safe_float(scenario.get("savings_potential_som")) - _safe_float(baseline.get("savings_potential_som")),
        2,
    )
    delta["leakage_value_som"] = round(
        _safe_float(scenario.get("leakage_value_som")) - _safe_float(baseline.get("leakage_value_som")),
        2,
    )
    delta["leakage_score"] = round(_safe_float(scenario.get("leakage_score")) - _safe_float(baseline.get("leakage_score")), 2)
    delta["repeat_rate_pct"] = round(_safe_float(scenario.get("repeat_rate_pct")) - _safe_float(baseline.get("repeat_rate_pct")), 2)

    compare_series = _build_compare_series(
        base_total=_safe_float(baseline["revenue_forecast_som"]),
        scenario_total=_safe_float(scenario["revenue_forecast_som"]),
        periods=int(baseline["periods"]),
        selected_month=selected_month,
    )
    drilldown_key = "sku" if str(drilldown_by or "").lower() == "sku" else "category"
    if drilldown_key == "sku":
        drilldown_points = _build_sku_drilldown(
            summary=summary,
            promo_intensity_pct=promo_intensity,
            price_cut_overpriced_pct=price_cut,
        )
    else:
        drilldown_points = _build_category_drilldown(
            summary=summary,
            top_category_share_reduce_pp=category_diversification,
        )

    trend_months = len(summary.get("sales_trends") or [])
    confidence = 0.64
    if trend_months >= 6:
        confidence += 0.1
    if _safe_float(summary.get("total_orders"), 0.0) >= 40:
        confidence += 0.1
    if abs(total_uplift) > 0.35:
        confidence -= 0.08
    confidence = round(_clamp(confidence, 0.5, 0.92), 2)

    warnings: list[str] = []
    if abs(total_uplift) > 0.35:
        warnings.append("Сценарий агрессивный: результат может отличаться от факта.")
    if _safe_float(scenario.get("cancel_rate_pct")) >= 12:
        warnings.append("Высокая доля отмен может ограничить эффект сценария.")
    if role_norm == ROLE_BUYER and _safe_float(scenario.get("supplier_hhi")) >= 0.25:
        warnings.append("Концентрация поставщиков остается высокой (HHI).")
    if role_norm == ROLE_SUPPLIER and _safe_float(scenario.get("leakage_score")) >= 35:
        warnings.append("Leakage остается значительным, нужна операционная доработка.")

    top_drivers = sorted(drivers, key=lambda x: abs(x[1]), reverse=True)[:3]
    driver_lines = [f"{name}: {val * 100:+.1f}% к прогнозу выручки" for name, val in top_drivers]

    return {
        "role": role_norm,
        "horizon_days": horizon,
        "selected_month": selected_month,
        "levers": normalized,
        "baseline": baseline,
        "scenario": scenario,
        "delta": delta,
        "compare_series": compare_series,
        "drilldown": {"by": drilldown_key, "points": drilldown_points},
        "drivers": driver_lines,
        "warnings": warnings[:4],
        "confidence": confidence,
    }


def _scenario_title_seed(title: str | None) -> str:
    clean = " ".join(str(title or "").strip().split())
    if not clean:
        return "Сценарий What-if"
    return clean[:120]


def _invalidate_what_if_cache(user_id: int, company_id: int, role: str) -> None:
    invalidate_patterns(
        f"v1:analytics_what_if:list:{int(user_id)}:{int(company_id)}:{normalize_role(role)}:*",
        f"v1:analytics_what_if:simulate:{int(user_id)}:{int(company_id)}:{normalize_role(role)}:*",
    )


def list_what_if_scenarios(
    db: Session,
    *,
    user_id: int,
    company_id: int,
    role: str,
    limit: int = 30,
) -> list[dict[str, Any]]:
    rows = (
        db.execute(
            select(ai_what_if_scenario)
            .where(
                and_(
                    ai_what_if_scenario.c.user_id == int(user_id),
                    ai_what_if_scenario.c.company_id == int(company_id),
                    ai_what_if_scenario.c.role == normalize_role(role),
                )
            )
            .order_by(ai_what_if_scenario.c.updated_at.desc(), ai_what_if_scenario.c.id.desc())
            .limit(max(1, min(100, int(limit))))
        )
        .mappings()
        .all()
    )
    out: list[dict[str, Any]] = []
    for row in rows:
        levers = {}
        result = None
        raw_levers = row.get("levers_json")
        raw_result = row.get("result_json")
        if isinstance(raw_levers, str) and raw_levers.strip():
            try:
                parsed = json.loads(raw_levers)
                if isinstance(parsed, dict):
                    levers = parsed
            except Exception:
                levers = {}
        if isinstance(raw_result, str) and raw_result.strip():
            try:
                parsed = json.loads(raw_result)
                if isinstance(parsed, dict):
                    result = parsed
            except Exception:
                result = None
        out.append(
            {
                "id": int(row["id"]),
                "title": str(row.get("title") or "Сценарий What-if"),
                "role": str(row.get("role") or normalize_role(role)),
                "horizon_days": int(row.get("horizon_days") or 30),
                "selected_month": row.get("selected_month"),
                "levers": levers,
                "result": result,
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
            }
        )
    return out


def create_what_if_scenario(
    db: Session,
    *,
    user_id: int,
    company_id: int,
    role: str,
    title: str | None,
    horizon_days: int,
    selected_month: str | None,
    levers: dict[str, Any],
    result: dict[str, Any] | None = None,
) -> dict[str, Any]:
    now = _now_utc()
    scenario_id = _next_id(db, ai_what_if_scenario)
    row = (
        db.execute(
            insert(ai_what_if_scenario)
            .values(
                {
                    "id": scenario_id,
                    "user_id": int(user_id),
                    "company_id": int(company_id),
                    "role": normalize_role(role),
                    "title": _scenario_title_seed(title),
                    "horizon_days": normalize_horizon_days(horizon_days),
                    "selected_month": selected_month,
                    "levers_json": json.dumps(normalize_levers(role, levers), ensure_ascii=False),
                    "result_json": None if result is None else json.dumps(result, ensure_ascii=False),
                    "created_at": now,
                    "updated_at": now,
                }
            )
            .returning(ai_what_if_scenario)
        )
        .mappings()
        .first()
    )
    if not row:
        raise RuntimeError("Failed to create what-if scenario")
    _invalidate_what_if_cache(int(user_id), int(company_id), role)
    return dict(row)


def rename_what_if_scenario(
    db: Session,
    *,
    scenario_id: int,
    user_id: int,
    title: str,
) -> bool:
    row = db.execute(
        select(ai_what_if_scenario.c.company_id, ai_what_if_scenario.c.role).where(
            and_(
                ai_what_if_scenario.c.id == int(scenario_id),
                ai_what_if_scenario.c.user_id == int(user_id),
            )
        )
    ).first()
    if not row:
        return False
    result = db.execute(
        update(ai_what_if_scenario)
        .where(
            and_(
                ai_what_if_scenario.c.id == int(scenario_id),
                ai_what_if_scenario.c.user_id == int(user_id),
            )
        )
        .values(
            {
                "title": _scenario_title_seed(title),
                "updated_at": _now_utc(),
            }
        )
    )
    changed = int(result.rowcount or 0) > 0
    if changed:
        _invalidate_what_if_cache(int(user_id), int(row[0]), str(row[1]))
    return changed


def delete_what_if_scenario(
    db: Session,
    *,
    scenario_id: int,
    user_id: int,
) -> bool:
    row = db.execute(
        select(ai_what_if_scenario.c.company_id, ai_what_if_scenario.c.role).where(
            and_(
                ai_what_if_scenario.c.id == int(scenario_id),
                ai_what_if_scenario.c.user_id == int(user_id),
            )
        )
    ).first()
    if not row:
        return False
    db.execute(
        delete(ai_what_if_scenario).where(
            and_(
                ai_what_if_scenario.c.id == int(scenario_id),
                ai_what_if_scenario.c.user_id == int(user_id),
            )
        )
    )
    _invalidate_what_if_cache(int(user_id), int(row[0]), str(row[1]))
    return True
