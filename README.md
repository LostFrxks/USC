# USC MVP: Local Run + Redis Cache

## 1) Prerequisites
- Docker Desktop running
- Python venv for backend already created
- Node.js installed for frontend

## 2) Start infrastructure (Postgres + Redis)
```powershell
docker compose up -d postgres redis
```

Check services:
```powershell
docker ps
```

## 3) Backend setup and run
```powershell
cd backend_fastapi
.\.venv\Scripts\Activate.ps1
```

Create/update `backend_fastapi/.env` (minimum):
```env
DATABASE_URL=postgresql+psycopg2://usc:usc123@127.0.0.1:5432/usc_db
REDIS_URL=redis://127.0.0.1:6379/0
REDIS_PREFIX=usc
REDIS_TIMEOUT_SECONDS=1.5

# optional cache TTLs
CACHE_TTL_ANALYTICS_SUMMARY=45
CACHE_TTL_ANALYTICS_INSIGHTS=120
CACHE_TTL_ANALYTICS_ASSISTANT=45
CACHE_TTL_CATEGORIES=180
CACHE_TTL_PRODUCTS=45
CACHE_TTL_SUPPLIERS=60
```

Run API:
```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 4) Frontend run
```powershell
cd frontend
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

## 5) Quick Redis checks
Ping Redis:
```powershell
docker exec usc-redis redis-cli ping
```
Expected: `PONG`

Watch cache keys count (after opening app screens and analytics):
```powershell
docker exec usc-redis redis-cli DBSIZE
```

See USC keys:
```powershell
docker exec usc-redis redis-cli KEYS "usc:*"
```

Get TTL for one key:
```powershell
docker exec usc-redis redis-cli TTL "usc:v1:categories:list:100:0"
```

## 6) What is cached now
Read-through Redis cache is enabled for:
- `/api/categories/`
- `/api/products/`
- `/api/companies/`
- `/api/companies/my_memberships/`
- `/api/companies/suppliers/`
- `/api/profile/me/` and `/api/auth/me/`
- `/api/notifications/`
- `/api/orders/`, `/api/orders/{id}/`, `/api/orders/inbox/`, `/api/orders/outbox/`
- `/api/deliveries/`, `/api/deliveries/by_order/{order_id}/`
- `/api/analytics/summary/`
- analytics insights cache
- analytics assistant answers cache

If `REDIS_URL` is empty or Redis is unavailable, backend gracefully falls back to non-cached behavior.


## 7) Health endpoints
- `/api/health`
- `/api/health/cache`
- `/api/health/llm`

## 8) Supporting docs/scripts
- Cache key map: `CACHE_KEYS.md`
- Demo checklist: `DEMO_CHECKLIST.md`
- Helper startup script: `scripts/dev_start.ps1`
- Encoding check: `scripts/check_encoding.py`
