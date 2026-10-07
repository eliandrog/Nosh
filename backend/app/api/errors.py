"""Error responses documented on each endpoint (all use the standard error object)."""

from typing import Any

from app.core.errors import ErrorResponse

_DESCRIPTIONS = {
    403: "Not allowed (e.g. editing a built-in recipe)",
    404: "Not found",
    409: "Conflict (e.g. a recipe with this name already exists)",
    422: "Validation error: `details.fields` maps each field to a message",
}


def error_responses(*statuses: int) -> dict[int | str, dict[str, Any]]:
    return {s: {"model": ErrorResponse, "description": _DESCRIPTIONS[s]} for s in statuses}
