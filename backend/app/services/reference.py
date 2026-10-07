"""Reference data for forms and filters: options, units, tags, ingredient suggestions."""

from sqlmodel import Session

from app.constants import CUISINES, DIETARY_LABELS, MEAL_TYPES, UNITS
from app.repositories import ingredients as ingredient_repo
from app.repositories import tags as tag_repo
from app.schemas import IngredientSuggestion, OptionsOut, TagIn, TagOut, UnitOut
from app.services.tags import get_or_create_tags


def options() -> OptionsOut:
    return OptionsOut(meal_types=list(MEAL_TYPES), dietary_labels=list(DIETARY_LABELS), cuisines=list(CUISINES))


def units() -> list[UnitOut]:
    return [UnitOut(key=u.key, label=u.label, group=u.group) for u in UNITS]


def list_tags(session: Session) -> list[TagOut]:
    return [TagOut.model_validate(t) for t in tag_repo.list_all(session)]


def create_tag(session: Session, data: TagIn) -> TagOut:
    [tag] = get_or_create_tags(session, [data.name])
    session.commit()
    return TagOut.model_validate(tag)


def suggest_ingredients(session: Session, q: str, limit: int = 10) -> list[IngredientSuggestion]:
    if not q.strip():
        return []
    return [IngredientSuggestion(id=i.id, name=i.name) for i in ingredient_repo.search(session, q, limit=limit)]
