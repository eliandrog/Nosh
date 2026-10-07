"""Recipe business rules. Uses repositories for data; raises domain errors, never HTTP ones.

Slugs are URL-friendly versions of the recipe name and are never reused
(the real identifier is the recipe's UUID):

- "Nan's Veggie Stew" -> "nans-veggie-stew"
- A name that matches an active recipe is blocked.
- A name that only matches deleted recipes gets the next free suffix: -2, -3, ...
- On rename, pass the recipe's own id as exclude_id so it doesn't clash with itself.
"""

import re
import uuid

from sqlmodel import Session

from app.core.errors import ConflictError, NotFoundError, ValidationFailed
from app.models import Recipe
from app.repositories import recipes as recipe_repo


class DuplicateRecipeName(ConflictError):
    code = "recipe_name_taken"


class RecipeNotFound(NotFoundError):
    code = "recipe_not_found"


def slugify(name: str) -> str:
    s = name.lower().replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


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


def get_recipe(session: Session, slug: str) -> Recipe:
    recipe = recipe_repo.get_by_slug(session, slug)
    if recipe is None:
        raise RecipeNotFound("We couldn't find that recipe.")
    return recipe
