"""OpenAPI spec = the API contract.

FastAPI only documents schemas used by endpoints. We also publish every model in
app.schemas.CONTRACT_MODELS (plus the error object) under components.schemas, so the
frontend can generate TypeScript types before all endpoints exist.
"""

from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel
from pydantic.json_schema import models_json_schema

from app.core.errors import ErrorResponse
from app.schemas import CONTRACT_MODELS

_INPUT_SUFFIXES = ("In", "Create", "Update")


def _mode(model: type[BaseModel]) -> str:
    return "validation" if model.__name__.endswith(_INPUT_SUFFIXES) else "serialization"


def build_openapi(app: FastAPI) -> dict[str, Any]:
    spec = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        tags=app.openapi_tags,
    )
    models = [*CONTRACT_MODELS, ErrorResponse]
    _, top = models_json_schema(
        [(m, _mode(m)) for m in models], by_alias=True, ref_template="#/components/schemas/{model}"
    )
    schemas = spec.setdefault("components", {}).setdefault("schemas", {})
    for name, schema in sorted(top.get("$defs", {}).items()):
        schemas.setdefault(name, schema)
    _use_error_object_for_validation(spec)
    return spec


def _use_error_object_for_validation(spec: dict[str, Any]) -> None:
    """Our handlers return ErrorResponse for 422s, not FastAPI's default HTTPValidationError."""
    error_ref = {"$ref": "#/components/schemas/ErrorResponse"}
    for operations in spec.get("paths", {}).values():
        for operation in operations.values():
            response = operation.get("responses", {}).get("422")
            if response is not None:
                response["description"] = "Validation error: `details.fields` maps each field to a message"
                response["content"] = {"application/json": {"schema": error_ref}}
    schemas = spec.get("components", {}).get("schemas", {})
    schemas.pop("HTTPValidationError", None)
    schemas.pop("ValidationError", None)


def install_contract_openapi(app: FastAPI) -> None:
    def openapi() -> dict[str, Any]:
        if app.openapi_schema is None:
            app.openapi_schema = build_openapi(app)
        return app.openapi_schema

    app.openapi = openapi  # type: ignore[method-assign]
