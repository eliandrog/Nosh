"""Free meals nearby end to end on a fresh seeded database (3 demo places in Brixton)."""

import datetime as dt
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.constants import PlaceMealKind, PlaceType
from app.models import Place, PlaceMeal, PlanEntry

MON = dt.date(2026, 10, 5)
WED, THU = MON + dt.timedelta(days=2), MON + dt.timedelta(days=3)
POINT = {"lat": 51.4613, "lng": -0.1149}


def nearby(client: TestClient, **params: Any) -> list[dict[str, Any]]:
    response = client.get("/api/places", params=POINT | {"today": WED.isoformat()} | params)
    assert response.status_code == 200, response.text
    return response.json()


def names(places: list[dict[str, Any]]) -> list[str]:
    return [p["name"] for p in places]


def meal_id(client: TestClient, place_name: str) -> int:
    place = next(p for p in nearby(client) if p["name"] == place_name)
    return place["meals"][0]["id"]


def add_free_meal(client: TestClient, place_name: str, day: dt.date, servings: int = 1):
    body = {"date": day.isoformat(), "placeMealId": meal_id(client, place_name), "servings": servings}
    return client.post("/api/plan/entries", json=body, params={"today": WED.isoformat()})


# ---------- nearby ----------


def test_demo_places_are_listed_nearest_first_with_distances(client: TestClient) -> None:
    places = nearby(client)
    assert names(places) == ["Sample Street Café", "Demo Community Kitchen", "Example Food Hub"]
    assert [p["distanceKm"] for p in places] == [0.03, 0.15, 0.25]
    assert {p["postcode"] for p in places} == {"SW2 1JQ", "SW2 1RW", "SW9 8PR"}
    assert all(p["isDemo"] for p in places)
    curry = places[1]["meals"][0]
    assert curry | {"id": 0} == {
        "id": 0,
        "name": "Vegetable curry with rice",
        "kind": "hot",
        "weekday": 2,
        "startTime": "12:00:00",
        "endTime": "14:00:00",
        "serves": 1,
        "servesNote": "1 per portion",
        "dietary": ["vegan", "gluten-free"],
        "openToday": True,
    }


def test_radius_limits_the_results(client: TestClient) -> None:
    assert names(nearby(client, radiusKm=0.1)) == ["Sample Street Café"]
    far_away = {"lat": 53.4808, "lng": -2.2426}  # Manchester
    assert client.get("/api/places", params=far_away).json() == []


def test_filters_for_today_kind_and_dietary(client: TestClient) -> None:
    assert names(nearby(client, openToday="true")) == ["Sample Street Café", "Demo Community Kitchen"]  # Wednesday
    assert names(nearby(client, openToday="true", today=THU.isoformat())) == ["Example Food Hub"]
    assert names(nearby(client, kind="parcel")) == ["Example Food Hub"]
    assert names(nearby(client, dietary="vegetarian")) == ["Demo Community Kitchen", "Example Food Hub"]
    assert names(nearby(client, dietary="vegan,gluten-free")) == ["Demo Community Kitchen"]


@pytest.mark.parametrize(
    ("params", "field"),
    [
        ({"lat": 100, "lng": 0}, "lat"),
        ({"lat": 51.46, "lng": -0.11, "radiusKm": 11}, "radiusKm"),
        ({"lat": 51.46, "lng": -0.11, "dietary": "pescatarian"}, "dietary"),
        ({"lat": 51.46, "lng": -0.11, "kind": "snack"}, "kind"),
        ({"lng": -0.11}, "lat"),
    ],
)
def test_invalid_search_returns_field_errors(client: TestClient, params: dict[str, Any], field: str) -> None:
    response = client.get("/api/places", params=params)
    assert response.status_code == 422
    assert field in response.json()["error"]["details"]["fields"]


def test_place_detail_and_not_found(client: TestClient) -> None:
    place_id = nearby(client)[0]["id"]
    detail = client.get(f"/api/places/{place_id}").json()
    assert detail["name"] == "Sample Street Café" and detail["distanceKm"] is None
    missing = client.get("/api/places/9999")
    assert (missing.status_code, missing.json()["error"]["code"]) == (404, "place_not_found")


# ---------- adding a free meal to the week ----------


def test_free_meal_goes_on_its_weekday_and_shows_in_the_week(client: TestClient) -> None:
    response = add_free_meal(client, "Demo Community Kitchen", WED, servings=2)
    assert response.status_code == 201, response.text
    entry = response.json()
    assert entry["kind"] == "free_meal" and entry["recipeId"] is None and entry["recipeName"] is None
    assert entry["placeMeal"]["name"] == "Vegetable curry with rice"
    assert entry["placeMeal"]["placeName"] == "Demo Community Kitchen"

    week = client.get("/api/plan", params={"week": WED.isoformat()}).json()
    wednesday = next(d for d in week["days"] if d["date"] == WED.isoformat())
    assert [e["placeMeal"]["placeName"] for e in wednesday["entries"]] == ["Demo Community Kitchen"]


