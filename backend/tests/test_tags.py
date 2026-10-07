import pytest
from sqlmodel import select

from app.models import Recipe, RecipeTag, Tag
from app.core.errors import ValidationFailed
from app.services.tags import get_or_create_tags, tag_key


def _recipe(session, slug):
    return session.exec(select(Recipe).where(Recipe.slug == slug)).one()


def test_tag_key_ignores_case_spaces_and_punctuation():
    assert tag_key("Low cost") == tag_key("  low  COST ") == tag_key("Low-cost") == "low-cost"


def test_existing_tag_is_reused(session):
    before = len(session.exec(select(Tag)).all())
    [tag] = get_or_create_tags(session, ["BATCH COOK"])
    assert tag.key == "batch-cook" and tag.is_builtin
    assert len(session.exec(select(Tag)).all()) == before


def test_new_tag_is_created_as_user_tag(session):
    [tag] = get_or_create_tags(session, ["  Low   cost "])
    session.commit()
    assert (tag.key, tag.name, tag.is_builtin) == ("low-cost", "Low cost", False)


def test_duplicate_names_in_one_save_create_one_tag(session):
    tags = get_or_create_tags(session, ["Low cost", "low-cost", "Quick", "quick"])
    assert [t.key for t in tags] == ["low-cost", "quick"]


def test_recipe_can_have_zero_or_many_tags(session):
    dahl = _recipe(session, "lentil-dahl")
    dahl.tags = []
    session.commit()
    assert dahl.tags == []
    dahl.tags = [RecipeTag(tag=t) for t in get_or_create_tags(session, ["Batch-cook", "Low cost", "Family favourite"])]
    session.commit()
    assert sorted(rt.tag.key for rt in dahl.tags) == ["batch-cook", "family-favourite", "low-cost"]


def test_tag_name_without_letters_or_numbers_is_rejected(session):
    with pytest.raises(ValidationFailed):
        get_or_create_tags(session, ["!!!"])
