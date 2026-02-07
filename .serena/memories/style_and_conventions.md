# Style & conventions

## Frontend (`frontend/`)
- TypeScript is `strict: true` (see `tsconfig.app.json`).
- Uses path alias `@/*` -> `src/*` (see `tsconfig.json`).
- ESLint flat config in `frontend/eslint.config.js` (recommended JS + TypeScript + React hooks + react-refresh).

## Python backends
- No repo-wide formatter/linter config detected for Python (no `pyproject.toml`, `ruff.toml`, `setup.cfg`, etc. committed in the backend folders).
- Follow existing Django/FastAPI patterns and PEP 8.

## Cross-cutting
- Frontend origin `http://localhost:5173` is allowed by both backends’ CORS config.