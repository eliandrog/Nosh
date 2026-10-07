import json
import uuid

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from app.ingredients import merge_key
from app.models import (
    Ingredient,
    MethodStep,
    PlanEntry,
    Recipe,
    RecipeDietary,
    RecipeIngredient,
    RecipeMealType,
    RecipeTag,
    Tag,
)
from app.recipe_ids import DuplicateRecipeName, new_recipe_slug, slugify
from app.seed import SEED_FILE, seed_recipes


def count(session: Session, model) -> int:
    return session.exec(select(func.count()).select_from(model)).one()


def raw_recipes() -> list[dict]:
    return json.loads(SEED_FILE.read_text(encoding="utf-8"))


def test_seed_loads_all_20_recipes(session):
    assert count(session, Recipe) == 20
    assert all(not r.is_custom for r in session.exec(select(Recipe)))


def test_seed_loads_every_ingredient_line_step_and_label(session):
    data = raw_recipes()
    assert count(session, RecipeIngredient) == sum(len(r["ingredients"]) for r in data)
    assert count(session, MethodStep) == sum(len(r["method"]) for r in data)
    assert count(session, RecipeMealType) == sum(len(r["mealType"]) for r in data)
    assert count(session, RecipeDietary) == sum(len(r["dietary"]) for r in data)
    assert count(session, RecipeTag) == sum(len(r["tags"]) for r in data)


def test_seed_keeps_recipe_details_and_order(session):
    dahl = _recipe(session, "lentil-dahl")
    first = dahl.ingredients[0]
    assert (first.ingredient.name, first.quantity, first.unit) == ("red lentils", 250, "g")
    onion = dahl.ingredients[1]
    assert (onion.ingredient.name, onion.unit, onion.prep) == ("onion", None, "chopped")
    assert dahl.method_steps[0].text.startswith("Soften the onion")
    assert {d.label for d in dahl.dietary} == {"vegetarian", "vegan", "gluten-free", "dairy-free"}
    assert [t.tag.key for t in dahl.tags] == ["batch-cook"]


def test_seed_is_idempotent(engine, session):
    assert seed_recipes(session) == 0
    assert count(session, Recipe) == 20
    from app.db import init_db

    init_db(engine)
    assert count(session, Recipe) == 20


def test_ingredients_are_deduplicated_by_merge_key(session):
    distinct_names = {i["item"] for r in raw_recipes() for i in r["ingredients"]}
    distinct_keys = {merge_key(n) for n in distinct_names}
    assert count(session, Ingredient) == len(distinct_keys)
    # apple/apples, carrot/carrots, basmati rice/rice merge; nothing else does.
    assert len(distinct_names) - len(distinct_keys) == 3


def test_json_tags_become_builtin_tags(session):
    tags = {t.key: t for t in session.exec(select(Tag))}
    assert set(tags) == {"quick", "batch-cook", "freezer-friendly", "kid-friendly"}
    assert tags["batch-cook"].name == "Batch-cook"
    assert all(t.is_builtin for t in tags.values())


def test_seed_does_not_modify_the_json(session):
    before = SEED_FILE.read_bytes()
    seed_recipes(session)
    assert SEED_FILE.read_bytes() == before


def _add_custom(session: Session, name: str) -> Recipe:
    recipe = Recipe(slug=new_recipe_slug(session, name), name=name, cuisine="british", serves=4, is_custom=True)
    session.add(recipe)
    session.commit()
    return recipe


@pytest.mark.parametrize(
    ("name", "slug"),
    [
        ("Nan's Veggie Stew", "nans-veggie-stew"),
        ("  NAN’S   Veggie  STEW! ", "nans-veggie-stew"),
        ("Chilli con Carne", "chilli-con-carne"),
        ("Chicken Stir-Fry", "chicken-stir-fry"),
    ],
)
def test_slugify(name, slug):
    assert slugify(name) == slug


def test_seed_slugs_match_json_ids_and_slug_rule(session):
    json_ids = {r["id"] for r in raw_recipes()}
    recipes = session.exec(select(Recipe)).all()
    assert {r.slug for r in recipes} == json_ids
    assert all(r.slug == slugify(r.name) for r in recipes)
    assert all(isinstance(r.id, uuid.UUID) for r in recipes)


def test_new_recipe_gets_uuid_and_slug_of_name(session):
    recipe = _add_custom(session, "Nan's Veggie Stew")
    assert recipe.slug == "nans-veggie-stew"
    assert isinstance(recipe.id, uuid.UUID)


def test_same_name_as_active_recipe_is_blocked(session):
    _add_custom(session, "Nan's Veggie Stew")
    with pytest.raises(DuplicateRecipeName):
        new_recipe_slug(session, "  NAN'S VEGGIE STEW ")


def test_same_name_as_builtin_recipe_is_blocked(session):
    with pytest.raises(DuplicateRecipeName, match="Lentil Dahl"):
        new_recipe_slug(session, "lentil dahl")


def test_name_of_deleted_recipe_gets_next_suffix(session):
    first = _add_custom(session, "Nan's Veggie Stew")
    first.deleted = True
    session.commit()
    second = _add_custom(session, "Nan's Veggie Stew")
    assert second.slug == "nans-veggie-stew-2"
    second.deleted = True
    session.commit()
    assert _add_custom(session, "Nan's Veggie Stew").slug == "nans-veggie-stew-3"
    assert count(session, Recipe) == 23


def test_active_suffixed_recipe_still_blocks(session):
    first = _add_custom(session, "Nan's Veggie Stew")
    first.deleted = True
    session.commit()
    _add_custom(session, "Nan's Veggie Stew")  # active as nans-veggie-stew-2
    with pytest.raises(DuplicateRecipeName):
        new_recipe_slug(session, "Nan's Veggie Stew")


def test_rename_keeps_uuid_and_updates_slug(session):
    recipe = _add_custom(session, "Nan's Veggie Stew")
    original_id = recipe.id
    recipe.name = "Nan's Winter Stew"
    recipe.slug = new_recipe_slug(session, recipe.name, exclude_id=recipe.id)
    session.commit()
    assert (recipe.id, recipe.slug) == (original_id, "nans-winter-stew")


def test_rename_to_own_name_is_allowed(session):
    recipe = _add_custom(session, "Nan's Veggie Stew")
    assert new_recipe_slug(session, "nan's veggie stew", exclude_id=recipe.id) == "nans-veggie-stew"


def test_slugs_are_unique_in_the_database(session):
    session.add(Recipe(slug="lentil-dahl", name="Other", cuisine="british", serves=2))
    with pytest.raises(IntegrityError):
        session.commit()


def _recipe(session: Session, slug: str) -> Recipe:
    return session.exec(select(Recipe).where(Recipe.slug == slug)).one()


def test_name_without_letters_or_numbers_is_rejected(session):
    with pytest.raises(ValueError):
        new_recipe_slug(session, " !!! ")


def test_plan_entry_servings_must_be_positive(session):
    import datetime as dt

    session.add(PlanEntry(date=dt.date(2026, 10, 7), recipe_id=_recipe(session, "lentil-dahl").id, servings=0))
    with pytest.raises(IntegrityError):
        session.commit()


def test_plan_entry_requires_existing_recipe(session):
    import datetime as dt

    session.add(PlanEntry(date=dt.date(2026, 10, 7), recipe_id=uuid.uuid4(), servings=2))
    with pytest.raises(IntegrityError):
        session.commit()
