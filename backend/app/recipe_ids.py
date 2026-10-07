"""Recipe IDs are slugs of the recipe name and are never reused.

- "Nan's Veggie Stew" -> "nans-veggie-stew"
- Adding a name that matches an active recipe is blocked.
- Adding a name that only matches deleted recipes gets the next free suffix: -2, -3, ...
"""

import re

from sqlmodel import Session, col, select

from app.models import Recipe


class DuplicateRecipeName(ValueError):
    """An active recipe already has this name."""


def slugify(name: str) -> str:
    s = name.lower().replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def new_recipe_id(session: Session, name: str) -> str:
    base = slugify(name)
    if not base:
        raise ValueError("Recipe name must contain letters or numbers.")

    for recipe in session.exec(select(Recipe).where(col(Recipe.deleted).is_(False))):
        if slugify(recipe.name) == base:
            raise DuplicateRecipeName(f"There's already a recipe called {recipe.name}.")

    taken = set(session.exec(select(Recipe.id).where((Recipe.id == base) | col(Recipe.id).like(f"{base}-%"))))
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"
