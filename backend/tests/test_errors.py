"""Every failure returns the same error object, with a request id and no internals."""

import logging

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.errors import ConflictError, NotFoundError, ValidationFailed
from app.main import create_app


class Body(BaseModel):
    name: str
    serves: int


@pytest.fixture
def client():
    app = create_app()

    @app.get("/api/_test/not-found")
    def not_found():
        raise NotFoundError("We couldn't find that recipe.", code="recipe_not_found")

    @app.get("/api/_test/conflict")
    def conflict():
        raise ConflictError("There's already a recipe called Lentil Dahl.", code="recipe_name_taken")

    @app.get("/api/_test/rule")
    def rule():
        raise ValidationFailed("Unknown unit.", fields={"ingredients.0.unit": "Pick a unit from the list."})

    @app.post("/api/_test/body")
    def body(_: Body):
        return {}

    @app.get("/api/_test/crash")
    def crash():
        raise RuntimeError("SELECT * FROM secret_table -- internal detail")

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def _error(response):
    body = response.json()
    assert set(body) == {"error"}
    err = body["error"]
    assert err["requestId"] == response.headers["X-Request-ID"]
    return err


def test_not_found_domain_error(client):
    r = client.get("/api/_test/not-found")
    assert r.status_code == 404
    err = _error(r)
    assert (err["code"], err["message"]) == ("recipe_not_found", "We couldn't find that recipe.")


def test_conflict_domain_error(client):
    r = client.get("/api/_test/conflict")
    assert r.status_code == 409 and _error(r)["code"] == "recipe_name_taken"


def test_business_validation_error_has_fields(client):
    r = client.get("/api/_test/rule")
    assert r.status_code == 422
    assert _error(r)["details"] == {"fields": {"ingredients.0.unit": "Pick a unit from the list."}}


def test_request_validation_error_uses_same_shape(client):
    r = client.post("/api/_test/body", json={"serves": "lots"})
    assert r.status_code == 422
    err = _error(r)
    assert err["code"] == "validation_error"
    assert set(err["details"]["fields"]) == {"name", "serves"}


def test_unknown_route_uses_same_shape(client):
    r = client.get("/api/does-not-exist")
    assert r.status_code == 404 and _error(r)["code"] == "not_found"


def test_unexpected_error_hides_internals_but_logs_them(client, caplog):
    with caplog.at_level(logging.ERROR, logger="app.errors"):
        r = client.get("/api/_test/crash")
    assert r.status_code == 500
    err = _error(r)
    assert err["code"] == "internal_error"
    assert "secret_table" not in r.text and "RuntimeError" not in r.text and "Traceback" not in r.text
    logged = "\n".join(rec.getMessage() + (rec.exc_text or "") for rec in caplog.records)
    assert "RuntimeError" in logged


def test_request_id_is_reused_when_safe_and_replaced_when_not(client):
    assert client.get("/api/health", headers={"X-Request-ID": "abc-123"}).headers["X-Request-ID"] == "abc-123"
    replaced = client.get("/api/health", headers={"X-Request-ID": "bad id\n<script>"}).headers["X-Request-ID"]
    assert replaced != "bad id\n<script>" and len(replaced) == 12


def test_every_request_gets_an_access_log_line_with_request_id(client, caplog):
    with caplog.at_level(logging.INFO, logger="app.access"):
        r = client.get("/api/health")
    line = next(rec for rec in caplog.records if rec.name == "app.access")
    assert "GET /api/health 200" in line.getMessage()
    assert line.request_id == r.headers["X-Request-ID"]
