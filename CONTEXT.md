# USC project context

## What’s done (FastAPI backend)
- FastAPI auth + JWT support (login/register/token/refresh) and `/me` profile endpoints.
- DB schema is now defined explicitly in FastAPI (`backend_fastapi/app/db/schema.py`) and managed via Alembic (no reflection/autoload at runtime).
- Deliveries endpoints (list, upsert_for_order, set_status).
- Products/companies/categories endpoints aligned to frontend contracts:
  - `/api/products/` supports `search`, `category` (id or name), `supplier_company`, `in_stock`.
  - `/api/companies/suppliers/` supports `search`/`q`, filters by `company_type=SUPPLIER`.
  - Products return `supplier_name` and `category_name`.
- Orders endpoints aligned to frontend:
  - `/api/orders/` list
  - `/api/orders/{id}/` detail with `items[].name`
  - `/api/orders/create/` creates order + delivery row
  - Actions: `inbox`, `outbox`, `supplier_confirm`, `cancel`.
- Companies/categories/products now support CRUD in FastAPI.
- Updated dependencies: `PyJWT`, `email-validator`.
- `/api/auth/email/request/` mail code flow enforced for registration.
- Frontend now fetches `/api/auth/me/`, shows company picker, and stores selected company in `localStorage`.
- Orders history + cart checkout use the selected `buyer_company_id` (no more temp ID).
- Drawer now includes a logout action.
- Supplier orders view added in frontend (inbox/outbox via `/api/orders/inbox/` and `/api/orders/outbox/`).
- Profile screen now shows real user/company data and offers company switch.
- Auth screen UX improved (validation, cooldown for code resend).
- Order creation now requires auth and checks buyer company membership.
- Added delivery coordinates flow in checkout (manual lat/lng + geolocation + open in OSM), stores coords in order comment.
- Checkout now lets user choose delivery type (supplier courier / own courier / Yandex).
- Auto-create company + membership on registration (email/phone) to avoid “no companies” screen.
- Home shows 20 product cards by repeating items if API has fewer.
- Added detailed mock analytics screen (market metrics + sales forecast) as separate tab.
- Company picker is now optional (soft banner + modal picker), not blocking main screen.

## Files changed (high-level)
Backend FastAPI:
- `backend_fastapi/app/main.py` (router includes)
- `backend_fastapi/app/routers/auth.py` (new)
- `backend_fastapi/app/routers/profile.py` (new)
- `backend_fastapi/app/routers/deliveries.py` (new)
- `backend_fastapi/app/routers/companies.py` (updated)
- `backend_fastapi/app/routers/products.py` (updated)
- `backend_fastapi/app/routers/categories.py` (updated)
- `backend_fastapi/app/routers/orders.py` (updated)
- `backend_fastapi/app/deps/auth.py` (new)
- `backend_fastapi/app/utils/auth.py` (new)
- `backend_fastapi/app/core/config.py` (JWT settings added)
- `backend_fastapi/requirements.txt` (PyJWT + email-validator + Alembic)

Frontend:
- `frontend/src/api/auth.ts` (login path)
- `frontend/src/api/products.ts` (pass-through fields)
- `frontend/src/types.ts` (Product fields)
- `frontend/src/screens/CartScreen.tsx` (use typed supplier_company_id)
- `frontend/src/screens/HomeScreen.tsx` (category -> ID mapping)
- `frontend/src/screens/OrdersOverlay.tsx` (itemsCount)
- `frontend/src/ui/TopHeader.tsx` (clean import)

## What’s ready to run
FastAPI (from `backend_fastapi/`):
- `.\.venv\Scripts\python -m pip install -r requirements.txt`
- Alembic migrations:
  - fresh DB: `.\.venv\Scripts\python -m alembic -c alembic.ini upgrade head`
  - existing DB with the same tables already present: `.\.venv\Scripts\python -m alembic -c alembic.ini stamp head`
- `.\.venv\Scripts\python -m uvicorn app.main:app --reload`

Frontend (from `frontend/`):
- `npm install`
- `npm run dev`

## What still needs to be decided / done
1) **Supplier order view**  
   If supplier role should use `/api/orders/inbox/` instead of buyer `orders/` list, add a dedicated list adapter.
2) **Live map tracking**  
   Map picker is done, but live courier tracking is not implemented yet.

2) **Delivery mode mapping**  
   Decide mapping for frontend `delivery/pickup` → `BUYER_COURIER/SUPPLIER_COURIER/YANDEX`.

3) **Permissions**  
   Most FastAPI endpoints are now open like the frontend expects. Decide which should require auth (products CRUD, orders actions, deliveries).

4) **Category mapping**  
   Frontend uses hardcoded category chips → numeric IDs. If you add real categories (Meat/Milk/etc.), update chip IDs.

5) **Parity checks**  
   Verify endpoints with real DB data, especially `supplier_confirm` and inventory updates.

## Product direction (next improvements)
- Build a clear end-to-end order journey so users always know the next action:
  - `Created -> Confirmed -> Delivering -> Delivered` with visible timeline on order details.
  - Action buttons by role/status (confirm, cancel, update delivery status).
- Add action-oriented notifications:
  - Notification cards should include direct actions like "Open order", "Confirm", "Track".
- Improve repeat-order workflows:
  - "Repeat order in one tap" from history.
  - Saved cart templates for weekly procurement.
- Increase data trust signals:
  - stock freshness, SLA window, supplier reliability badges, and delivery ETA.
- Strengthen role separation:
  - supplier dashboard focuses on inbound orders and fulfillment;
  - buyer dashboard focuses on reorder speed and delivery confidence.

## Recent UX updates
- Orders screen:
  - quick actions on cards: `Details`, `Confirm`, `Repeat`, `Track`;
  - mobile-friendly status filters (`All`, `Active`, `Delivered`, `Cancelled`);
  - next-step hint on each order card to make the journey explicit.
- Notifications screen:
  - direct order actions (`Open order`, supplier `Confirm`);
  - toast feedback for action results;
  - fixed corrupted Cyrillic labels/messages.
- App wiring:
  - notification-to-order deep-link (`open order` focuses the order in `OrdersScreen`);
  - `OrdersScreen` now receives `onNotify` for consistent global toasts.

## In progress now
- Next UX step: add "saved reorder templates" to speed up weekly purchasing.
