"""Load the starter recipes from the brief's JSON into the database.

The JSON file is read-only: it is never modified. Seeding only runs when the
recipe table is empty, so restarting the app never creates duplicates."""

import json
from pathlib import Path

from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session

from app.constants import UNITS_BY_KEY, Cuisine, DietaryLabel, MealType
from app.repositories import ingredients as ingredient_repo
from app.repositories import recipes as recipe_repo
from app.repositories import tags as tag_repo
from app.services.ingredients import merge_key
from app.models import (
    Ingredient,
    MethodStep,
    Recipe,
    RecipeDietary,
    RecipeIngredient,
    RecipeMealType,
    RecipeTag,
    Tag,
)

SEED_FILE = Path(__file__).resolve().parent.parent / "data" / "project-nosh-sample-recipes.json"


class SeedIngredient(BaseModel):
    item: str
    quantity: float | None
    unit: str | None
    prep: str | None = None

    @field_validator("unit")
    @classmethod
    def known_unit(cls, v: str | None) -> str | None:
        if v not in UNITS_BY_KEY:
            raise ValueError(f"unknown unit {v!r}")
        return v


class SeedRecipe(BaseModel):
    id: str
    name: str
    cuisine: Cuisine
    mealType: list[MealType] = Field(min_length=1)  # one or more
    dietary: list[DietaryLabel]  # zero or more
    tags: list[str]
    serves: int = Field(ge=1)
    ingredients: list[SeedIngredient]
    method: list[str]


def tag_name(key: str) -> str:
    """'batch-cook' -> 'Batch-cook'."""
    return key[:1].upper() + key[1:]


def _get_or_create_ingredient(session: Session, cache: dict[str, Ingredient], name: str) -> Ingredient:
    key = merge_key(name)
    if key not in cache:
        cache[key] = ingredient_repo.get_by_key(session, key) or ingredient_repo.add(session, name.strip(), key)
    return cache[key]


def _get_or_create_tag(session: Session, cache: dict[str, Tag], key: str) -> Tag:
    if key not in cache:
        cache[key] = tag_repo.get_by_key(session, key) or tag_repo.add(session, key, tag_name(key), is_builtin=True)
    return cache[key]


def load_seed_file(path: Path = SEED_FILE) -> list[SeedRecipe]:
    return [SeedRecipe.model_validate(r) for r in json.loads(path.read_text(encoding="utf-8"))]


def seed_recipes(session: Session, path: Path = SEED_FILE) -> int:
    """Insert the starter recipes in one transaction. Returns how many were added."""
    if not recipe_repo.is_empty(session):
        return 0

    recipes = load_seed_file(path)
    ingredients: dict[str, Ingredient] = {}
    tags: dict[str, Tag] = {}
    try:
        for r in recipes:
            recipe = Recipe(
                slug=r.id,  # JSON ids are already slugs of the name
                name=r.name,
                cuisine=r.cuisine,
                serves=r.serves,
                is_custom=False,
            )
            recipe.ingredients = [
                RecipeIngredient(
                    position=i,
                    ingredient=_get_or_create_ingredient(session, ingredients, ing.item),
                    quantity=ing.quantity,
                    unit=ing.unit,
                    prep=ing.prep,
                )
                for i, ing in enumerate(r.ingredients)
            ]
            recipe.method_steps = [MethodStep(position=i, text=step) for i, step in enumerate(r.method)]
            recipe.meal_types = [RecipeMealType(meal_type=m) for m in r.mealType]
            recipe.dietary = [RecipeDietary(label=d) for d in r.dietary]
            recipe.tags = [RecipeTag(tag=_get_or_create_tag(session, tags, t)) for t in r.tags]
            session.add(recipe)
        session.commit()
    except Exception:
        session.rollback()
        raise
    return len(recipes)
