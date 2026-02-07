# USC project overview

## What this repo is
Full-stack web app:
- `frontend/`: React + TypeScript + Vite SPA.
- `backend/`: Django + Django REST Framework API (apps: `accounts`, `companies`, `catalog`, `delivery`, `orders`).
- `backend_fastapi/`: alternative/parallel FastAPI API implementation (routers for health/products/categories/companies/orders).

## High-level structure
- Frontend talks to an API and expects CORS from `http://localhost:5173`.
- Django backend is configured for PostgreSQL via environment variables.
- FastAPI backend uses SQLAlchemy + PostgreSQL driver and reads config from `.env`.

## Notes
- There appear to be two backends (`backend/` and `backend_fastapi/`). Pick one to run locally to avoid port/db confusion.