from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import insert

from app.db.schema import catalog_category, catalog_product
from tests.test_helpers import auth_headers, seed_company, seed_membership, seed_user


def test_products_update_and_list_extra_fields(client, db_session):
    seed_user(db_session, user_id=1, email="supplier@test.local")
    seed_company(db_session, company_id=20, name="Supplier Co", company_type="SUPPLIER")
    seed_membership(db_session, member_id=1, user_id=1, company_id=20)
    db_session.execute(insert(catalog_category).values({"id": 10, "name": "Meat"}))
    db_session.execute(
        insert(catalog_product).values(
            {
                "id": 501,
                "supplier_company_id": 20,
                "category_id": 10,
                "name": "Chicken Fillet",
                "description": "Fresh chilled fillet",
                "shelf_life_days": 7,
                "storage_condition": "+2...+6C",
                "origin_country": "Kyrgyzstan",
                "brand": "Farm Choice",
                "manufacturer": "NorthPeak Foods",
                "package_type": "Vacuum",
                "net_weight_grams": 1000,
                "allergens": "None",
                "certifications": "ISO 22000",
                "lead_time_days": 2,
                "price": 420,
                "unit": "kg",
                "min_qty": 1,
                "in_stock": True,
                "created_at": datetime.now(timezone.utc),
                "track_inventory": False,
            }
        )
    )
    db_session.commit()

    update_response = client.patch(
        "/api/products/501/",
        headers=auth_headers(1, "supplier@test.local"),
        json={
            "description": "Updated description",
            "shelf_life_days": 10,
            "storage_condition": "Dry store",
            "origin_country": "Kazakhstan",
            "brand": "Prime Select",
            "manufacturer": "Alma Protein",
            "package_type": "Box",
            "net_weight_grams": 750,
            "allergens": "Soy traces",
            "certifications": "HACCP",
            "lead_time_days": 1,
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["description"] == "Updated description"
    assert updated["shelf_life_days"] == 10
    assert updated["storage_condition"] == "Dry store"
    assert updated["origin_country"] == "Kazakhstan"
    assert updated["brand"] == "Prime Select"
    assert updated["manufacturer"] == "Alma Protein"
    assert updated["package_type"] == "Box"
    assert float(updated["net_weight_grams"]) == 750.0
    assert updated["allergens"] == "Soy traces"
    assert updated["certifications"] == "HACCP"
    assert updated["lead_time_days"] == 1

    list_response = client.get("/api/products/?supplier_company=20")
    assert list_response.status_code == 200
    page = list_response.json()
    assert page["results"][0]["shelf_life_days"] == 10
    assert page["results"][0]["storage_condition"] == "Dry store"
    assert page["results"][0]["origin_country"] == "Kazakhstan"
    assert page["results"][0]["brand"] == "Prime Select"
    assert page["results"][0]["manufacturer"] == "Alma Protein"
    assert page["results"][0]["package_type"] == "Box"
    assert float(page["results"][0]["net_weight_grams"]) == 750.0
    assert page["results"][0]["allergens"] == "Soy traces"
    assert page["results"][0]["certifications"] == "HACCP"
    assert page["results"][0]["lead_time_days"] == 1
