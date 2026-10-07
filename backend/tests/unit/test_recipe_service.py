"""Recipe service rules, isolated from the database: repositories are mocked, recipes are stubs."""

import datetime as dt
import uuid
from dataclasses import dataclass
from unittest.mock import MagicMock

import pytest

from app.constants import Cuisine, DietaryLabel, MealType
from app.core.errors import ValidationFailed
from app.models import Ingredient, MethodStep, Recipe, RecipeDietary, RecipeIngredient, RecipeMealType, RecipeTag, Tag
from app.repositories import plan as plan_repo_module
from app.repositories import recipes as recipe_repo_module
from app.repositories import settings as settings_repo_module
from app.repositories.recipes import RecipeQuery
from app.schemas import RecipeCreate
from app.services import recipes as service

TODAY = dt.date(2026, 10, 7)


# ---------- stubs & fixtures ----------


def make_recipe(*, is_custom: bool = False, name: str = "Lentil Dahl", slug: str = "lentil-dahl") -> Recipe:
    """A real, typed Recipe built in memory (no database), with its related rows."""
    batch_cook = Tag(id=1, key="batch-cook", name="Batch-cook", is_builtin=True)
    lentils, onion, salt = Ingredient(id=1, name="red lentils", name_key="red-lentil"), Ingredient(
        id=2, name="onion", name_key="onion"
    ), Ingredient(id=3, name="salt", name_key="salt")
    recipe = Recipe(
        id=uuid.uuid4(), slug=slug, name=name, cuisine=Cuisine.INDIAN, serves=4, is_custom=is_custom, deleted=False
    )
    recipe.meal_types = [RecipeMealType(meal_type=MealType.DINNER), RecipeMealType(meal_type=MealType.LUNCH)]
    recipe.dietary = [RecipeDietary(label=DietaryLabel.VEGAN), RecipeDietary(label=DietaryLabel.VEGETARIAN)]
    recipe.tags = [RecipeTag(tag=batch_cook)]
    recipe.ingredients = [
        RecipeIngredient(position=0, ingredient_id=1, ingredient=lentils, quantity=250.0, unit="g"),
        RecipeIngredient(position=1, ingredient_id=2, ingredient=onion, quantity=1.0, unit=None, prep="chopped"),
        RecipeIngredient(position=2, ingredient_id=3, ingredient=salt, quantity=None, unit=None),
    ]
    recipe.method_steps = [MethodStep(position=0, text="Soften the onion."), MethodStep(position=1, text="Simmer.")]
    return recipe


@dataclass
class Repos:
    recipes: MagicMock
    plan: MagicMock
    settings: MagicMock


@pytest.fixture
def repos(monkeypatch: pytest.MonkeyPatch) -> Repos:
    """Replace the repositories the service uses with spec'd mocks (typos in method names fail)."""
    mocks = Repos(
        recipes=MagicMock(spec=recipe_repo_module),
        plan=MagicMock(spec=plan_repo_module),
        settings=MagicMock(spec=settings_repo_module),
    )
    monkeypatch.setattr(service, "recipe_repo", mocks.recipes)
    monkeypatch.setattr(service, "plan_repo", mocks.plan)
    monkeypatch.setattr(service, "settings_repo", mocks.settings)
    return mocks


@pytest.fixture
def session() -> MagicMock:
    return MagicMock(name="session")


def recipe_input(**overrides: object) -> RecipeCreate:
    data = {
        "name": "  Nan's   Veggie Stew ",
        "cuisine": "british",
        "serves": 4,
        "mealTypes": ["dinner"],
        "ingredients": [{"item": "carrots", "quantity": 400, "unit": "g", "prep": "sliced"}],
        "method": ["Fry the carrots.", "   "],
    }
    return RecipeCreate.model_validate(data | overrides)


# ---------- mapping ----------


