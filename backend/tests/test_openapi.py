from fastapi.testclient import TestClient

from app.main import app


def test_openapi_spec_served_under_api():
    with TestClient(app) as client:
        response = client.get("/api/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    assert spec["openapi"].startswith("3.")
    assert "/api/health" in spec["paths"]


def test_swagger_ui_served_under_api():
    with TestClient(app) as client:
        response = client.get("/api/docs")
    assert response.status_code == 200
    assert "swagger-ui" in response.text


def test_root_redirects_to_swagger_ui():
    with TestClient(app) as client:
        response = client.get("/", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "/api/docs"


def test_contract_schemas_are_published_in_camel_case():
    schemas = app.openapi()["components"]["schemas"]
    for name in ("RecipeSummary", "RecipeDetail", "RecipeCreate", "WeekPlanOut", "ShoppingListOut", "ErrorResponse"):
        assert name in schemas, name
    assert {"id", "slug", "mealTypes", "isCustom"} <= set(schemas["RecipeSummary"]["properties"])
    assert set(schemas["ErrorBody"]["properties"]) == {"code", "message", "details", "requestId"}


def test_options_are_published_as_enums_not_free_text():
    props = app.openapi()["components"]["schemas"]["OptionsOut"]["properties"]
    assert props["mealTypes"]["items"] == {"$ref": "#/components/schemas/MealType"}
    assert props["dietaryLabels"]["items"] == {"$ref": "#/components/schemas/DietaryLabel"}
    assert props["cuisines"]["items"] == {"$ref": "#/components/schemas/Cuisine"}


def test_exported_openapi_file_is_up_to_date():
    from app.export_openapi import OPENAPI_FILE, render

    assert OPENAPI_FILE.exists(), "Run: uv run python -m app.export_openapi"
    assert OPENAPI_FILE.read_text(encoding="utf-8") == render(), "openapi.json is stale. Run: uv run python -m app.export_openapi"
