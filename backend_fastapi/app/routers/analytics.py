from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.schema import catalog_category as categories
from app.db.schema import catalog_product as products
from app.db.schema import companies_companymember as company_members
from app.db.schema import orders_order as orders
from app.db.schema import orders_orderitem as items

router = APIRouter(tags=["analytics"])


def _company_ids_for_user(db: Session, user_id: int) -> list[int]:
    return [
        int(r[0])
        for r in db.execute(select(company_members.c.company_id).where(company_members.c.user_id == user_id)).all()
    ]


def _month_key(value: str | date | datetime | None) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m")
    if isinstance(value, date):
        return value.strftime("%Y-%m")
    text = str(value)
    if len(text) >= 7:
        return text[:7]
    return text


def _build_insights(
    sales_trends: list[dict],
    category_breakdown: list[dict],
    status_funnel: list[dict],
) -> list[str]:
    out: list[str] = []

    if len(sales_trends) >= 2:
        prev = float(sales_trends[-2]["revenue"])
        cur = float(sales_trends[-1]["revenue"])
        if prev > 0:
            delta_pct = ((cur - prev) / prev) * 100
            if delta_pct >= 5:
                out.append(f"Выручка за последний месяц выросла на {delta_pct:.1f}%")
            elif delta_pct <= -5:
                out.append(f"Выручка за последний месяц снизилась на {abs(delta_pct):.1f}%")
        elif cur > 0:
            out.append("В последнем месяце появились оплаченные поставки")

    top_cat = category_breakdown[0] if category_breakdown else None
    if top_cat and float(top_cat.get("share_pct", 0)) >= 55:
        out.append(
            f"Высокая концентрация по категории «{top_cat.get('name')}»: {float(top_cat.get('share_pct')):.1f}% выручки"
        )

    total = sum(int(x.get("count") or 0) for x in status_funnel)
    cancelled = 0
    for x in status_funnel:
        status = str(x.get("status") or "").upper()
        if status in {"CANCELLED", "CANCELED"}:
            cancelled += int(x.get("count") or 0)
    if total > 0:
        cancelled_share = (cancelled / total) * 100
        if cancelled_share >= 15:
            out.append(f"Доля отмен высокая ({cancelled_share:.1f}%), стоит проверить SLA и запас")
        elif cancelled_share == 0:
            out.append("Отмен за период не было")

    if not out:
        out.append("Недостаточно данных для трендов, продолжайте накапливать заказы")
    return out[:3]


