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

The SQLite database (`backend/nosh.db`) is created automatically on startup.

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

## Data

SQLite database. Starter recipes from `Project Nosh - Candidate_Pack.json` will be seeded on first run (not yet implemented).
