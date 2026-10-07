"""Recipes API end to end: HTTP -> router -> service -> repository -> seeded SQLite."""

import datetime as dt
from typing import Any

from fastapi.testclient import TestClient
from httpx2 import Response
from sqlmodel import Session, select

from app.models import PlanEntry, Recipe

TODAY = dt.date(2026, 10, 7)


def slugs(response: Response) -> list[str]:
    assert response.status_code == 200, response.text
    return [r["slug"] for r in response.json()["items"]]


def error(response: Response, status: int) -> dict[str, Any]:
    assert response.status_code == status, response.text
    return response.json()["error"]


def new_recipe(**overrides: Any) -> dict[str, Any]:
    return {
        "name": "Nan's Veggie Stew",
        "cuisine": "british",
        "serves": 4,
        "mealTypes": ["dinner"],
        "dietary": ["vegetarian", "vegan"],
        "tags": ["Low cost", "batch cook"],
        "ingredients": [
            {"item": "Carrots", "quantity": 400, "unit": "g", "prep": "sliced"},
            {"item": "Onions", "quantity": 1, "unit": None},
            {"item": "chopped tomatoes", "quantity": 1, "unit": "tin"},
        ],
        "method": ["Fry the carrots and onion.", "Add the tomatoes and simmer for 25 minutes."],
    } | overrides


# ---------- list & filters ----------


def test_list_uses_saved_preferences_unless_all(client: TestClient) -> None:
    assert len(slugs(client.get("/api/recipes"))) == 20  # no preferences saved yet

    client.put("/api/preferences", json={"dietary": ["vegetarian"]})
    vegetarian = slugs(client.get("/api/recipes"))
    assert len(vegetarian) == 10 and "spaghetti-bolognese" not in vegetarian

    assert len(slugs(client.get("/api/recipes", params={"all": "true"}))) == 20


def test_filters_combine_dietary_and_any_meal_type_or_tag(client: TestClient) -> None:
    both = slugs(client.get("/api/recipes", params={"dietary": "vegetarian,gluten-free", "mealType": "dinner"}))
    assert set(both) == {"jacket-potato-with-cheese-and-beans", "halloumi-and-roasted-vegetable-salad", "lentil-dahl"}

    quick_or_freezer = slugs(client.get("/api/recipes", params={"all": "true", "tag": "quick,freezer-friendly"}))
    assert {"porridge-with-berries-and-honey", "chilli-con-carne"} <= set(quick_or_freezer)


def test_search_matches_names_and_ingredients(client: TestClient) -> None:
    assert slugs(client.get("/api/recipes", params={"q": "DAHL", "all": "true"})) == ["lentil-dahl"]
    by_ingredient = slugs(client.get("/api/recipes", params={"q": "coconut", "all": "true"}))
    assert set(by_ingredient) == {"lentil-dahl", "thai-green-curry"}


def test_recipes_matching_several_values_are_listed_once(client: TestClient) -> None:
    # Regression: SQLite 3.51.0 returned vegan+vegetarian recipes twice with correlated EXISTS ... IN (...).
    for params in ({"dietary": "vegetarian"}, {"all": "true", "mealType": "lunch,dinner"}, {"all": "true", "q": "o"}):
        listed = slugs(client.get("/api/recipes", params=params))
        assert len(listed) == len(set(listed)), params


def test_unknown_filter_value_returns_field_error(client: TestClient) -> None:
    err = error(client.get("/api/recipes", params={"dietary": "pescatarian"}), 422)
    assert err["code"] == "validation_error" and "dietary" in err["details"]["fields"]


# ---------- detail ----------


def test_detail_scales_to_servings(client: TestClient) -> None:
    body = client.get("/api/recipes/lentil-dahl", params={"servings": 2}).json()
    amounts = {i["item"]: (i["quantity"], i["unit"]) for i in body["ingredients"]}
    assert body["servings"] == 2 and body["serves"] == 4
    assert amounts["red lentils"] == (125, "g")
    assert amounts["onion"] == (1, None)  # ½ onion rounds up to a whole one
    assert amounts["chopped tomatoes"] == (0.5, "tin")
    assert body["method"][0].startswith("Soften the onion")


def test_unknown_recipe_returns_error_object(client: TestClient) -> None:
    err = error(client.get("/api/recipes/no-such-recipe"), 404)
    assert err["code"] == "recipe_not_found" and err["requestId"]


# ---------- create ----------


def test_create_recipe_reuses_ingredients_and_creates_tags(client: TestClient) -> None:
    def ingredient_id(slug: str, item: str) -> int:
        return next(i["ingredientId"] for i in client.get(f"/api/recipes/{slug}").json()["ingredients"] if i["item"] == item)

    onion_id, carrot_id = ingredient_id("lentil-dahl", "onion"), ingredient_id("spaghetti-bolognese", "carrot")

    response = client.post("/api/recipes", json=new_recipe())
    assert response.status_code == 201, response.text
    body = response.json()

    assert body["slug"] == "nans-veggie-stew" and body["isCustom"] is True
    lines = {i["item"]: i for i in body["ingredients"]}
    # "Onions"/"Carrots" merge into the existing ingredients and keep their first-seen spelling.
    assert lines["onion"]["ingredientId"] == onion_id
    assert (lines["carrot"]["ingredientId"], lines["carrot"]["prep"]) == (carrot_id, "sliced")
    assert {t["key"] for t in body["tags"]} == {"low-cost", "batch-cook"}  # new tag + existing built-in
    assert "low-cost" in {t["key"] for t in client.get("/api/tags").json()}
    assert "nans-veggie-stew" in slugs(client.get("/api/recipes", params={"tag": "low-cost"}))


