import datetime as dt

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from app.models import Ingredient, PlanEntry, Profile, Recipe, RecipeIngredient, ShoppingListUpdate

DAY = dt.date(2026, 10, 7)


def _recipe(session, slug):
    return session.exec(select(Recipe).where(Recipe.slug == slug)).one()


def _line(session, **overrides):
    dahl = _recipe(session, "lentil-dahl")
    onion = session.exec(select(Ingredient).where(Ingredient.name_key == "onion")).one()
    return RecipeIngredient(**({"recipe_id": dahl.id, "position": 99, "ingredient_id": onion.id} | overrides))


# 3 · recipe_ingredient unit + quantity
@pytest.mark.parametrize("unit", [None, "g", "tbsp", "tin", "handful"])
def test_known_units_and_counted_items_are_allowed(session, unit):
    session.add(_line(session, unit=unit, quantity=2))
    session.commit()


def test_unknown_unit_is_rejected(session):
    session.add(_line(session, unit="grams", quantity=2))
    with pytest.raises(IntegrityError):
        session.commit()


@pytest.mark.parametrize("qty", [0, -1])
def test_ingredient_quantity_must_be_positive(session, qty):
    session.add(_line(session, unit="g", quantity=qty))
    with pytest.raises(IntegrityError):
        session.commit()


def test_ingredient_quantity_can_be_to_taste(session):
    session.add(_line(session, unit=None, quantity=None))
    session.commit()


# 4 · profile
def test_profile_household_size_must_be_at_least_one(session):
    session.add(Profile(household_size=0))
    with pytest.raises(IntegrityError):
        session.commit()


def test_profile_household_size_can_be_unset_or_positive(session):
    profile = Profile()
    session.add(profile)
    session.commit()
    profile.household_size = 4
    session.commit()


def test_profile_is_a_single_row(session):
    session.add(Profile(id=2))
    with pytest.raises(IntegrityError):
        session.commit()


# 5 · plan_entry (date, position)
def test_two_meals_cannot_share_a_position_on_the_same_day(session):
    dahl = _recipe(session, "lentil-dahl")
    session.add_all([PlanEntry(date=DAY, position=0, recipe_id=dahl.id, servings=2),
                     PlanEntry(date=DAY, position=0, recipe_id=dahl.id, servings=4)])
    with pytest.raises(IntegrityError):
        session.commit()


def test_unlimited_meals_per_day_with_different_positions(session):
    dahl = _recipe(session, "lentil-dahl")
    session.add_all([PlanEntry(date=DAY, position=i, recipe_id=dahl.id, servings=2) for i in range(6)])
    session.add(PlanEntry(date=DAY + dt.timedelta(days=1), position=0, recipe_id=dahl.id, servings=2))
    session.commit()


# 2 · shopping list update banner
def test_shopping_list_update_defaults_and_dismiss(session):
    week = dt.date(2026, 10, 5)
    update = ShoppingListUpdate(week_start=week, added=2)
    session.add(update)
    session.commit()
    assert (update.added, update.removed, update.changed, update.dismissed) == (2, 0, 0, False)
    update.dismissed = True
    session.commit()


def test_shopping_list_update_counts_cannot_be_negative(session):
    session.add(ShoppingListUpdate(week_start=dt.date(2026, 10, 5), added=-1))
    with pytest.raises(IntegrityError):
        session.commit()
