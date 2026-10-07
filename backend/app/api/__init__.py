"""API layer (routers): URLs, status codes and request/response schemas only.

Routers call services and return schemas from app.schemas; they never query the
database or return SQLModel tables directly.
"""

from fastapi import APIRouter

from app.api import health, recipes, reference, settings

api_router = APIRouter(prefix="/api")
api_router.include_router(recipes.router)
api_router.include_router(reference.router)
api_router.include_router(settings.router)
api_router.include_router(health.router)

OPENAPI_TAGS = [
    {"name": "Recipes", "description": "Browse, search, filter, create, edit and delete recipes."},
    {"name": "Reference data", "description": "Fixed lists, units, tags and ingredient suggestions for forms and filters."},
    {"name": "Preferences & profile", "description": "The user's dietary preferences and profile (single user, no login)."},
    {"name": "Health", "description": "Service health check."},
]
