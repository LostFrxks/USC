from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.schema import catalog_category as categories
from app.utils.pagination import drf_page

router = APIRouter(tags=["categories"])

class CategoryCreatePayload(BaseModel):
    name: str = Field(min_length=1)

class CategoryUpdatePayload(BaseModel):
    name: str | None = None


@router.get("/categories/")
def list_categories(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    total = db.execute(select(func.count()).select_from(categories)).scalar_one()
    rows = db.execute(
        select(categories.c.id, categories.c.name).order_by(categories.c.id.asc()).limit(limit).offset(offset)
    ).all()

    items = [{"id": r.id, "name": r.name} for r in rows]
    return drf_page(items=items, total=total, limit=limit, offset=offset, path=str(request.url.path))

@router.post("/categories/")
def create_category(
    payload: CategoryCreatePayload,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del user
    try:
        ins = categories.insert().values({"name": payload.name.strip()}).returning(categories.c.id)
        cat_id = int(db.execute(ins).scalar_one())
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, detail=f"Category create failed. DB says: {e}")

    return {"id": cat_id, "name": payload.name.strip()}

@router.patch("/categories/{category_id}/")
def update_category(
    category_id: int,
    payload: CategoryUpdatePayload,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del user
    values: dict = {}
    if payload.name is not None:
        values["name"] = payload.name.strip()
    if values:
        db.execute(categories.update().where(categories.c.id == category_id).values(values))
        db.commit()

    row = db.execute(select(categories.c.id, categories.c.name).where(categories.c.id == category_id)).first()
    if not row:
        raise HTTPException(404, detail="Category not found")
    return {"id": row.id, "name": row.name}

@router.delete("/categories/{category_id}/", status_code=204)
def delete_category(
    category_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del user
    try:
        db.execute(categories.delete().where(categories.c.id == category_id))
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, detail=f"Category delete failed. DB says: {e}")
    return None
