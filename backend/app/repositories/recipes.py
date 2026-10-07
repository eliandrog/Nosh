"""Recipe queries. The only module that talks to the recipe table."""

import uuid

from sqlmodel import Session, col, select

from app.models import Recipe


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
