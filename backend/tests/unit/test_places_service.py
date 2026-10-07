"""Places service rules with the repository mocked and real, typed model objects (no database)."""

import datetime as dt
from unittest.mock import MagicMock

import pytest

from app.constants import DietaryLabel, PlaceMealKind, PlaceType
from app.models import Place, PlaceMeal, PlaceMealDietary
from app.repositories import places as place_repo_module
from app.services import places as service

POINT = (51.4613, -0.1149)
WEDNESDAY = dt.date(2026, 10, 7)
THURSDAY = dt.date(2026, 10, 8)


def make_place(
    place_id: int, name: str, lat: float, lng: float, *meals: tuple[str, PlaceMealKind, int, tuple[DietaryLabel, ...]]
) -> Place:
    place = Place(id=place_id, name=name, type=PlaceType.CAFE, postcode="SW2 1JQ", latitude=lat, longitude=lng, is_demo=True)
    place.meals = [
        PlaceMeal(
            id=place_id * 10 + i,
            place_id=place_id,
            name=meal_name,
            kind=kind,
            weekday=weekday,
            start_time=dt.time(12),
            end_time=dt.time(14),
            serves=1,
            dietary=[PlaceMealDietary(label=d) for d in dietary],
        )
        for i, (meal_name, kind, weekday, dietary) in enumerate(meals)
    ]
    return place


KITCHEN = make_place(1, "Kitchen", 51.460662, -0.116872, ("Curry", PlaceMealKind.HOT, 2, (DietaryLabel.VEGAN,)))
CAFE = make_place(2, "Café", 51.461104, -0.114723, ("Pie", PlaceMealKind.HOT, 2, ()))
HUB = make_place(3, "Hub", 51.462606, -0.111969, ("Parcel", PlaceMealKind.PARCEL, 3, (DietaryLabel.VEGETARIAN,)))
FAR = make_place(4, "Far", 51.47, -0.13, ("Soup", PlaceMealKind.HOT, 2, ()))  # inside a 2 km box, ~1.4 km away


@pytest.fixture
def repo(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    mock = MagicMock(spec=place_repo_module)
    mock.in_box.return_value = [HUB, FAR, KITCHEN, CAFE]
    monkeypatch.setattr(service, "place_repo", mock)
    return mock


def names(results) -> list[str]:
    return [p.name for p in results]


def nearby(repo: MagicMock, **filters) -> list:
    return service.find_nearby(MagicMock(), lat=POINT[0], lng=POINT[1], today=WEDNESDAY, **({"radius_km": 2} | filters))


def test_sorted_nearest_first_with_rounded_distances(repo: MagicMock) -> None:
    results = nearby(repo)
    assert names(results) == ["Café", "Kitchen", "Hub", "Far"]
    assert [p.distance_km for p in results][:3] == [0.03, 0.15, 0.25]


def test_places_inside_the_box_but_outside_the_circle_are_dropped(repo: MagicMock) -> None:
    assert "Far" not in names(nearby(repo, radius_km=1))


def test_open_today_uses_the_weekday(repo: MagicMock) -> None:
    assert names(nearby(repo, open_today=True)) == ["Café", "Kitchen", "Far"]  # Wednesday meals
    results = service.find_nearby(MagicMock(), lat=POINT[0], lng=POINT[1], radius_km=2, today=THURSDAY, open_today=True)
    assert names(results) == ["Hub"]
    assert results[0].meals[0].open_today is True


def test_kind_and_dietary_filter_meals_and_vegetarian_accepts_vegan(repo: MagicMock) -> None:
    assert names(nearby(repo, kind=PlaceMealKind.PARCEL)) == ["Hub"]
    assert names(nearby(repo, dietary=[DietaryLabel.VEGETARIAN])) == ["Kitchen", "Hub"]
    assert names(nearby(repo, dietary=[DietaryLabel.VEGAN])) == ["Kitchen"]


def test_box_is_passed_to_the_repository(repo: MagicMock) -> None:
    nearby(repo)
    box = repo.in_box.call_args.kwargs
    assert box["min_lat"] < POINT[0] < box["max_lat"] and box["min_lng"] < POINT[1] < box["max_lng"]


def test_get_place_not_found(repo: MagicMock) -> None:
    repo.get.return_value = None
    with pytest.raises(service.PlaceNotFound) as exc:
        service.get_place(MagicMock(), 99, WEDNESDAY)
    assert exc.value.status_code == 404
