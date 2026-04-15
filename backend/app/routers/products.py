from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import String, cast, func, insert, or_, select, update, delete
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.schema import catalog_category as categories
from app.db.schema import catalog_product as products
from app.db.schema import companies_company as companies
from app.db.schema import companies_companymember as company_members
from app.utils.pagination import drf_page
from app.core.config import settings
from app.cache.redis_cache import get_json, invalidate_patterns, make_key, set_json

router = APIRouter(tags=["products"])

def _product_col(name: str):
    c = products.c.get(name)
    if c is None:
        raise HTTPException(500, detail=f"DB schema mismatch: column '{products.name}.{name}' not found")
    return c

def _is_supplier_member(db: Session, user_id: int, company_id: int) -> bool:
    row = db.execute(
        select(company_members.c.id)
        .select_from(company_members.join(companies, company_members.c.company_id == companies.c.id))
        .where(
            company_members.c.user_id == user_id,
            company_members.c.company_id == company_id,
            companies.c.company_type == "SUPPLIER",
        )
    ).first()
    return row is not None

def _product_with_names_query():
    p = products
    c = categories
    co = companies
    return (
        select(
            p,
            co.c.name.label("supplier_name"),
            c.c.name.label("category_name"),
        )
        .select_from(
            p.outerjoin(co, p.c.supplier_company_id == co.c.id).outerjoin(c, p.c.category_id == c.c.id)
        )
    )



def _invalidate_product_related_cache() -> None:
    invalidate_patterns(
        "v1:products:*",
        "v1:categories:*",
        "v1:orders:*",
        "v1:notifications:*",
        "v1:analytics:*",
    )

class ProductCreatePayload(BaseModel):
    supplier_company_id: int = Field(..., ge=1)
    category_id: int | None = None
    name: str = Field(min_length=1)
    image_url: str | None = None
    description: str | None = None
    shelf_life_days: int | None = Field(default=None, ge=0)
    storage_condition: str | None = None
    origin_country: str | None = None
    brand: str | None = None
    manufacturer: str | None = None
    package_type: str | None = None
    net_weight_grams: float | None = Field(default=None, ge=0)
    allergens: str | None = None
    certifications: str | None = None
    lead_time_days: int | None = Field(default=None, ge=0)
    price: float = Field(..., gt=0)
    unit: str | None = None
    min_qty: float | None = None
    in_stock: bool | None = None
    track_inventory: bool | None = None
    stock_qty: float | None = None

class ProductUpdatePayload(BaseModel):
    category_id: int | None = None
    name: str | None = None
    image_url: str | None = None
    description: str | None = None
    shelf_life_days: int | None = Field(default=None, ge=0)
    storage_condition: str | None = None
    origin_country: str | None = None
    brand: str | None = None
    manufacturer: str | None = None
    package_type: str | None = None
    net_weight_grams: float | None = Field(default=None, ge=0)
    allergens: str | None = None
    certifications: str | None = None
    lead_time_days: int | None = Field(default=None, ge=0)
    price: float | None = None
    unit: str | None = None
    min_qty: float | None = None
    in_stock: bool | None = None
    track_inventory: bool | None = None
    stock_qty: float | None = None


