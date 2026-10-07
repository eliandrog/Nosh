"""Shopping list end to end: plan changes rebuild the week's list (acceptance tests in TECHNICAL.md)."""

import datetime as dt
from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient

from tests.api.test_recipes_api import new_recipe

MON = dt.date(2026, 10, 5)
WED = MON + dt.timedelta(days=2)
NEXT_WEEK = MON + dt.timedelta(days=7)
TODAY = {"today": WED.isoformat()}


def recipe_id(client: TestClient, slug: str) -> str:
    return client.get(f"/api/recipes/{slug}").json()["id"]


def plan(client: TestClient, slug: str, servings: int = 4, day: dt.date = WED, today: dict[str, str] = TODAY) -> int:
    body = {"date": day.isoformat(), "recipeId": recipe_id(client, slug), "servings": servings}
    response = client.post("/api/plan/entries", json=body, params=today)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def change(client: TestClient, entry_id: int, today: dict[str, str] = TODAY, **patch: Any) -> None:
    response = client.patch(f"/api/plan/entries/{entry_id}", json=patch, params=today)
    assert response.status_code == 200, response.text


def shopping(client: TestClient, week: dt.date = WED, today: dict[str, str] = TODAY) -> dict[str, Any]:
    response = client.get("/api/shopping-list", params={"week": week.isoformat(), **today})
    assert response.status_code == 200, response.text
    return response.json()


def lines(client: TestClient, week: dt.date = WED) -> dict[tuple[str, str], tuple[float | None, bool]]:
    return {(i["name"], i["unit"]): (i["quantity"], i["toTaste"]) for i in shopping(client, week)["items"]}


def item(client: TestClient, name: str, unit: str) -> dict[str, Any]:
    return next(i for i in shopping(client)["items"] if (i["name"], i["unit"]) == (name, unit))


def tick(client: TestClient, name: str, unit: str) -> None:
    assert client.patch(f"/api/shopping-list/items/{item(client, name, unit)['id']}", json={"ticked": True}).status_code == 200


def test_adding_meals_scales_converts_and_sums(client: TestClient) -> None:
    plan(client, "lentil-dahl", servings=2)
    plan(client, "tomato-soup")

    got = lines(client)
    assert got[("red lentils", "g")] == (125, False)  # 250 g for 4, planned for 2
    assert got[("onion", "item")] == (2, False)  # ½ (rounded once after adding) + 1
    assert got[("chopped tomatoes", "tin")] == (3, False)  # ½ + 2, rounded up to whole tins
    assert got[("curry powder", "ml")] == (15, False)  # 2 tbsp for 4 → 1 tbsp → 15 ml
    assert got[("salt and pepper", "item")] == (None, True)
    onion = item(client, "onion", "item")
    assert onion["usedIn"] == ["Lentil Dahl", "Tomato Soup"]


def test_swapping_a_meal_replaces_its_ingredients(client: TestClient) -> None:
    dahl = plan(client, "lentil-dahl")
    plan(client, "scrambled-eggs-on-toast", servings=2)

    change(client, dahl, recipeId=recipe_id(client, "tomato-soup"))

    got = lines(client)
    assert ("red lentils", "g") not in got and ("vegetable stock", "ml") in got
    assert got[("onion", "item")] == (1, False)  # re-totalled from the soup only
    assert got[("salt and pepper", "item")] == (None, True)  # still to taste from both meals


def test_removing_a_meal_removes_its_lines_and_reduces_shared_ones(client: TestClient) -> None:
    plan(client, "lentil-dahl")
    soup = plan(client, "tomato-soup")
    assert client.delete(f"/api/plan/entries/{soup}", params=TODAY).status_code == 204

    got = lines(client)
    assert ("vegetable stock", "ml") not in got
    assert got[("chopped tomatoes", "tin")] == (1, False)


def test_tick_rules_when_amounts_change(client: TestClient) -> None:
    dahl = plan(client, "lentil-dahl")
    tick(client, "onion", "item")
    tick(client, "red lentils", "g")

    plan(client, "tomato-soup")  # onion goes up, lentils unchanged
    assert item(client, "onion", "item")["ticked"] is False  # buy the extra
    assert item(client, "red lentils", "g")["ticked"] is True

    change(client, dahl, servings=2)  # lentils go down
    lentils = item(client, "red lentils", "g")
    assert (lentils["quantity"], lentils["ticked"]) == (125, True)  # less needed: keep the tick


def test_moving_a_meal_to_another_week_updates_both_lists(client: TestClient) -> None:
    dahl = plan(client, "lentil-dahl")
    change(client, dahl, date=NEXT_WEEK.isoformat())

    assert shopping(client, WED)["items"] == []
    assert ("red lentils", "g") in lines(client, NEXT_WEEK)


def test_past_weeks_keep_what_was_shopped_for(client: TestClient) -> None:
    dahl = plan(client, "lentil-dahl")
    later = {"today": NEXT_WEEK.isoformat()}  # this week is now in the past

    change(client, dahl, today=later, servings=2)

    past = {(i["name"], i["unit"]): i["quantity"] for i in shopping(client, WED, today=later)["items"]}
    assert past[("red lentils", "g")] == 250  # not rebuilt
    assert [i["usedIn"] for i in shopping(client, WED, today=later)["items"] if i["name"] == "red lentils"] == [["Lentil Dahl"]]


def test_list_updated_banner_counts_changes_until_dismissed(client: TestClient) -> None:
    plan(client, "lentil-dahl")
    assert shopping(client)["changes"] is None  # first build: no banner

    plan(client, "tomato-soup")
    changes = shopping(client)["changes"]
    assert changes["added"] == 3 and changes["changed"] == 3  # stock, oil, salt new; onion, garlic, tomatoes up

    assert client.post("/api/shopping-list/changes/dismiss", params={"week": WED.isoformat()}).status_code == 204
    assert shopping(client)["changes"] is None


def test_clear_ticked_unticks_the_whole_week(client: TestClient) -> None:
    plan(client, "lentil-dahl")
    tick(client, "onion", "item")
    tick(client, "garlic", "clove")

    assert client.delete("/api/shopping-list/ticks", params={"week": WED.isoformat()}).status_code == 204
    assert not any(i["ticked"] for i in shopping(client)["items"])


def test_editing_a_planned_recipe_rebuilds_the_list(client: TestClient) -> None:
    client.post("/api/recipes", json=new_recipe())
    plan(client, "nans-veggie-stew")
    tick(client, "carrot", "g")

    bigger = new_recipe(ingredients=[{"item": "Carrots", "quantity": 800, "unit": "g"}])
    assert client.put("/api/recipes/nans-veggie-stew", json=bigger, params=TODAY).status_code == 200

    carrot = item(client, "carrot", "g")
    assert (carrot["quantity"], carrot["ticked"]) == (800, False)
    assert ("onion", "item") not in lines(client)


def test_unknown_item_returns_error_object(client: TestClient) -> None:
    response = client.patch("/api/shopping-list/items/999999", json={"ticked": True})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "shopping_item_not_found"


def test_reading_the_list_uses_a_fixed_number_of_queries(client: TestClient, count_queries: Callable) -> None:
    plan(client, "lentil-dahl")
    shopping(client)
    with count_queries() as before:
        shopping(client)
    for slug in ("tomato-soup", "scrambled-eggs-on-toast", "spaghetti-bolognese"):
        plan(client, slug)
    shopping(client)
    with count_queries() as after:
        shopping(client)
    assert after.count == before.count
