import json

import pytest
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from app.constants import MealType
from app.models import Recipe, RecipeMealType
from app.schemas import RecipeCreate
from app.seed import SEED_FILE, SeedRecipe


def raw_seed_recipes() -> list[dict]:
    return json.loads(SEED_FILE.read_text(encoding="utf-8"))


def _recipe(session, slug):
    return session.exec(select(Recipe).where(Recipe.slug == slug)).one()


def _create(**overrides):
    data = {
        "name": "Test Stew",
        "cuisine": "british",
        "serves": 2,
        "mealTypes": ["dinner"],
        "ingredients": [{"item": "carrot", "quantity": 1}],
        "method": ["Cook it."],
    } | overrides
    return RecipeCreate.model_validate(data)


def test_recipe_can_have_several_meal_types(session):
    potato = _recipe(session, "jacket-potato-with-cheese-and-beans")
    assert {m.meal_type for m in potato.meal_types} == {MealType.LUNCH, MealType.DINNER}


def test_every_seeded_recipe_has_at_least_one_meal_type(session):
    assert all(r.meal_types for r in session.exec(select(Recipe)))


def test_seed_rejects_recipe_without_meal_type():
    data = raw_seed_recipes()[0] | {"mealType": []}
    with pytest.raises(ValidationError):
        SeedRecipe.model_validate(data)


def test_seed_rejects_unknown_meal_type():
    data = raw_seed_recipes()[0] | {"mealType": ["brunch"]}
    with pytest.raises(ValidationError):
        SeedRecipe.model_validate(data)


def test_api_create_requires_at_least_one_meal_type():
    with pytest.raises(ValidationError):
        _create(mealTypes=[])


def test_api_create_accepts_several_meal_types_and_no_dietary_labels():
    recipe = _create(mealTypes=["lunch", "dinner"])
    assert recipe.meal_types == [MealType.LUNCH, MealType.DINNER]
    assert recipe.dietary == []


def test_api_create_rejects_unknown_dietary_label():
    with pytest.raises(ValidationError):
        _create(dietary=["pescatarian"])


def test_database_rejects_meal_type_outside_enum(session):
    dahl = _recipe(session, "lentil-dahl")
    with pytest.raises(IntegrityError):
        session.execute(
            text("INSERT INTO recipe_meal_type (recipe_id, meal_type) VALUES (:id, 'brunch')"),
            {"id": dahl.id.hex},
        )
        session.commit()


def test_database_rejects_dietary_label_outside_enum(session):
    dahl = _recipe(session, "lentil-dahl")
    with pytest.raises(IntegrityError):
        session.execute(
            text("INSERT INTO recipe_dietary (recipe_id, label) VALUES (:id, 'pescatarian')"),
            {"id": dahl.id.hex},
        )
        session.commit()


def test_meal_type_rows_round_trip_as_enum(session):
    row = session.exec(select(RecipeMealType)).first()
    assert isinstance(row.meal_type, MealType)
