# Nosh – Meal Planner

A meal-planning web app for Nosh, a charity helping households on tight budgets eat well. Pick or add recipes, set dietary preferences, plan the week, and get a combined shopping list.

**Stack:** FastAPI + Uvicorn (Python, managed with uv) · SQLite · React + Vite.

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (installs and manages Python for you)
- Node.js 20+ and npm

## Getting started

> Work in progress: steps will be filled in as the backend and frontend are added.

### Backend (FastAPI)

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

API: http://localhost:8000 · Docs: http://localhost:8000/docs

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

## Data

SQLite database, seeded with the starter recipes from `Project Nosh - Candidate_Pack.json` on first run.