def test_summary_uses_canonical_order_and_default_image() -> None:
    summary = service.to_summary(make_recipe())
    assert summary.meal_types == [MealType.LUNCH, MealType.DINNER]  # enum order, not storage order
    assert summary.dietary == [DietaryLabel.VEGETARIAN, DietaryLabel.VEGAN]
    assert summary.default_image == "🥪"  # first meal type: lunch
    assert [t.key for t in summary.tags] == ["batch-cook"]


def test_detail_unscaled_keeps_original_amounts() -> None:
    detail = service.to_detail(make_recipe())
    assert detail.servings == 4
    assert [i.quantity for i in detail.ingredients] == [250.0, 1.0, None]
    assert detail.method == ["Soften the onion.", "Simmer."]


def test_detail_scaled_to_servings() -> None:
    detail = service.to_detail(make_recipe(), servings=2)
    assert detail.servings == 2
    assert [i.quantity for i in detail.ingredients] == [125.0, 1.0, None]  # onion rounds up, to taste unscaled


# ---------- list ----------


def test_list_defaults_to_saved_dietary_preferences(repos: Repos, session: MagicMock) -> None:
    repos.settings.get_dietary.return_value = [DietaryLabel.VEGETARIAN]
    repos.recipes.count_summaries.return_value = 1
    repos.recipes.list_summaries.return_value = [make_recipe()]

    result = service.list_recipes(session)

    query = RecipeQuery(dietary=(DietaryLabel.VEGETARIAN,))
    repos.recipes.count_summaries.assert_called_once_with(session, query)
    repos.recipes.list_summaries.assert_called_once_with(session, query, limit=service.DEFAULT_PAGE_SIZE, offset=0)
    assert [r.slug for r in result.items] == ["lentil-dahl"]


def test_list_with_all_ignores_preferences(repos: Repos, session: MagicMock) -> None:
    repos.recipes.count_summaries.return_value = 0
    repos.recipes.list_summaries.return_value = []
    service.list_recipes(session, include_all=True)
    repos.settings.get_dietary.assert_not_called()
    repos.recipes.count_summaries.assert_called_once_with(session, RecipeQuery())


def test_list_explicit_filters_are_passed_through(repos: Repos, session: MagicMock) -> None:
    repos.recipes.count_summaries.return_value = 0
    repos.recipes.list_summaries.return_value = []
    service.list_recipes(
        session, q="lentil", meal_types=[MealType.DINNER], dietary=[DietaryLabel.VEGAN], tag_keys=["quick"]
    )
    repos.settings.get_dietary.assert_not_called()
    repos.recipes.count_summaries.assert_called_once_with(
        session,
        RecipeQuery(q="lentil", meal_types=(MealType.DINNER,), dietary=(DietaryLabel.VEGAN,), tag_keys=("quick",)),
    )


@pytest.mark.parametrize(
    ("total", "page", "offset", "total_pages"),
    [(12, 1, 0, 3), (12, 3, 10, 3), (10, 2, 5, 2), (0, 1, 0, 1), (12, 9, 40, 3)],
)
def test_list_pages_with_offset_and_total_pages(
    repos: Repos, session: MagicMock, total: int, page: int, offset: int, total_pages: int
) -> None:
    repos.recipes.count_summaries.return_value = total
    repos.recipes.list_summaries.return_value = []

    result = service.list_recipes(session, include_all=True, page=page, page_size=5)

    repos.recipes.list_summaries.assert_called_once_with(session, RecipeQuery(), limit=5, offset=offset)
    assert (result.total, result.page, result.page_size, result.total_pages) == (total, page, 5, total_pages)


# ---------- get / usage ----------


def test_get_detail_not_found(repos: Repos, session: MagicMock) -> None:
    repos.recipes.get_detail_by_slug.return_value = None
    with pytest.raises(service.RecipeNotFound) as exc:
        service.get_recipe_detail(session, "nope")
    assert exc.value.status_code == 404 and exc.value.code == "recipe_not_found"