def test_free_meal_on_the_wrong_weekday_is_rejected(client: TestClient) -> None:
    response = add_free_meal(client, "Demo Community Kitchen", THU)
    assert response.status_code == 422
    assert response.json()["error"]["details"]["fields"] == {"date": "Pick a day this meal is served: Wednesdays."}

    entry = add_free_meal(client, "Demo Community Kitchen", WED).json()
    moved = client.patch(f"/api/plan/entries/{entry['id']}", json={"date": THU.isoformat()})
    assert moved.status_code == 422


def test_entry_needs_exactly_one_of_recipe_or_free_meal(client: TestClient) -> None:
    lentil = client.get("/api/recipes/lentil-dahl").json()["id"]
    both = {"date": WED.isoformat(), "recipeId": lentil, "placeMealId": meal_id(client, "Example Food Hub"), "servings": 1}
    neither = {"date": WED.isoformat(), "servings": 1}
    for body in (both, neither):
        assert client.post("/api/plan/entries", json=body).status_code == 422
    unknown = client.post("/api/plan/entries", json={"date": WED.isoformat(), "placeMealId": 9999, "servings": 1})
    assert (unknown.status_code, unknown.json()["error"]["code"]) == (404, "place_meal_not_found")


def test_shopping_list_ignores_free_meals(client: TestClient) -> None:
    lentil = client.get("/api/recipes/lentil-dahl").json()["id"]
    client.post("/api/plan/entries", json={"date": WED.isoformat(), "recipeId": lentil, "servings": 4}, params={"today": WED.isoformat()})
    before = client.get("/api/shopping-list", params={"week": WED.isoformat(), "today": WED.isoformat()}).json()["items"]

    assert add_free_meal(client, "Demo Community Kitchen", WED).status_code == 201
    after = client.get("/api/shopping-list", params={"week": WED.isoformat(), "today": WED.isoformat()}).json()["items"]
    assert [(i["name"], i["quantity"]) for i in after] == [(i["name"], i["quantity"]) for i in before]
    assert all("Vegetable curry with rice" not in i["usedIn"] for i in after)


def test_swapping_a_free_meal_for_a_recipe_turns_it_into_a_recipe_meal(client: TestClient) -> None:
    entry = add_free_meal(client, "Demo Community Kitchen", WED).json()
    lentil = client.get("/api/recipes/lentil-dahl").json()["id"]
    swapped = client.patch(f"/api/plan/entries/{entry['id']}", json={"recipeId": lentil}).json()
    assert (swapped["kind"], swapped["recipeSlug"], swapped["placeMeal"]) == ("recipe", "lentil-dahl", None)


# ---------- database rules ----------


def test_database_rejects_invalid_places_meals_and_entries(session: Session) -> None:
    session.add(Place(name="Bad", type=PlaceType.CAFE, postcode="X", latitude=91, longitude=0))
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()

    place = Place(name="Ok", type=PlaceType.CAFE, postcode="X", latitude=51, longitude=0)
    session.add(place)
    session.commit()
    for bad in (
        {"weekday": 7, "start_time": dt.time(12), "end_time": dt.time(13), "serves": 1},
        {"weekday": 1, "start_time": dt.time(14), "end_time": dt.time(13), "serves": 1},
        {"weekday": 1, "start_time": dt.time(12), "end_time": dt.time(13), "serves": 0},
    ):
        session.add(PlaceMeal(place_id=place.id, name="Meal", kind=PlaceMealKind.HOT, **bad))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

    session.add(PlanEntry(date=WED, position=0, servings=1))  # neither recipe nor free meal
    with pytest.raises(IntegrityError):
        session.commit()


def test_nearby_query_count_does_not_grow_with_places(
    client: TestClient, session: Session, count_queries: Callable
) -> None:
    with count_queries() as before:
        assert len(nearby(client)) == 3
    for i in range(5):
        place = Place(name=f"Extra {i}", type=PlaceType.CAFE, postcode="SW2", latitude=51.4614, longitude=-0.1148)
        place.meals = [
            PlaceMeal(name="Soup", kind=PlaceMealKind.HOT, weekday=2, start_time=dt.time(12), end_time=dt.time(13), serves=1)
        ]
        session.add(place)
    session.commit()
    with count_queries() as after:
        assert len(nearby(client)) == 8
    assert after.count == before.count
