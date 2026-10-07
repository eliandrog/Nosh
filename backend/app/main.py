"""App factory: wires settings, logging, middleware, error handlers and routers.

Layers (dependencies only point down):
    api/          routers: HTTP in/out, request/response schemas (app/schemas.py)
    services/     business rules; raise domain errors from app/core/errors.py
    repositories/ the only code that queries the database
    models.py     SQLModel tables
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.api import OPENAPI_TAGS, api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import REQUEST_ID_HEADER, RequestContextMiddleware
from app.core.openapi import install_contract_openapi
from app.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    configure_logging(settings.log_level)

    app = FastAPI(
        title="Nosh API",
        description="Meal planning for households on a tight budget. Errors always use the `ErrorResponse` object.",
        version="0.1.0",
        lifespan=lifespan,
        openapi_tags=OPENAPI_TAGS,
        # Clean operation ids (e.g. "list_recipes") for the generated frontend client.
        generate_unique_id_function=lambda route: route.name,
        # Served under /api so the Vite dev proxy exposes them on :5173 too.
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[REQUEST_ID_HEADER],
    )
    app.add_middleware(RequestContextMiddleware)  # outermost: every request gets an id and an access log line
    register_exception_handlers(app)
    app.include_router(api_router)
    install_contract_openapi(app)

    @app.get("/", include_in_schema=False)
    def root() -> RedirectResponse:
        return RedirectResponse(url=app.docs_url)

    return app


app = create_app()
