"""Adding ingredients from the recipe form's dropdown, with the repository mocked (no database)."""

from unittest.mock import MagicMock

import pytest

from app.core.errors import ValidationFailed
from app.models import Ingredient
from app.repositories import ingredients as ingredient_repo_module
from app.schemas import IngredientIn
from app.services import reference


@pytest.fixture
def repo(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    mock = MagicMock(spec=ingredient_repo_module)
    monkeypatch.setattr(reference, "ingredient_repo", mock)
    return mock


@pytest.fixture
def session() -> MagicMock:
    return MagicMock(name="session")


def test_new_ingredient_is_created_with_tidy_name_and_dashed_key(repo: MagicMock, session: MagicMock) -> None:
    repo.get_by_key.return_value = None
    repo.add.return_value = Ingredient(id=80, name="Pak Choi", name_key="pak-choi")

    out = reference.create_ingredient(session, IngredientIn(name="  Pak   Choi "))

    repo.get_by_key.assert_called_once_with(session, "pak-choi")
    repo.add.assert_called_once_with(session, "Pak Choi", "pak-choi")
    session.commit.assert_called_once()
    assert (out.id, out.created) == (80, True)


def test_variant_of_existing_ingredient_returns_it_without_creating(repo: MagicMock, session: MagicMock) -> None:
    repo.get_by_key.return_value = Ingredient(id=2, name="onion", name_key="onion")

    out = reference.create_ingredient(session, IngredientIn(name="Onions"))

    assert (out.id, out.name, out.created) == (2, "onion", False)
    repo.add.assert_not_called()
    session.commit.assert_not_called()


def test_name_without_letters_or_numbers_is_rejected(repo: MagicMock, session: MagicMock) -> None:
    with pytest.raises(ValidationFailed) as exc:
        reference.create_ingredient(session, IngredientIn(name="!!!"))
    assert exc.value.details == {"fields": {"name": "Use at least one letter or number."}}
    repo.get_by_key.assert_not_called()