@router.get("/analytics/summary/")
def analytics_summary(
    company_id: int = Query(..., ge=1),
    role: str = Query("supplier"),
    days: int = Query(180, ge=7, le=3650),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    u_id = int(user["id"])
    if company_id not in _company_ids_for_user(db, u_id):
        raise HTTPException(403, detail="Not allowed")

    role_norm = (role or "").strip().lower()
    if role_norm not in {"supplier", "buyer"}:
        role_norm = "supplier"

    company_col = orders.c.supplier_company_id if role_norm == "supplier" else orders.c.buyer_company_id
    since_dt = datetime.now(timezone.utc) - timedelta(days=days)

    delivered_company = (
        select(orders.c.id, orders.c.created_at)
        .where(
            company_col == company_id,
            orders.c.status == "DELIVERED",
            orders.c.created_at >= since_dt,
        )
        .subquery()
    )

    total_orders = db.execute(select(func.count()).select_from(delivered_company)).scalar_one()

    total_revenue = db.execute(
        select(func.coalesce(func.sum(items.c.qty * items.c.price_snapshot), 0))
        .select_from(items.join(delivered_company, items.c.order_id == delivered_company.c.id))
    ).scalar_one()

    daily_rows = db.execute(
        select(
            func.date(delivered_company.c.created_at).label("day"),
            func.coalesce(func.sum(items.c.qty * items.c.price_snapshot), 0).label("revenue"),
        )
        .select_from(items.join(delivered_company, items.c.order_id == delivered_company.c.id))
        .group_by(func.date(delivered_company.c.created_at))
        .order_by(func.date(delivered_company.c.created_at))
    ).all()

    top_rows = db.execute(
        select(
            items.c.product_id.label("product_id"),
            products.c.name.label("name"),
            func.coalesce(func.sum(items.c.qty * items.c.price_snapshot), 0).label("revenue"),
            func.coalesce(func.sum(items.c.qty), 0).label("qty_total"),
        )
        .select_from(
            items.join(delivered_company, items.c.order_id == delivered_company.c.id).join(
                products, items.c.product_id == products.c.id
            )
        )
        .group_by(items.c.product_id, products.c.name)
        .order_by(func.sum(items.c.qty * items.c.price_snapshot).desc())
        .limit(10)
    ).all()

    sales_month_rows = db.execute(
        select(
            func.date_trunc("month", delivered_company.c.created_at).label("month"),
            func.coalesce(func.sum(items.c.qty * items.c.price_snapshot), 0).label("revenue"),
        )
        .select_from(items.join(delivered_company, items.c.order_id == delivered_company.c.id))
        .group_by(func.date_trunc("month", delivered_company.c.created_at))
        .order_by(func.date_trunc("month", delivered_company.c.created_at))
    ).all()

    delivered_market = (
        select(orders.c.id, orders.c.created_at)
        .where(
            orders.c.status == "DELIVERED",
            orders.c.created_at >= since_dt,
        )
        .subquery()
    )

    market_revenue = db.execute(
        select(func.coalesce(func.sum(items.c.qty * items.c.price_snapshot), 0))
        .select_from(items.join(delivered_market, items.c.order_id == delivered_market.c.id))
    ).scalar_one()
    market_orders = db.execute(select(func.count()).select_from(delivered_market)).scalar_one()

    market_month_rows = db.execute(
        select(
            func.date_trunc("month", delivered_market.c.created_at).label("month"),
            func.coalesce(func.sum(items.c.qty * items.c.price_snapshot), 0).label("revenue"),
        )
        .select_from(items.join(delivered_market, items.c.order_id == delivered_market.c.id))
        .group_by(func.date_trunc("month", delivered_market.c.created_at))
        .order_by(func.date_trunc("month", delivered_market.c.created_at))
    ).all()

    cat_rows = db.execute(
        select(
            func.coalesce(categories.c.name, "Без категории").label("name"),
            func.coalesce(func.sum(items.c.qty * items.c.price_snapshot), 0).label("revenue"),
        )
        .select_from(
            items.join(delivered_company, items.c.order_id == delivered_company.c.id)
            .join(products, items.c.product_id == products.c.id)
            .outerjoin(categories, products.c.category_id == categories.c.id)
        )
        .group_by(func.coalesce(categories.c.name, "Без категории"))
        .order_by(func.sum(items.c.qty * items.c.price_snapshot).desc())
    ).all()

    status_rows = db.execute(
        select(
            orders.c.status.label("status"),
            func.count().label("count"),
        )
        .where(company_col == company_id, orders.c.created_at >= since_dt)
        .group_by(orders.c.status)
        .order_by(
            case(
                (orders.c.status == "PENDING", 1),
                (orders.c.status == "CONFIRMED", 2),
                (orders.c.status == "DELIVERING", 3),
                (orders.c.status == "DELIVERED", 4),
                (orders.c.status == "CANCELLED", 5),
                else_=9,
            )
        )
    ).all()

    daily_revenue = [
        {"day": str(row.day) if isinstance(row.day, date) else str(row.day), "revenue": float(row.revenue or 0)}
        for row in daily_rows
    ]

    top_products = [
        {
            "product_id": int(row.product_id),
            "name": row.name,
            "revenue": float(row.revenue or 0),
            "qty_total": float(row.qty_total or 0),
        }
        for row in top_rows
    ]

    sales_trends = [{"month": _month_key(r.month), "revenue": float(r.revenue or 0)} for r in sales_month_rows]
    market_trends = [{"month": _month_key(r.month), "revenue": float(r.revenue or 0)} for r in market_month_rows]

    cat_total = sum(float(r.revenue or 0) for r in cat_rows)
    category_breakdown = [
        {
            "name": str(r.name),
            "revenue": float(r.revenue or 0),
            "share_pct": round((float(r.revenue or 0) / cat_total) * 100, 2) if cat_total > 0 else 0,
        }
        for r in cat_rows
    ]

    status_funnel = [{"status": str(r.status), "count": int(r.count or 0)} for r in status_rows]
    insights = _build_insights(sales_trends=sales_trends, category_breakdown=category_breakdown, status_funnel=status_funnel)

    market_revenue_f = float(market_revenue or 0)
    total_revenue_f = float(total_revenue or 0)
    company_share_pct = round((total_revenue_f / market_revenue_f) * 100, 2) if market_revenue_f > 0 else 0

    return {
        "company_id": company_id,
        "role": role_norm,
        "days": days,
        "total_orders": int(total_orders or 0),
        "total_revenue": total_revenue_f,
        "daily_revenue": daily_revenue,
        "top_products": top_products,
        "market": {
            "platform_revenue": market_revenue_f,
            "platform_orders": int(market_orders or 0),
            "company_share_pct": company_share_pct,
        },
        "market_trends": market_trends,
        "sales_trends": sales_trends,
        "category_breakdown": category_breakdown,
        "status_funnel": status_funnel,
        "insights": insights,
    }
