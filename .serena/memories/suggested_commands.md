# Suggested commands (Windows / PowerShell)

## Frontend
- `cd frontend`
- `npm install`
- `npm run dev` (Vite dev server; usually `http://localhost:5173`)
- `npm run lint`
- `npm run build`
- `npm run preview`

## Backend (Django)
- `cd backend`
- Activate venv if present: `\.\.venv\Scripts\Activate.ps1` (repo contains `backend/.venv/`)
- Run migrations: `python manage.py migrate`
- Start server: `python manage.py runserver`
- Admin user: `python manage.py createsuperuser`

Environment (see `backend/config/settings.py`):
- `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`

Note: `backend/` does not include a committed `requirements.txt`/`pyproject.toml`.
If the venv isn’t usable, install deps manually or generate a requirements file from the working environment.

## Backend (FastAPI)
- `cd backend_fastapi`
- Create/activate venv (if needed): `python -m venv .venv; .\.venv\Scripts\Activate.ps1`
- Install: `pip install -r requirements.txt`
- Start server: `uvicorn app.main:app --reload` (run from `backend_fastapi/`)

## Useful repo navigation
- List files: `Get-ChildItem`
- Search text: `rg "pattern" .`