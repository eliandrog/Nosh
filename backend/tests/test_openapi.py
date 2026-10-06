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
