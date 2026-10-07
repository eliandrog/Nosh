# Nosh – Meal Planner

A meal-planning web app for Nosh, a charity helping households on tight budgets eat well. Pick or add recipes, set dietary preferences, plan the week, and get a combined shopping list.

**Stack:** FastAPI + Uvicorn (Python, managed with uv) · SQLite · React + Vite.

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (installs and manages Python for you)
- Node.js 22.12+ (or 20.19+) and npm

## Getting started

Run the backend and frontend in two terminals.

### Backend (FastAPI)

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

API: http://localhost:8000 (redirects to the docs) · Docs (Swagger UI): http://localhost:8000/api/docs · OpenAPI spec: http://localhost:8000/api/openapi.json

The SQLite database (`backend/nosh.db`) is created and seeded automatically on startup. To start fresh, stop the server and delete `backend/nosh.db`.

> **After pulling changes to the database schema** (`backend/app/models.py`), delete `backend/nosh.db` before starting the backend. There are no migrations yet: tables are created if missing but existing tables are not altered. The starter recipes are reloaded from the JSON automatically. Set `NOSH_DB_PATH` to use a different file (tests use a temporary database).

Logs go to the console in one format with a request id on every line. Set `NOSH_LOG_LEVEL` (default `INFO`) to change the level. Every response carries an `X-Request-ID` header, and API errors return `{"error": {"code", "message", "details", "requestId"}}`.

The API contract is the OpenAPI spec (`/api/openapi.json`), exported to `backend/openapi.json` for the frontend type generator. After changing `backend/app/schemas.py`, re-export it (a test fails if it's out of date):

```bash
uv run python -m app.export_openapi
```

Run tests:

```bash
uv run pytest
```

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173 (requests to `/api` are proxied to the backend).

To run the frontend **without the backend** (sample recipes kept in memory):

```bash
VITE_USE_MOCKS=true npm run dev
```

#### Phones and older browsers

The production build includes a modern bundle plus a legacy bundle with polyfills (via `@vitejs/plugin-legacy`), so it also runs on older phone browsers. Each browser loads the version it supports.

To try it on a phone on the same Wi-Fi:

```bash
npm run build
npm run preview -- --host   # open the "Network" URL on your phone
```

`npm run dev -- --host` also works for quick checks, but the dev server serves modern code only.

## Data

SQLite database, accessed with SQLModel. On first run (empty database) the 20 starter recipes in `backend/data/project-nosh-sample-recipes.json` (provided with the brief, never modified) are loaded in one transaction; restarting never duplicates them.
