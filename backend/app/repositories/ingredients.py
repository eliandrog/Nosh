"""Ingredient queries."""

from sqlmodel import Session, func, select

from app.models import Ingredient


def get_by_key(session: Session, name_key: str) -> Ingredient | None:
    return session.exec(select(Ingredient).where(Ingredient.name_key == name_key)).first()


def add(session: Session, name: str, name_key: str) -> Ingredient:
    ingredient = Ingredient(name=name, name_key=name_key)
    session.add(ingredient)
    return ingredient


def search(session: Session, text: str, *, limit: int = 10) -> list[Ingredient]:
    """Matches the readable name: names starting with the text first, then names containing it."""
    needle = text.strip().lower()
    name = func.lower(Ingredient.name)
    stmt = select(Ingredient).where(name.like(f"%{needle}%")).order_by(name.like(f"{needle}%").desc(), name).limit(limit)
    return list(session.exec(stmt))