def test_duplicate_names_are_rejected_including_builtins(client: TestClient) -> None:
    assert client.post("/api/recipes", json=new_recipe()).status_code == 201
    for name in ("  NANS veggie STEW ", "lentil dahl"):
        err = error(client.post("/api/recipes", json=new_recipe(name=name)), 409)
        assert err["code"] == "recipe_name_taken" and "name" in err["details"]["fields"]


def test_invalid_recipes_report_field_errors(client: TestClient) -> None:
    shape = error(client.post("/api/recipes", json=new_recipe(mealTypes=[], serves=0)), 422)
    assert {"mealTypes", "serves"} <= set(shape["details"]["fields"])

    rule = error(client.post("/api/recipes", json=new_recipe(ingredients=[{"item": "milk", "quantity": 1, "unit": "cup"}])), 422)
    assert rule["details"]["fields"] == {"ingredients.0.unit": "Pick a unit from the list."}


# ---------- update ----------


def test_rename_keeps_id_changes_slug_and_replaces_ingredients(client: TestClient) -> None:
    created = client.post("/api/recipes", json=new_recipe()).json()
    changes = new_recipe(name="Nan's Winter Stew", ingredients=[{"item": "parsnips", "quantity": 2, "unit": None}])

    updated = client.put("/api/recipes/nans-veggie-stew", json=changes)
    assert updated.status_code == 200, updated.text
    body = updated.json()

    assert (body["id"], body["slug"]) == (created["id"], "nans-winter-stew")
    assert [i["item"] for i in body["ingredients"]] == ["parsnips"]
    assert client.get("/api/recipes/nans-veggie-stew").status_code == 404


def test_builtin_recipes_are_read_only(client: TestClient) -> None:
    assert error(client.put("/api/recipes/lentil-dahl", json=new_recipe(name="Lentil Dahl")), 403)["code"] == "recipe_read_only"
    assert error(client.delete("/api/recipes/lentil-dahl"), 403)["code"] == "recipe_read_only"


# ---------- delete ----------


def test_delete_removes_upcoming_meals_keeps_history_and_frees_the_name(client: TestClient, session: Session) -> None:
    client.post("/api/recipes", json=new_recipe())
    recipe = session.exec(select(Recipe).where(Recipe.slug == "nans-veggie-stew")).one()
    for i, day in enumerate((TODAY - dt.timedelta(days=1), TODAY, TODAY + dt.timedelta(days=2))):
        session.add(PlanEntry(date=day, position=i, recipe_id=recipe.id, servings=2))
    session.commit()
    params = {"today": TODAY.isoformat()}

    assert client.get("/api/recipes/nans-veggie-stew/usage", params=params).json() == {"upcomingMeals": 2}
    assert client.delete("/api/recipes/nans-veggie-stew", params=params).status_code == 204

    session.expire_all()
    remaining = session.exec(select(PlanEntry).where(PlanEntry.recipe_id == recipe.id)).all()
    assert [e.date for e in remaining] == [TODAY - dt.timedelta(days=1)]  # past meal kept as history
    assert client.get("/api/recipes/nans-veggie-stew").status_code == 404
    assert "nans-veggie-stew" not in slugs(client.get("/api/recipes", params={"all": "true"}))
    assert client.post("/api/recipes", json=new_recipe()).json()["slug"] == "nans-veggie-stew-2"


# ---------- pagination ----------


def page(client: TestClient, **params: Any) -> dict[str, Any]:
    response = client.get("/api/recipes", params={"all": "true", "pageSize": 5} | params)
    assert response.status_code == 200, response.text
    return response.json()


def test_pages_split_results_in_stable_name_order(client: TestClient) -> None:
    pages = [page(client, page=n) for n in (1, 2, 3, 4)]
    assert [len(p["items"]) for p in pages] == [5, 5, 5, 5]
    assert {(p["total"], p["totalPages"], p["pageSize"]) for p in pages} == {(20, 4, 5)}

    names = [r["name"] for p in pages for r in p["items"]]
    assert len(set(names)) == 20  # no recipe repeated or skipped across pages
    assert names == sorted(names, key=str.lower)


def test_totals_follow_filters_and_search(client: TestClient) -> None:
    vegetarian = page(client, dietary="vegetarian")
    assert (vegetarian["total"], vegetarian["totalPages"], len(vegetarian["items"])) == (10, 2, 5)
    assert len(page(client, dietary="vegetarian", page=2)["items"]) == 5

    searched = page(client, q="soup")
    assert (searched["total"], searched["totalPages"], [r["slug"] for r in searched["items"]]) == (1, 1, ["tomato-soup"])


def test_page_past_the_end_is_empty_with_correct_totals(client: TestClient) -> None:
    beyond = page(client, page=9)
    assert (beyond["items"], beyond["total"], beyond["page"], beyond["totalPages"]) == ([], 20, 9, 4)


def test_paging_parameters_are_validated(client: TestClient) -> None:
    for params in ({"page": 0}, {"pageSize": 0}, {"pageSize": 51}):
        err = error(client.get("/api/recipes", params=params), 422)
        assert set(err["details"]["fields"]) == set(params)
