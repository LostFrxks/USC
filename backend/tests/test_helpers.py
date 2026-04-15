from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from app.db.schema import (
    accounts_user,
    catalog_category,
    catalog_product,
    companies_company,
    companies_companymember,
    delivery_deliveryassignment,
    orders_order,
    orders_orderitem,
)
from app.utils.auth import create_access_token, make_legacy_password


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def auth_headers(user_id: int, email: str = "test@usc.local") -> dict[str, str]:
    token = create_access_token(subject=str(user_id), extra={"email": email})
    return {"Authorization": f"Bearer {token}"}


def seed_user(
    db: Session,
    *,
    user_id: int,
    email: str,
    phone: str = "",
    password: str = "pass123456",
    first_name: str = "Test",
    last_name: str = "User",
    is_courier_enabled: bool = False,
) -> None:
    db.execute(
        insert(accounts_user).values(
            {
                "id": user_id,
                "password": make_legacy_password(password),
                "last_login": None,
                "is_superuser": False,
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "phone": phone,
                "is_courier_enabled": is_courier_enabled,
                "is_active": True,
                "is_staff": False,
                "created_at": now_utc(),
            }
        )
    )


def seed_company(
    db: Session,
    *,
    company_id: int,
    name: str,
    company_type: str,
    phone: str = "",
    address: str = "",
) -> None:
    db.execute(
        insert(companies_company).values(
            {
                "id": company_id,
                "name": name,
                "company_type": company_type,
                "phone": phone,
                "address": address,
                "created_at": now_utc(),
            }
        )
    )


def seed_membership(db: Session, *, member_id: int, user_id: int, company_id: int, role: str = "OWNER") -> None:
    db.execute(
        insert(companies_companymember).values(
            {
                "id": member_id,
                "role": role,
                "created_at": now_utc(),
                "company_id": company_id,
                "user_id": user_id,
            }
        )
    )


def seed_product(
    db: Session,
    *,
    product_id: int,
    supplier_company_id: int,
    category_id: int,
    name: str = "Product",
    price: Decimal = Decimal("100"),
) -> None:
    category_exists = db.execute(
        select(catalog_category.c.id).where(catalog_category.c.id == category_id)
    ).first()
    if not category_exists:
        db.execute(insert(catalog_category).values({"id": category_id, "name": f"Category {category_id}"}))

    db.execute(
        insert(catalog_product).values(
            {
                "id": product_id,
                "name": name,
                "description": "",
                "price": price,
                "unit": "pcs",
                "min_qty": Decimal("1"),
                "in_stock": True,
                "created_at": now_utc(),
                "category_id": category_id,
                "supplier_company_id": supplier_company_id,
                "stock_qty": Decimal("100"),
                "track_inventory": True,
            }
        )
    )


def seed_order(
    db: Session,
    *,
    order_id: int,
    buyer_company_id: int,
    supplier_company_id: int,
    status: str,
    delivery_mode: str = "YANDEX",
    delivery_address: str | None = None,
    delivery_lat: Decimal | None = None,
    delivery_lng: Decimal | None = None,
    comment: str = "",
) -> None:
    db.execute(
        insert(orders_order).values(
            {
                "id": order_id,
                "status": status,
                "delivery_mode": delivery_mode,
                "delivery_address": delivery_address,
                "delivery_lat": delivery_lat,
                "delivery_lng": delivery_lng,
                "comment": comment,
                "created_at": now_utc(),
                "buyer_company_id": buyer_company_id,
                "supplier_company_id": supplier_company_id,
            }
        )
    )


def seed_order_item(
    db: Session,
    *,
    item_id: int,
    order_id: int,
    product_id: int,
    qty: Decimal,
    fulfilled_qty: Decimal = Decimal("0"),
    undelivered_qty: Decimal = Decimal("0"),
    price_snapshot: Decimal = Decimal("100"),
) -> None:
    db.execute(
        insert(orders_orderitem).values(
            {
                "id": item_id,
                "qty": qty,
                "fulfilled_qty": fulfilled_qty,
                "undelivered_qty": undelivered_qty,
                "price_snapshot": price_snapshot,
                "order_id": order_id,
                "product_id": product_id,
            }
        )
    )


def seed_delivery(
    db: Session,
    *,
    delivery_id: int,
    order_id: int,
    status: str,
    courier_id: int | None = None,
) -> None:
    db.execute(
        insert(delivery_deliveryassignment).values(
            {
                "id": delivery_id,
                "status": status,
                "tracking_link": "",
                "notes": "",
                "created_at": now_utc(),
                "courier_id": courier_id,
                "order_id": order_id,
            }
        )
    )
