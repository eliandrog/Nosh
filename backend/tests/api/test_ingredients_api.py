"""Ingredient dropdown end to end: add new or reuse existing, and recipes that reference ingredients by id."""

from typing import Any

from fastapi.testclient import TestClient

from tests.api.test_recipes_api import error, new_recipe


def suggestion_id(client: TestClient, name: str) -> int:
    return next(s["id"] for s in client.get("/api/ingredients", params={"q": name}).json() if s["name"] == name)


def test_adding_a_new_ingredient_makes_it_suggestable(client: TestClient) -> None:
    created = client.post("/api/ingredients", json={"name": " Pak  Choi "})
    assert created.status_code == 201
    body = created.json()
    assert (body["name"], body["created"]) == ("Pak Choi", True)
    assert suggestion_id(client, "Pak Choi") == body["id"]


def test_adding_a_variant_of_an_existing_ingredient_returns_the_existing_one(client: TestClient) -> None:
    onion_id = suggestion_id(client, "onion")
    again = client.post("/api/ingredients", json={"name": "ONIONS"})
    assert again.status_code == 200
    assert again.json() == {"id": onion_id, "name": "onion", "created": False}


def test_invalid_ingredient_names_use_the_error_object(client: TestClient) -> None:
    assert error(client.post("/api/ingredients", json={"name": "!!!"}), 422)["details"]["fields"] == {
        "name": "Use at least one letter or number."
    }
    assert "name" in error(client.post("/api/ingredients", json={"name": ""}), 422)["details"]["fields"]


def test_recipe_lines_can_reference_ingredients_by_id_or_name(client: TestClient) -> None:
    onion_id = suggestion_id(client, "onion")
    lines: list[dict[str, Any]] = [
        {"ingredientId": onion_id, "quantity": 1, "unit": None},  # picked from the dropdown
        {"item": "Carrots", "quantity": 400, "unit": "g"},  # typed name (still supported), merged by key
    ]
    response = client.post("/api/recipes", json=new_recipe(ingredients=lines))
    assert response.status_code == 201, response.text
    ingredients = response.json()["ingredients"]
    assert (ingredients[0]["ingredientId"], ingredients[0]["item"]) == (onion_id, "onion")
    assert ingredients[1]["item"] == "carrot"


def test_unknown_or_missing_ingredient_is_a_field_error(client: TestClient) -> None:
    lines = [{"ingredientId": 999999, "quantity": 1, "unit": None}, {"item": "  ", "quantity": 1, "unit": None}]
    fields = error(client.post("/api/recipes", json=new_recipe(ingredients=lines)), 422)["details"]["fields"]
    assert fields == {"ingredients.1.item": "Pick an ingredient or add a new one."}  # checked before the database

    only_unknown = [{"ingredientId": 999999, "quantity": 1, "unit": None}]
    fields = error(client.post("/api/recipes", json=new_recipe(ingredients=only_unknown)), 422)["details"]["fields"]
    assert fields == {"ingredients.0.ingredientId": "That ingredient no longer exists. Pick another."}
