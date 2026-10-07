import json

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
    dahl = session.get(Recipe, "lentil-dahl")
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


def _custom(name: str, rid: str) -> Recipe:
    return Recipe(id=rid, name=name, name_key=name.strip().lower(), cuisine="british", serves=4, is_custom=True)


def test_active_recipe_names_must_be_unique(session):
    session.add(_custom("Nan's Veggie Stew", "nans-veggie-stew"))
    session.commit()
    session.add(_custom("  NAN'S VEGGIE STEW ", "nans-veggie-stew-2"))
    with pytest.raises(IntegrityError):
        session.commit()


def test_soft_deleted_name_can_be_reused(session):
    import datetime as dt

    old = _custom("Nan's Veggie Stew", "nans-veggie-stew")
    session.add(old)
    session.commit()
    old.deleted_at = dt.datetime.now(dt.UTC)
    session.add(old)
    session.commit()
    session.add(_custom("Nan's Veggie Stew", "nans-veggie-stew-2"))
    session.commit()
    assert count(session, Recipe) == 22


def test_plan_entry_servings_must_be_positive(session):
    import datetime as dt

    session.add(PlanEntry(date=dt.date(2026, 10, 7), recipe_id="lentil-dahl", servings=0))
    with pytest.raises(IntegrityError):
        session.commit()


def test_plan_entry_requires_existing_recipe(session):
    import datetime as dt

    session.add(PlanEntry(date=dt.date(2026, 10, 7), recipe_id="no-such-recipe", servings=2))
    with pytest.raises(IntegrityError):
        session.commit()
