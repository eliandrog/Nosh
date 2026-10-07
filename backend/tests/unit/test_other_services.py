"""Reference and settings services with mocked repositories."""

from unittest.mock import MagicMock

import pytest

from app.constants import DietaryLabel
from app.models import Ingredient, Profile
from app.repositories import ingredients as ingredient_repo_module
from app.repositories import settings as settings_repo_module
from app.schemas import PreferencesIn, ProfileIn
from app.services import reference, settings


@pytest.fixture
def session() -> MagicMock:
    return MagicMock(name="session")


def test_units_include_counted_items_as_null_key() -> None:
    units = reference.units()
    assert len(units) == 14
    assert next(u for u in units if u.key is None).label == "item"


def test_blank_ingredient_search_skips_the_database(monkeypatch: pytest.MonkeyPatch, session: MagicMock) -> None:
    repo = MagicMock(spec=ingredient_repo_module)
    monkeypatch.setattr(reference, "ingredient_repo", repo)
    assert reference.suggest_ingredients(session, "   ") == []
    repo.search.assert_not_called()


def test_ingredient_search_maps_results(monkeypatch: pytest.MonkeyPatch, session: MagicMock) -> None:
    repo = MagicMock(spec=ingredient_repo_module)
    repo.search.return_value = [Ingredient(id=7, name="onion", name_key="onion")]
    monkeypatch.setattr(reference, "ingredient_repo", repo)
    result = reference.suggest_ingredients(session, "oni", limit=5)
    repo.search.assert_called_once_with(session, "oni", limit=5)
    assert [(s.id, s.name) for s in result] == [(7, "onion")]


def test_update_preferences_saves_and_commits(monkeypatch: pytest.MonkeyPatch, session: MagicMock) -> None:
    repo = MagicMock(spec=settings_repo_module)
    repo.get_dietary.return_value = [DietaryLabel.VEGAN]
    monkeypatch.setattr(settings, "settings_repo", repo)

    out = settings.update_preferences(session, PreferencesIn(dietary=[DietaryLabel.VEGAN]))

    repo.set_dietary.assert_called_once_with(session, [DietaryLabel.VEGAN])
    session.commit.assert_called_once()
    assert out.dietary == [DietaryLabel.VEGAN]


def test_update_profile_turns_blank_text_into_none(monkeypatch: pytest.MonkeyPatch, session: MagicMock) -> None:
    profile = Profile(id=1, name="Old", email="old@example.com", household_size=2)
    repo = MagicMock(spec=settings_repo_module)
    repo.get_profile.return_value = profile
    monkeypatch.setattr(settings, "settings_repo", repo)

    out = settings.update_profile(session, ProfileIn(name="   ", email=None, householdSize=4))

    assert (profile.name, profile.email, profile.household_size) == (None, None, 4)
    assert out.household_size == 4
    session.commit.assert_called_once()
