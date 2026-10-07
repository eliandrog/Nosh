"""Recipe slugs: URL-friendly versions of the recipe name, never reused.

The real identifier is the recipe's UUID; the slug is what appears in URLs.

- "Nan's Veggie Stew" -> "nans-veggie-stew"
- A name that matches an active recipe is blocked.
- A name that only matches deleted recipes gets the next free suffix: -2, -3, ...
- On rename, pass the recipe's own id as exclude_id so it doesn't clash with itself.
"""

import re
import uuid

from sqlmodel import Session, col, select

from app.models import Recipe


class DuplicateRecipeName(ValueError):
    """An active recipe already has this name."""


def slugify(name: str) -> str:
    s = name.lower().replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def new_recipe_slug(session: Session, name: str, exclude_id: uuid.UUID | None = None) -> str:
    base = slugify(name)
    if not base:
        raise ValueError("Recipe name must contain letters or numbers.")

    others = select(Recipe).where(col(Recipe.deleted).is_(False))
    if exclude_id is not None:
        others = others.where(Recipe.id != exclude_id)
    for recipe in session.exec(others):
        if slugify(recipe.name) == base:
            raise DuplicateRecipeName(f"There's already a recipe called {recipe.name}.")

    taken_query = select(Recipe.slug).where((Recipe.slug == base) | col(Recipe.slug).like(f"{base}-%"))
    if exclude_id is not None:
        taken_query = taken_query.where(Recipe.id != exclude_id)
    taken = set(session.exec(taken_query))
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"
