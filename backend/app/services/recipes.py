"""Recipe business rules. Uses repositories for data; returns API schemas; raises domain errors, never HTTP ones.

Slugs are URL-friendly versions of the recipe name and are never reused
(the real identifier is the recipe's UUID):

- "Nan's Veggie Stew" -> "nans-veggie-stew"
- A name that matches an active recipe is blocked.
- A name that only matches deleted recipes gets the next free suffix: -2, -3, ...
- On rename, pass the recipe's own id as exclude_id so it doesn't clash with itself.
"""

import datetime as dt
import math
import uuid
from collections.abc import Sequence

from sqlmodel import Session

from app.constants import DEFAULT_MEAL_EMOJI, UNITS_BY_KEY, DietaryLabel, MealType
from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationFailed
from app.models import Ingredient, MethodStep, Recipe, RecipeDietary, RecipeIngredient, RecipeMealType, RecipeTag
from app.repositories import ingredients as ingredient_repo
from app.repositories import plan as plan_repo
from app.repositories import recipes as recipe_repo
from app.repositories import settings as settings_repo
from app.repositories.recipes import RecipeQuery
from app.schemas import IngredientLine, RecipeCreate, RecipeDetail, RecipePage, RecipeSummary, RecipeUsageOut, TagOut
from app.services.ingredients import merge_key
from app.services.scaling import scale_quantity
from app.services.slugs import slugify
from app.services.tags import get_or_create_tags


DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 50


class DuplicateRecipeName(ConflictError):
    code = "recipe_name_taken"


class RecipeNotFound(NotFoundError):
    code = "recipe_not_found"


class RecipeReadOnly(ForbiddenError):
    code = "recipe_read_only"


# ---------- Slugs ----------



def new_recipe_slug(session: Session, name: str, exclude_id: uuid.UUID | None = None) -> str:
    base = slugify(name)
    if not base:
        raise ValidationFailed(
            "Recipe name must contain letters or numbers.",
            fields={"name": "Use at least one letter or number."},
        )

    for recipe in recipe_repo.list_active(session, exclude_id=exclude_id):
        if slugify(recipe.name) == base:
            raise DuplicateRecipeName(
                f"There's already a recipe called {recipe.name}.",
                details={"fields": {"name": f"There's already a recipe called {recipe.name}."}},
            )

    taken = recipe_repo.slugs_like(session, base, exclude_id=exclude_id)
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


# ---------- Mapping (model -> API schema) ----------


def _meal_types(recipe: Recipe) -> list[MealType]:
    present = {m.meal_type for m in recipe.meal_types}
    return [m for m in MealType if m in present]  # stable, canonical order


def _summary_fields(recipe: Recipe) -> dict:
    meal_types = _meal_types(recipe)
    present_dietary = {d.label for d in recipe.dietary}
    return {
        "id": recipe.id,
        "slug": recipe.slug,
        "name": recipe.name,
        "cuisine": recipe.cuisine,
        "serves": recipe.serves,
        "meal_types": meal_types,
        "dietary": [d for d in DietaryLabel if d in present_dietary],
        "tags": sorted((TagOut.model_validate(rt.tag) for rt in recipe.tags), key=lambda t: t.name.lower()),
        "is_custom": recipe.is_custom,
        "image_url": recipe.image_url,
        "default_image": DEFAULT_MEAL_EMOJI[meal_types[0]] if meal_types else "🍽️",
    }


def to_summary(recipe: Recipe) -> RecipeSummary:
    return RecipeSummary(**_summary_fields(recipe))


def to_detail(recipe: Recipe, servings: int | None = None) -> RecipeDetail:
    servings = servings or recipe.serves
    factor = servings / recipe.serves
    return RecipeDetail(
        **_summary_fields(recipe),
        servings=servings,
        ingredients=[
            IngredientLine(
                ingredient_id=line.ingredient_id,
                item=line.ingredient.name,
                quantity=scale_quantity(line.quantity, line.unit, factor) if factor != 1 else line.quantity,
                unit=line.unit,
                prep=line.prep,
            )
            for line in recipe.ingredients
        ],
        method=[step.text for step in recipe.method_steps],
    )


# ---------- Queries ----------


