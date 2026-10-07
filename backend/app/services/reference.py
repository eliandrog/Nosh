"""Reference data for forms and filters: options, units, tags, ingredient suggestions."""

from sqlmodel import Session

from app.constants import UNITS, Cuisine, DietaryLabel, MealType
from app.repositories import ingredients as ingredient_repo
from app.repositories import tags as tag_repo
from app.core.errors import ValidationFailed
from app.schemas import IngredientIn, IngredientOut, IngredientSuggestion, OptionsOut, TagIn, TagOut, UnitOut
from app.services.ingredients import merge_key
from app.services.tags import get_or_create_tags


def options() -> OptionsOut:
    return OptionsOut(meal_types=list(MealType), dietary_labels=list(DietaryLabel), cuisines=list(Cuisine))


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


def create_ingredient(session: Session, data: IngredientIn) -> IngredientOut:
    """Adds an ingredient, or returns the existing one with the same merge key ("Onions" -> "onion")."""
    name = " ".join(data.name.split())
    key = merge_key(name)
    if not key:
        raise ValidationFailed("Some details need fixing.", fields={"name": "Use at least one letter or number."})
    existing = ingredient_repo.get_by_key(session, key)
    if existing is not None:
        return IngredientOut(id=existing.id, name=existing.name, created=False)
    ingredient = ingredient_repo.add(session, name, key)
    session.commit()
    return IngredientOut(id=ingredient.id, name=ingredient.name, created=True)
