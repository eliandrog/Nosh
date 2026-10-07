"""Ingredient queries."""

from sqlmodel import Session, select

from app.models import Ingredient


def get_by_key(session: Session, name_key: str) -> Ingredient | None:
    return session.exec(select(Ingredient).where(Ingredient.name_key == name_key)).first()


def add(session: Session, name: str, name_key: str) -> Ingredient:
    ingredient = Ingredient(name=name, name_key=name_key)
    session.add(ingredient)
    return ingredient
