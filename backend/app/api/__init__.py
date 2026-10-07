"""API layer (routers): URLs, status codes and request/response schemas only.

Routers call services and return schemas from app.schemas; they never query the
database or return SQLModel tables directly.
"""

from fastapi import APIRouter

from app.api import health

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
