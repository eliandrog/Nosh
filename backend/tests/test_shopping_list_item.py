import datetime as dt

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from app.models import Ingredient, ShoppingListItem

WEEK = dt.date(2026, 10, 5)


def _ingredient(session, key):
    return session.exec(select(Ingredient).where(Ingredient.name_key == key)).one()


def test_line_per_ingredient_and_unit(session):
    coconut = _ingredient(session, "coconut milk")
    session.add_all([
        ShoppingListItem(week_start=WEEK, ingredient_id=coconut.id, unit="ml", quantity=200),
        ShoppingListItem(week_start=WEEK, ingredient_id=coconut.id, unit="tin", quantity=1),
    ])
    session.commit()
    assert len(session.exec(select(ShoppingListItem)).all()) == 2


def test_duplicate_line_in_same_week_is_rejected(session):
    onion = _ingredient(session, "onion")
    session.add(ShoppingListItem(week_start=WEEK, ingredient_id=onion.id, unit="item", quantity=1))
    session.commit()
    session.add(ShoppingListItem(week_start=WEEK, ingredient_id=onion.id, unit="item", quantity=2))
    with pytest.raises(IntegrityError):
        session.commit()


def test_same_line_in_another_week_is_allowed(session):
    onion = _ingredient(session, "onion")
    session.add_all([
        ShoppingListItem(week_start=WEEK, ingredient_id=onion.id, unit="item", quantity=1),
        ShoppingListItem(week_start=WEEK + dt.timedelta(days=7), ingredient_id=onion.id, unit="item", quantity=3),
    ])
    session.commit()


def test_to_taste_line_has_no_quantity(session):
    salt = _ingredient(session, "salt and pepper")
    item = ShoppingListItem(week_start=WEEK, ingredient_id=salt.id, unit="item", quantity=None, to_taste=True)
    session.add(item)
    session.commit()
    assert item.quantity is None and item.ticked is False


@pytest.mark.parametrize("qty", [0, -5])
def test_quantity_must_be_positive_when_set(session, qty):
    onion = _ingredient(session, "onion")
    session.add(ShoppingListItem(week_start=WEEK, ingredient_id=onion.id, unit="item", quantity=qty))
    with pytest.raises(IntegrityError):
        session.commit()


def test_line_must_reference_existing_ingredient(session):
    session.add(ShoppingListItem(week_start=WEEK, ingredient_id=999_999, unit="g", quantity=10))
    with pytest.raises(IntegrityError):
        session.commit()


def test_amount_plus_to_taste_line(session):
    salt = _ingredient(session, "salt and pepper")
    item = ShoppingListItem(week_start=WEEK, ingredient_id=salt.id, unit="ml", quantity=5, to_taste=True)
    session.add(item)
    session.commit()
    assert (item.quantity, item.to_taste) == (5, True)


def test_line_needs_amount_or_to_taste(session):
    onion = _ingredient(session, "onion")
    session.add(ShoppingListItem(week_start=WEEK, ingredient_id=onion.id, unit="item", quantity=None, to_taste=False))
    with pytest.raises(IntegrityError):
        session.commit()
