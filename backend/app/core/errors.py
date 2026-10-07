"""Domain errors and the single error object every API failure returns.

Services raise the domain errors below; they know nothing about HTTP. The global
handlers (registered in main.create_app) turn them, request validation errors,
unknown routes and unexpected exceptions into:

    {"error": {"code": "recipe_not_found", "message": "...", "details": {...}, "requestId": "..."}}

Internal details (stack traces, SQL, exception text) are logged with the request id
and never sent to the client.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.request_context import get_request_id

logger = logging.getLogger("app.errors")

GENERIC_MESSAGE = "Something went wrong on our side. Please try again."


# ---------- Error object (part of the API contract) ----------


class _ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ErrorBody(_ApiModel):
    code: str  # stable, machine-readable, e.g. "validation_error", "recipe_not_found"
    message: str  # plain-language, safe to show to the user
    details: dict[str, Any] | None = None  # e.g. {"fields": {"name": "..."}} for validation
    request_id: str  # quote this when reporting a problem; matches the server logs


class ErrorResponse(_ApiModel):
    error: ErrorBody


# ---------- Domain errors (raised by services) ----------


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, code: str | None = None, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.message = message
        self.code = code or self.code
        self.details = details


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class ValidationFailed(AppError):
    """Business-rule validation (beyond request shape), e.g. an unknown unit."""

    status_code = 422
    code = "validation_error"

    def __init__(self, message: str, *, fields: dict[str, str] | None = None, code: str | None = None):
        super().__init__(message, code=code, details={"fields": fields} if fields else None)


# ---------- Handlers ----------


def _response(status: int, code: str, message: str, details: dict[str, Any] | None = None) -> JSONResponse:
    body = ErrorResponse(error=ErrorBody(code=code, message=message, details=details, request_id=get_request_id()))
    return JSONResponse(status_code=status, content=body.model_dump(by_alias=True, exclude_none=True))


def _field_path(loc: tuple[Any, ...]) -> str:
    """('body', 'ingredients', 0, 'quantity') -> 'ingredients.0.quantity' (camelCase)."""
    parts = [p for p in loc if p not in ("body", "query", "path", "header")]
    return ".".join(to_camel(p) if isinstance(p, str) else str(p) for p in parts) or "request"


async def _app_error(_: Request, exc: AppError) -> JSONResponse:
    logger.info("%s: %s", exc.code, exc.message)
    return _response(exc.status_code, exc.code, exc.message, exc.details)


async def _request_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
    fields: dict[str, str] = {}
    for err in exc.errors():
        fields.setdefault(_field_path(tuple(err.get("loc", ()))), err.get("msg", "Invalid value"))
    logger.info("validation_error: %s", fields)
    return _response(422, "validation_error", "Some details need fixing.", {"fields": fields})


async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    if exc.status_code == 404:
        return _response(404, "not_found", "We couldn't find that.")
    if exc.status_code == 405:
        return _response(405, "method_not_allowed", "That action isn't supported here.")
    return _response(exc.status_code, "http_error", str(exc.detail) if exc.status_code < 500 else GENERIC_MESSAGE)


def internal_error_response(exc: Exception) -> JSONResponse:
    """500 with a generic message; the real error goes to the logs only."""
    logger.error("internal_error: unhandled %s", type(exc).__name__, exc_info=exc)
    return _response(500, "internal_error", GENERIC_MESSAGE)


async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
    return internal_error_response(exc)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(RequestValidationError, _request_validation)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(Exception, _unexpected)
