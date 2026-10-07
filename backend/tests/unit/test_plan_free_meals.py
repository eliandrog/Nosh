"""Plan rules for free meals, isolated from the database (repositories mocked, typed models)."""

import datetime as dt
import uuid
from unittest.mock import MagicMock

import pytest
from pydantic import ValidationError

from app.constants import PlaceMealKind, PlaceType
from app.core.errors import ValidationFailed
from app.models import Place, PlaceMeal
from app.repositories import plan as plan_repo_module
from app.schemas import PlanEntryCreate
from app.services import places as place_service_module
from app.services import plan as service

WEDNESDAY = dt.date(2026, 10, 7)


def curry() -> PlaceMeal:
    meal = PlaceMeal(
        id=1, place_id=1, name="Vegetable curry with rice", kind=PlaceMealKind.HOT, weekday=2,
        start_time=dt.time(12), end_time=dt.time(14), serves=1,
    )
    meal.place = Place(id=1, name="Demo Community Kitchen", type=PlaceType.COMMUNITY_KITCHEN, postcode="SW2 1RW", latitude=51.46, longitude=-0.11)
    return meal


@pytest.fixture
def mocks(monkeypatch: pytest.MonkeyPatch):
    places = MagicMock(spec=place_service_module)
    places.get_meal.return_value = curry()
    plan_repo = MagicMock(spec=plan_repo_module)
    plan_repo.next_position.return_value = 0
    def _add(_session, entry):
        entry.id = 1  # what the database would assign on flush
        return entry

    plan_repo.add.side_effect = _add
    monkeypatch.setattr(service, "place_service", places)
    monkeypatch.setattr(service, "plan_repo", plan_repo)
    monkeypatch.setattr(service, "shopping_service", MagicMock())
    return places, plan_repo


def test_free_meal_on_its_weekday_is_added_as_a_free_meal(mocks) -> None:
    session = MagicMock()
    out = service.add_entry(session, PlanEntryCreate(date=WEDNESDAY, place_meal_id=1, servings=2), WEDNESDAY)
    assert (out.kind, out.recipe_id, out.place_meal.place_name) == ("free_meal", None, "Demo Community Kitchen")
    session.commit.assert_called_once()


def test_free_meal_on_another_weekday_is_rejected_before_saving(mocks) -> None:
    _, plan_repo = mocks
    session = MagicMock()
    with pytest.raises(ValidationFailed) as exc:
        service.add_entry(session, PlanEntryCreate(date=WEDNESDAY + dt.timedelta(days=1), place_meal_id=1, servings=1), WEDNESDAY)
    assert exc.value.details == {"fields": {"date": "Pick a day this meal is served: Wednesdays."}}
    plan_repo.add.assert_not_called()
    session.commit.assert_not_called()


@pytest.mark.parametrize("ids", [{}, {"recipe_id": uuid.uuid4(), "place_meal_id": 1}])
def test_entry_needs_exactly_one_source(ids: dict) -> None:
    with pytest.raises(ValidationError):
        PlanEntryCreate(date=WEDNESDAY, servings=1, **ids)