def test_usage_counts_from_today(repos: Repos, session: MagicMock) -> None:
    recipe = make_recipe()
    repos.recipes.get_by_slug.return_value = recipe
    repos.plan.count_from.return_value = 3
    assert service.recipe_usage(session, "lentil-dahl", TODAY).upcoming_meals == 3
    repos.plan.count_from.assert_called_once_with(session, recipe.id, TODAY)


# ---------- slugs ----------


def test_new_slug_blocks_active_duplicate(repos: Repos, session: MagicMock) -> None:
    repos.recipes.list_active.return_value = [make_recipe(name="Nan's Veggie Stew", slug="nans-veggie-stew")]
    with pytest.raises(service.DuplicateRecipeName) as exc:
        service.new_recipe_slug(session, "NANS veggie stew")
    assert exc.value.status_code == 409
    assert exc.value.details == {"fields": {"name": "There's already a recipe called Nan's Veggie Stew."}}


@pytest.mark.parametrize(("taken", "expected"), [(set(), "stew"), ({"stew"}, "stew-2"), ({"stew", "stew-2"}, "stew-3")])
def test_new_slug_suffixes_when_only_deleted_recipes_use_it(repos: Repos, session: MagicMock, taken: set[str], expected: str) -> None:
    repos.recipes.list_active.return_value = []
    repos.recipes.slugs_like.return_value = taken
    assert service.new_recipe_slug(session, "Stew") == expected


def test_new_slug_rejects_names_without_letters(repos: Repos, session: MagicMock) -> None:
    with pytest.raises(ValidationFailed) as exc:
        service.new_recipe_slug(session, "!!!")
    assert exc.value.details == {"fields": {"name": "Use at least one letter or number."}}
    repos.recipes.list_active.assert_not_called()


# ---------- validation ----------


def test_clean_trims_name_and_drops_blank_steps() -> None:
    name, steps = service._clean(recipe_input())
    assert name == "Nan's Veggie Stew"
    assert steps == ["Fry the carrots."]


def test_clean_reports_every_bad_field_at_once() -> None:
    data = recipe_input(
        method=["  "],
        ingredients=[{"item": "carrots", "quantity": 1, "unit": "grams"}, {"item": "milk", "quantity": 1, "unit": "cup"}],
    )
    with pytest.raises(ValidationFailed) as exc:
        service._clean(data)
    assert exc.value.details["fields"] == {
        "method": "Add at least one step.",
        "ingredients.0.unit": "Pick a unit from the list.",
        "ingredients.1.unit": "Pick a unit from the list.",
    }


# ---------- writes on built-in recipes ----------


def test_update_builtin_recipe_is_forbidden(repos: Repos, session: MagicMock) -> None:
    repos.recipes.get_detail_by_slug.return_value = make_recipe(is_custom=False)
    with pytest.raises(service.RecipeReadOnly) as exc:
        service.update_recipe(session, "lentil-dahl", recipe_input())
    assert exc.value.status_code == 403
    session.commit.assert_not_called()


def test_delete_builtin_recipe_is_forbidden(repos: Repos, session: MagicMock) -> None:
    repos.recipes.get_by_slug.return_value = make_recipe(is_custom=False)
    with pytest.raises(service.RecipeReadOnly):
        service.delete_recipe(session, "lentil-dahl", TODAY)
    repos.plan.delete_from.assert_not_called()
    session.commit.assert_not_called()


def test_delete_custom_recipe_soft_deletes_and_clears_upcoming_meals(repos: Repos, session: MagicMock) -> None:
    recipe = make_recipe(is_custom=True, name="Nan's Veggie Stew", slug="nans-veggie-stew")
    repos.recipes.get_by_slug.return_value = recipe

    service.delete_recipe(session, "nans-veggie-stew", TODAY)

    assert recipe.deleted is True
    repos.plan.delete_from.assert_called_once_with(session, recipe.id, TODAY)
    session.commit.assert_called_once()
