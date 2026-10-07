"""Recipe queries. The only module that talks to the recipe tables.

Efficiency rules:
- Related rows (meal types, dietary labels, tags, ingredients, steps) are loaded up front
  with selectinload: a fixed number of queries per request, never one per recipe (no N+1).
- Filters and search run in SQL, not in Python, as `recipe.id IN (SELECT recipe_id ...)` semi-joins.
  (Not correlated EXISTS: SQLite 3.51.0 can return duplicate rows for EXISTS ... IN (...).)
- The list only loads what summaries need; ingredients and steps load for the detail only.
"""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass, field

from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, func, select

from app.constants import DietaryLabel, MealType
from app.models import Ingredient, Recipe, RecipeDietary, RecipeIngredient, RecipeMealType, RecipeTag, Tag


@dataclass(frozen=True)
class RecipeQuery:
    q: str | None = None
    meal_types: Sequence[MealType] = field(default_factory=tuple)  # any of
    dietary: Sequence[DietaryLabel] = field(default_factory=tuple)  # all of (vegetarian also accepts vegan)
    tag_keys: Sequence[str] = field(default_factory=tuple)  # any of


_SUMMARY_LOADS = (
    selectinload(Recipe.meal_types),
    selectinload(Recipe.dietary),
    selectinload(Recipe.tags).selectinload(RecipeTag.tag),
)
_DETAIL_LOADS = (
    *_SUMMARY_LOADS,
    selectinload(Recipe.ingredients).selectinload(RecipeIngredient.ingredient),
    selectinload(Recipe.method_steps),
)


def _dietary_matches(label: DietaryLabel):
    accepted = [label.value] + ([DietaryLabel.VEGAN.value] if label == DietaryLabel.VEGETARIAN else [])
    return col(Recipe.id).in_(select(RecipeDietary.recipe_id).where(col(RecipeDietary.label).in_(accepted)))


def list_summaries(session: Session, query: RecipeQuery) -> list[Recipe]:
    stmt = select(Recipe).where(col(Recipe.deleted).is_(False)).options(*_SUMMARY_LOADS)

    for label in query.dietary:
        stmt = stmt.where(_dietary_matches(label))
    if query.meal_types:
        meal = select(RecipeMealType.recipe_id).where(
            col(RecipeMealType.meal_type).in_([m.value for m in query.meal_types])
        )
        stmt = stmt.where(col(Recipe.id).in_(meal))
    if query.tag_keys:
        tagged = select(RecipeTag.recipe_id).join(Tag).where(col(Tag.key).in_(query.tag_keys))
        stmt = stmt.where(col(Recipe.id).in_(tagged))
    if query.q:
        like = f"%{query.q.strip().lower()}%"
        with_ingredient = select(RecipeIngredient.recipe_id).join(Ingredient).where(func.lower(Ingredient.name).like(like))
        stmt = stmt.where(func.lower(Recipe.name).like(like) | col(Recipe.id).in_(with_ingredient))

    return list(session.exec(stmt.order_by(func.lower(Recipe.name))))


def get_detail_by_slug(session: Session, slug: str, *, include_deleted: bool = False) -> Recipe | None:
    stmt = select(Recipe).where(Recipe.slug == slug).options(*_DETAIL_LOADS)
    if not include_deleted:
        stmt = stmt.where(col(Recipe.deleted).is_(False))
    return session.exec(stmt).first()


def get_by_slug(session: Session, slug: str, *, include_deleted: bool = False) -> Recipe | None:
    query = select(Recipe).where(Recipe.slug == slug)
    if not include_deleted:
        query = query.where(col(Recipe.deleted).is_(False))
    return session.exec(query).first()


def list_active(session: Session, *, exclude_id: uuid.UUID | None = None) -> list[Recipe]:
    query = select(Recipe).where(col(Recipe.deleted).is_(False))
    if exclude_id is not None:
        query = query.where(Recipe.id != exclude_id)
    return list(session.exec(query))


def slugs_like(session: Session, base: str, *, exclude_id: uuid.UUID | None = None) -> set[str]:
    """`base` and `base-N` slugs in use, deleted recipes included (slugs are never reused)."""
    query = select(Recipe.slug).where((Recipe.slug == base) | col(Recipe.slug).like(f"{base}-%"))
    if exclude_id is not None:
        query = query.where(Recipe.id != exclude_id)
    return set(session.exec(query))


def is_empty(session: Session) -> bool:
    return session.exec(select(Recipe.id).limit(1)).first() is None


def add(session: Session, recipe: Recipe) -> Recipe:
    session.add(recipe)
    return recipe
