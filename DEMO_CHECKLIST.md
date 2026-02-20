# USC MVP Demo Checklist

## Before demo
1. `docker compose up -d postgres redis`
2. Backend running (`uvicorn`)
3. Frontend running (`vite`)
4. Check `GET /api/health`, `/api/health/cache`, `/api/health/llm`

## Demo flow
1. Login with test account
2. Open Home (products load + fallback works)
3. Open Analytics (charts + insights + recommendations)
4. Open AI page (ask 2-3 analytics questions)
5. Create order -> open Notifications/Orders
6. Confirm/cancel order -> verify lists refresh (cache invalidation)

## Fast debug commands
- Redis keys: `docker exec usc-redis redis-cli KEYS "usc:*"`
- Redis key count: `docker exec usc-redis redis-cli DBSIZE`
- Tail backend logs in terminal (request_id + latency)
