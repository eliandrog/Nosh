"""Recipe tags: a recipe has zero or more, and new tags are created on the fly.

Tags are matched by a key made with the same slug rule as recipes, so
"Low cost", "low  COST" and "Low-cost" all share the tag "low-cost".
"""

from sqlmodel import Session

from app.core.errors import ValidationFailed
from app.models import Tag
from app.repositories import tags as tag_repo
from app.services.slugs import slugify


def tag_key(name: str) -> str:
    return slugify(name)


def get_or_create_tags(session: Session, names: list[str]) -> list[Tag]:
    """Return one Tag per distinct name, creating any that don't exist yet (is_builtin=False)."""
    found: dict[str, Tag] = {}
    for name in names:
        key = tag_key(name)
        if not key:
            raise ValidationFailed("Tag names must contain letters or numbers.", fields={"tags": "Use at least one letter or number."})
        if key in found:
            continue
        found[key] = tag_repo.get_by_key(session, key) or tag_repo.add(session, key, " ".join(name.split()))
    return list(found.values())
