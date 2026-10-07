"""Week plan API end to end on a fresh seeded database."""

import datetime as dt
from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient

from tests.api.test_recipes_api import new_recipe

MON = dt.date(2026, 10, 5)
WED = MON + dt.timedelta(days=2)


def recipe_id(client: TestClient, slug: str) -> str:
    return client.get(f"/api/recipes/{slug}").json()["id"]


def plan(client: TestClient, day: dt.date, slug: str, servings: int = 2) -> dict[str, Any]:
    response = client.post("/api/plan/entries", json={"date": day.isoformat(), "recipeId": recipe_id(client, slug), "servings": servings})
    assert response.status_code == 201, response.text
    return response.json()


def day_meals(client: TestClient, day: dt.date) -> list[str]:
    week = client.get("/api/plan", params={"week": day.isoformat()}).json()
    return [e["recipeSlug"] for d in week["days"] if d["date"] == day.isoformat() for e in d["entries"]]


def test_week_runs_monday_to_sunday_from_any_date_with_meals_in_order(client: TestClient) -> None:
    for slug in ("porridge-with-berries-and-honey", "tomato-soup", "lentil-dahl", "apple-crumble"):
        plan(client, WED, slug)  # unlimited meals a day, each goes last

    week = client.get("/api/plan", params={"week": (WED + dt.timedelta(days=3)).isoformat()}).json()  # a Saturday

    assert week["weekStart"] == MON.isoformat()
    assert [d["date"] for d in week["days"]] == [(MON + dt.timedelta(days=i)).isoformat() for i in range(7)]
    wednesday = week["days"][2]["entries"]
    assert [e["recipeSlug"] for e in wednesday] == ["porridge-with-berries-and-honey", "tomato-soup", "lentil-dahl", "apple-crumble"]
    assert [e["position"] for e in wednesday] == [0, 1, 2, 3]
    assert wednesday[2] | {"id": None} == {
        "id": None,
        "date": WED.isoformat(),
        "position": 2,
        "recipeId": recipe_id(client, "lentil-dahl"),
        "recipeSlug": "lentil-dahl",
        "recipeName": "Lentil Dahl",
        "recipeDeleted": False,
        "servings": 2,
    }


def test_cannot_plan_unknown_or_deleted_recipes_or_zero_servings(client: TestClient) -> None:
    unknown = client.post("/api/plan/entries", json={"date": WED.isoformat(), "recipeId": "00000000-0000-4000-8000-000000000000", "servings": 2})
    assert (unknown.status_code, unknown.json()["error"]["code"]) == (404, "recipe_not_found")

    client.post("/api/recipes", json=new_recipe())
    stew_id = recipe_id(client, "nans-veggie-stew")
    client.delete("/api/recipes/nans-veggie-stew", params={"today": MON.isoformat()})
    deleted = client.post("/api/plan/entries", json={"date": WED.isoformat(), "recipeId": stew_id, "servings": 2})
    assert deleted.status_code == 404

    zero = client.post("/api/plan/entries", json={"date": WED.isoformat(), "recipeId": recipe_id(client, "lentil-dahl"), "servings": 0})
    assert zero.status_code == 422 and "servings" in zero.json()["error"]["details"]["fields"]


def test_move_puts_the_meal_last_on_the_new_day(client: TestClient) -> None:
    soup = plan(client, MON, "tomato-soup")
    plan(client, MON, "lentil-dahl")
    plan(client, WED, "margherita-pizza")

    moved = client.patch(f"/api/plan/entries/{soup['id']}", json={"date": WED.isoformat()}).json()

    assert (moved["date"], moved["position"]) == (WED.isoformat(), 1)
    assert day_meals(client, MON) == ["lentil-dahl"]
    assert day_meals(client, WED) == ["margherita-pizza", "tomato-soup"]


def test_reorder_within_a_day_renumbers_positions(client: TestClient) -> None:
    a, b, c = (plan(client, WED, s) for s in ("tomato-soup", "lentil-dahl", "apple-crumble"))

    assert client.patch(f"/api/plan/entries/{c['id']}", json={"position": 0}).status_code == 200
    assert day_meals(client, WED) == ["apple-crumble", "tomato-soup", "lentil-dahl"]

    client.patch(f"/api/plan/entries/{a['id']}", json={"position": 9})  # past the end -> last
    week = client.get("/api/plan", params={"week": WED.isoformat()}).json()
    entries = week["days"][2]["entries"]
    assert [e["id"] for e in entries] == [c["id"], b["id"], a["id"]]
    assert [e["position"] for e in entries] == [0, 1, 2]


def test_swap_recipe_and_change_servings(client: TestClient) -> None:
    entry = plan(client, WED, "tomato-soup", servings=2)
    updated = client.patch(f"/api/plan/entries/{entry['id']}", json={"recipeId": recipe_id(client, "lentil-dahl"), "servings": 4})
    assert updated.status_code == 200
    assert (updated.json()["recipeSlug"], updated.json()["servings"], updated.json()["position"]) == ("lentil-dahl", 4, 0)


def test_remove_meal(client: TestClient) -> None:
    entry = plan(client, WED, "tomato-soup")
    assert client.delete(f"/api/plan/entries/{entry['id']}").status_code == 204
    assert day_meals(client, WED) == []
    gone = client.patch(f"/api/plan/entries/{entry['id']}", json={"servings": 3})
    assert (gone.status_code, gone.json()["error"]["code"]) == (404, "plan_entry_not_found")


def test_past_meals_keep_deleted_recipes(client: TestClient) -> None:
    client.post("/api/recipes", json=new_recipe())
    plan(client, MON, "nans-veggie-stew")
    client.delete("/api/recipes/nans-veggie-stew", params={"today": WED.isoformat()})  # Monday is in the past

    [entry] = client.get("/api/plan", params={"week": MON.isoformat()}).json()["days"][0]["entries"]
    assert (entry["recipeName"], entry["recipeDeleted"]) == ("Nan's Veggie Stew", True)


def test_calendar_days_with_meals(client: TestClient) -> None:
    plan(client, MON, "tomato-soup")
    plan(client, MON, "lentil-dahl")
    plan(client, dt.date(2026, 10, 31), "apple-crumble")
    plan(client, dt.date(2026, 11, 1), "apple-crumble")

    assert client.get("/api/plan/days", params={"month": "2026-10"}).json() == {"month": "2026-10", "dates": ["2026-10-05", "2026-10-31"]}
    assert client.get("/api/plan/days", params={"month": "2026-13"}).status_code == 422


def test_week_query_count_does_not_grow_with_meals(client: TestClient, count_queries: Callable) -> None:
    plan(client, MON, "tomato-soup")
    with count_queries() as few:
        client.get("/api/plan", params={"week": MON.isoformat()})
    for slug in ("lentil-dahl", "apple-crumble", "margherita-pizza", "chilli-con-carne"):
        plan(client, WED, slug)
    with count_queries() as many:
        client.get("/api/plan", params={"week": MON.isoformat()})
    assert many.count == few.count <= 2
