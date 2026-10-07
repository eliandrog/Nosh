"""Tag queries."""

from sqlmodel import Session, select

from app.models import Tag


def get_by_key(session: Session, key: str) -> Tag | None:
    return session.exec(select(Tag).where(Tag.key == key)).first()


def add(session: Session, key: str, name: str, *, is_builtin: bool = False) -> Tag:
    tag = Tag(key=key, name=name, is_builtin=is_builtin)
    session.add(tag)
    return tag


def list_all(session: Session) -> list[Tag]:
    return list(session.exec(select(Tag).order_by(Tag.name)))
