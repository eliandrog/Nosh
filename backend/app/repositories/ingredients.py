"""Ingredient queries."""

from sqlmodel import Session, col, select

from app.models import Ingredient


def get_by_key(session: Session, name_key: str) -> Ingredient | None:
    return session.exec(select(Ingredient).where(Ingredient.name_key == name_key)).first()


def add(session: Session, name: str, name_key: str) -> Ingredient:
    ingredient = Ingredient(name=name, name_key=name_key)
    session.add(ingredient)
    return ingredient


def search(session: Session, text: str, *, limit: int = 10) -> list[Ingredient]:
    """Names starting with the text first, then names containing it."""
    needle = text.strip().lower()
    starts = col(Ingredient.name_key).like(f"{needle}%")
    stmt = (
        select(Ingredient)
        .where(col(Ingredient.name_key).like(f"%{needle}%"))
        .order_by(starts.desc(), Ingredient.name_key)
        .limit(limit)
    )
    return list(session.exec(stmt))