def list_recipes(
    session: Session,
    *,
    q: str | None = None,
    meal_types: Sequence[MealType] = (),
    dietary: Sequence[DietaryLabel] | None = None,
    tag_keys: Sequence[str] = (),
    include_all: bool = False,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> RecipePage:
    """Dietary defaults to the saved preferences unless given explicitly or include_all is set."""
    if dietary is None:
        dietary = [] if include_all else settings_repo.get_dietary(session)
    query = RecipeQuery(q=q or None, meal_types=tuple(meal_types), dietary=tuple(dietary), tag_keys=tuple(tag_keys))
    total = recipe_repo.count_summaries(session, query)
    recipes = recipe_repo.list_summaries(session, query, limit=page_size, offset=(page - 1) * page_size)
    return RecipePage(
        items=[to_summary(r) for r in recipes],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


def _get_detail_model(session: Session, slug: str) -> Recipe:
    recipe = recipe_repo.get_detail_by_slug(session, slug)
    if recipe is None:
        raise RecipeNotFound("We couldn't find that recipe.")
    return recipe


def get_recipe(session: Session, slug: str) -> Recipe:
    recipe = recipe_repo.get_by_slug(session, slug)
    if recipe is None:
        raise RecipeNotFound("We couldn't find that recipe.")
    return recipe


def get_recipe_detail(session: Session, slug: str, servings: int | None = None) -> RecipeDetail:
    return to_detail(_get_detail_model(session, slug), servings)


def recipe_usage(session: Session, slug: str, today: dt.date) -> RecipeUsageOut:
    recipe = get_recipe(session, slug)
    return RecipeUsageOut(upcoming_meals=plan_repo.count_from(session, recipe.id, today))


# ---------- Writes ----------


def _clean(data: RecipeCreate) -> tuple[str, list[str]]:
    name = " ".join(data.name.split())
    steps = [" ".join(s.split()) for s in data.method if s.strip()]
    fields: dict[str, str] = {}
    if not steps:
        fields["method"] = "Add at least one step."
    for i, line in enumerate(data.ingredients):
        if line.unit not in UNITS_BY_KEY:
            fields[f"ingredients.{i}.unit"] = "Pick a unit from the list."
        if not line.item.strip():
            fields[f"ingredients.{i}.item"] = "Name the ingredient."
    if fields:
        raise ValidationFailed("Some details need fixing.", fields=fields)
    return name, steps


def _ingredient_for(session: Session, cache: dict[str, Ingredient], item: str) -> Ingredient:
    key = merge_key(item)
    if key not in cache:
        cache[key] = ingredient_repo.get_by_key(session, key) or ingredient_repo.add(session, " ".join(item.split()), key)
    return cache[key]


def _apply(session: Session, recipe: Recipe, data: RecipeCreate, name: str, steps: list[str]) -> None:
    """Set all fields and child rows from the request (replaces existing children)."""
    recipe.name = name
    recipe.cuisine = data.cuisine
    recipe.serves = data.serves
    cache: dict[str, Ingredient] = {}
    recipe.ingredients = [
        RecipeIngredient(
            position=i,
            ingredient=_ingredient_for(session, cache, line.item),
            quantity=line.quantity,
            unit=line.unit,
            prep=(line.prep or "").strip() or None,
        )
        for i, line in enumerate(data.ingredients)
    ]
    recipe.method_steps = [MethodStep(position=i, text=text) for i, text in enumerate(steps)]
    recipe.meal_types = [RecipeMealType(meal_type=m) for m in dict.fromkeys(data.meal_types)]
    recipe.dietary = [RecipeDietary(label=d) for d in dict.fromkeys(data.dietary)]
    recipe.tags = [RecipeTag(tag=t) for t in get_or_create_tags(session, data.tags)]


def create_recipe(session: Session, data: RecipeCreate) -> RecipeDetail:
    name, steps = _clean(data)
    recipe = Recipe(slug=new_recipe_slug(session, name), name=name, cuisine=data.cuisine, serves=data.serves, is_custom=True)
    _apply(session, recipe, data, name, steps)
    recipe_repo.add(session, recipe)
    session.commit()
    return get_recipe_detail(session, recipe.slug)


def update_recipe(session: Session, slug: str, data: RecipeCreate) -> RecipeDetail:
    recipe = _get_detail_model(session, slug)
    if not recipe.is_custom:
        raise RecipeReadOnly("Built-in Nosh recipes can't be edited.")
    name, steps = _clean(data)
    recipe.slug = new_recipe_slug(session, name, exclude_id=recipe.id)
    # Clear children first so replaced rows (same position keys) are deleted before the new ones insert.
    recipe.ingredients, recipe.method_steps, recipe.meal_types, recipe.dietary, recipe.tags = [], [], [], [], []
    session.flush()
    _apply(session, recipe, data, name, steps)
    session.commit()
    # TODO(shopping-list branch): rebuild current/future weeks' shopping lists that use this recipe.
    return get_recipe_detail(session, recipe.slug)


def delete_recipe(session: Session, slug: str, today: dt.date) -> None:
    """Soft delete: hidden everywhere, removed from today and future days, kept in past weeks."""
    recipe = get_recipe(session, slug)
    if not recipe.is_custom:
        raise RecipeReadOnly("Built-in Nosh recipes can't be deleted.")
    recipe.deleted = True
    plan_repo.delete_from(session, recipe.id, today)
    session.commit()
    # TODO(shopping-list branch): rebuild current/future weeks' shopping lists.