@router.get("/products/my_supplier_products/")
def my_supplier_products(
    company_id: int | None = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    u_id = int(user["id"])
    cache_key = make_key("products", "my_supplier_products", u_id, company_id if company_id is not None else "_")
    cached = get_json(cache_key)
    if isinstance(cached, list):
        return cached

    supplier_ids: list[int] = []

    if company_id is not None:
        # verify membership and type=SUPPLIER
        row = db.execute(
            select(companies.c.id)
            .select_from(company_members.join(companies, company_members.c.company_id == companies.c.id))
            .where(
                company_members.c.user_id == u_id,
                company_members.c.company_id == company_id,
                companies.c.company_type == "SUPPLIER",
            )
        ).first()
        if not row:
            raise HTTPException(403, detail="Not allowed")
        supplier_ids = [int(company_id)]
    else:
        supplier_ids = [
            int(r[0])
            for r in db.execute(
                select(company_members.c.company_id)
                .select_from(company_members.join(companies, company_members.c.company_id == companies.c.id))
                .where(company_members.c.user_id == u_id, companies.c.company_type == "SUPPLIER")
            ).all()
        ]

    if not supplier_ids:
        return []

    q = _product_with_names_query().where(products.c.supplier_company_id.in_(supplier_ids)).order_by(products.c.id.desc())

    rows = db.execute(q).mappings().all()
    response = [dict(r) for r in rows]
    set_json(cache_key, response, settings.CACHE_TTL_PRODUCTS)
    return response


@router.get("/products/")
def list_products(
    request: Request,
    limit: int = 20,
    offset: int = 0,
    search: str | None = None,  # text search
    category: str | None = None,  # id or name
    supplier_company: int | None = None,  # supplier company id
    in_stock: bool | None = None,
    db: Session = Depends(get_db),
):
    cache_key = make_key("products", "list", limit, offset, search or "", category or "", supplier_company, in_stock)
    cached = get_json(cache_key)
    if isinstance(cached, dict):
        return cached

    p = products
    c = categories
    q = _product_with_names_query()

    if supplier_company is not None:
        q = q.where(p.c.supplier_company_id == supplier_company)

    if in_stock is not None and "in_stock" in p.c:
        q = q.where(p.c.in_stock == in_stock)

    if category:
        v = category.strip()
        if v.isdigit():
            q = q.where(p.c.category_id == int(v))
        else:
            q = q.where(func.lower(c.c.name) == v.lower())

    if search:
        s = f"%{search.strip()}%"
        clauses = [cast(p.c.name, String).ilike(s)]
        if "description" in p.c:
            clauses.append(cast(p.c.description, String).ilike(s))
        q = q.where(or_(*clauses))

    total = db.execute(select(func.count()).select_from(q.subquery())).scalar_one()
    rows = db.execute(q.order_by(p.c.id.desc()).limit(limit).offset(offset)).mappings().all()

    items = [dict(r) for r in rows]
    response = drf_page(items=items, total=total, limit=limit, offset=offset, path=str(request.url.path))
    set_json(cache_key, response, settings.CACHE_TTL_PRODUCTS)
    return response

@router.post("/products/")
def create_product(
    payload: ProductCreatePayload,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    u_id = int(user["id"])
    if not _is_supplier_member(db, u_id, payload.supplier_company_id):
        raise HTTPException(403, detail="Not allowed")

    values: dict = {
        "supplier_company_id": payload.supplier_company_id,
        "name": payload.name.strip(),
        "price": payload.price,
    }
    if payload.category_id is not None and "category_id" in products.c:
        values["category_id"] = payload.category_id
    if "image_url" in products.c and payload.image_url is not None:
        values["image_url"] = payload.image_url.strip()
    # Provide safe defaults for NOT NULL columns even if DB defaults are absent.
    if "description" in products.c:
        values["description"] = payload.description if payload.description is not None else ""
    if "shelf_life_days" in products.c and payload.shelf_life_days is not None:
        values["shelf_life_days"] = payload.shelf_life_days
    if "storage_condition" in products.c and payload.storage_condition is not None:
        values["storage_condition"] = payload.storage_condition
    if "origin_country" in products.c and payload.origin_country is not None:
        values["origin_country"] = payload.origin_country
    if "brand" in products.c and payload.brand is not None:
        values["brand"] = payload.brand
    if "manufacturer" in products.c and payload.manufacturer is not None:
        values["manufacturer"] = payload.manufacturer
    if "package_type" in products.c and payload.package_type is not None:
        values["package_type"] = payload.package_type
    if "net_weight_grams" in products.c and payload.net_weight_grams is not None:
        values["net_weight_grams"] = payload.net_weight_grams
    if "allergens" in products.c and payload.allergens is not None:
        values["allergens"] = payload.allergens
    if "certifications" in products.c and payload.certifications is not None:
        values["certifications"] = payload.certifications
    if "lead_time_days" in products.c and payload.lead_time_days is not None:
        values["lead_time_days"] = payload.lead_time_days
    if "unit" in products.c:
        values["unit"] = payload.unit if payload.unit is not None else ""
    if "min_qty" in products.c:
        values["min_qty"] = payload.min_qty if payload.min_qty is not None else 1
    if "in_stock" in products.c:
        values["in_stock"] = payload.in_stock if payload.in_stock is not None else True
    if "track_inventory" in products.c:
        values["track_inventory"] = payload.track_inventory if payload.track_inventory is not None else False
    if payload.stock_qty is not None and "stock_qty" in products.c:
        values["stock_qty"] = payload.stock_qty
    if "created_at" in products.c:
        values["created_at"] = datetime.now(timezone.utc)

    try:
        ins = insert(products).values(values).returning(_product_col("id"))
        prod_id = int(db.execute(ins).scalar_one())
        db.commit()
        _invalidate_product_related_cache()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, detail=f"Product create failed. DB says: {e}")

    row = db.execute(_product_with_names_query().where(products.c.id == prod_id)).mappings().first()
    return dict(row) if row else {"id": prod_id, **values}

@router.patch("/products/{product_id}/")
def update_product(
    product_id: int,
    payload: ProductUpdatePayload,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.execute(select(products).where(products.c.id == product_id)).mappings().first()
    if not row:
        raise HTTPException(404, detail="Product not found")

    supplier_company_id = int(row.get("supplier_company_id"))
    if not _is_supplier_member(db, int(user["id"]), supplier_company_id):
        raise HTTPException(403, detail="Not allowed")

    values: dict = {}
    provided_fields = set(payload.model_fields_set)
    if payload.category_id is not None and "category_id" in products.c:
        values["category_id"] = payload.category_id
    if payload.name is not None and "name" in products.c:
        values["name"] = payload.name.strip()
    if "image_url" in provided_fields and "image_url" in products.c:
        values["image_url"] = (payload.image_url or "").strip() or None
    if "description" in provided_fields and "description" in products.c:
        values["description"] = payload.description or ""
    if "shelf_life_days" in provided_fields and "shelf_life_days" in products.c:
        values["shelf_life_days"] = payload.shelf_life_days
    if "storage_condition" in provided_fields and "storage_condition" in products.c:
        values["storage_condition"] = payload.storage_condition
    if "origin_country" in provided_fields and "origin_country" in products.c:
        values["origin_country"] = payload.origin_country
    if "brand" in provided_fields and "brand" in products.c:
        values["brand"] = payload.brand
    if "manufacturer" in provided_fields and "manufacturer" in products.c:
        values["manufacturer"] = payload.manufacturer
    if "package_type" in provided_fields and "package_type" in products.c:
        values["package_type"] = payload.package_type
    if "net_weight_grams" in provided_fields and "net_weight_grams" in products.c:
        values["net_weight_grams"] = payload.net_weight_grams
    if "allergens" in provided_fields and "allergens" in products.c:
        values["allergens"] = payload.allergens
    if "certifications" in provided_fields and "certifications" in products.c:
        values["certifications"] = payload.certifications
    if "lead_time_days" in provided_fields and "lead_time_days" in products.c:
        values["lead_time_days"] = payload.lead_time_days
    if payload.price is not None and "price" in products.c:
        values["price"] = payload.price
    if payload.unit is not None and "unit" in products.c:
        values["unit"] = payload.unit
    if payload.min_qty is not None and "min_qty" in products.c:
        values["min_qty"] = payload.min_qty
    if payload.in_stock is not None and "in_stock" in products.c:
        values["in_stock"] = payload.in_stock
    if payload.track_inventory is not None and "track_inventory" in products.c:
        values["track_inventory"] = payload.track_inventory
    if payload.stock_qty is not None and "stock_qty" in products.c:
        values["stock_qty"] = payload.stock_qty

    if values:
        db.execute(update(products).where(products.c.id == product_id).values(values))
        db.commit()
        _invalidate_product_related_cache()

    row = db.execute(_product_with_names_query().where(products.c.id == product_id)).mappings().first()
    if not row:
        raise HTTPException(404, detail="Product not found")
    return dict(row)

@router.delete("/products/{product_id}/", status_code=204)
def delete_product(
    product_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.execute(select(products).where(products.c.id == product_id)).mappings().first()
    if not row:
        raise HTTPException(404, detail="Product not found")
    supplier_company_id = int(row.get("supplier_company_id"))
    if not _is_supplier_member(db, int(user["id"]), supplier_company_id):
        raise HTTPException(403, detail="Not allowed")

    try:
        db.execute(delete(products).where(products.c.id == product_id))
        db.commit()
        _invalidate_product_related_cache()
        _invalidate_product_related_cache()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, detail=f"Product delete failed. DB says: {e}")
    return None
