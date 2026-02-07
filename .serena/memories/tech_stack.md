# Tech stack

## Frontend (`frontend/`)
- React 19 + TypeScript (strict).
- Vite.
- Routing: `react-router-dom`.
- Data fetching/caching: `@tanstack/react-query`.
- HTTP: `axios`.
- Auth helper: `jwt-decode`.
- Linting: ESLint (flat config).

## Backend (Django) (`backend/`)
- Django 6.0 + Django REST Framework.
- Auth: `djangorestframework-simplejwt`.
- Filtering: `django-filter`.
- CORS: `django-cors-headers`.
- Env: `python-dotenv`.
- DB: PostgreSQL (via env vars in settings).

## Backend (FastAPI) (`backend_fastapi/`)
- FastAPI + Uvicorn.
- Pydantic v2 + `pydantic-settings`.
- SQLAlchemy.
- Env: `python-dotenv`.
- DB driver: `psycopg2-binary` (PostgreSQL).