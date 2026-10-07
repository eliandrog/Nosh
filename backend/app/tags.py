"""Recipe tags: a recipe has zero or more, and new tags are created on the fly.

Tags are matched by a key made with the same slug rule as recipes, so
"Low cost", "low  COST" and "Low-cost" all share the tag "low-cost".
"""

from sqlmodel import Session, select

from app.models import Tag
from app.recipe_ids import slugify


def tag_key(name: str) -> str:
    return slugify(name)


def get_or_create_tags(session: Session, names: list[str]) -> list[Tag]:
    """Return one Tag per distinct name, creating any that don't exist yet (is_builtin=False)."""
    found: dict[str, Tag] = {}
    for name in names:
        key = tag_key(name)
        if not key:
            raise ValueError("Tag names must contain letters or numbers.")
        if key in found:
            continue
        tag = session.exec(select(Tag).where(Tag.key == key)).first()
        if tag is None:
            tag = Tag(key=key, name=" ".join(name.split()), is_builtin=False)
            session.add(tag)
        found[key] = tag
    return list(found.values())
