# What to do when finishing a task

## Frontend
- `cd frontend`
- `npm run lint`
- `npm run build` (catches TS + bundling issues)

## Django backend
- `cd backend`
- `python manage.py check`
- If tests exist for your change: `python manage.py test`

## FastAPI backend
- `cd backend_fastapi`
- (Optional) smoke-run: `uvicorn app.main:app --reload` and hit the `/health` route (if present).