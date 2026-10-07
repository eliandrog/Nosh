"""Shopping list maths, no database: scaling, unit conversion, merging, rounding, "to taste"."""

import pytest

from app.services.shopping_merge import PlannedIngredient, ShoppingLine, build_lines, round_for_shopping

LENTILS, ONION, MILK, COCONUT, TOMATOES, SALT = 1, 2, 3, 4, 5, 6


def used(ingredient_id: int, quantity: float | None, unit: str | None, servings: int = 4, serves: int = 4) -> PlannedIngredient:
    return PlannedIngredient(ingredient_id, quantity, unit, servings, serves)


def test_scales_each_meal_by_its_servings() -> None:
    assert build_lines([used(LENTILS, 250, "g", servings=2)]) == [ShoppingLine(LENTILS, "g", 125, False)]


def test_same_ingredient_from_several_meals_is_one_line() -> None:
    lines = build_lines([used(ONION, 1, None), used(ONION, 1, None, servings=2, serves=2)])
    assert lines == [ShoppingLine(ONION, "item", 2, False)]


def test_converts_spoons_and_large_units_before_adding() -> None:
    lines = build_lines([used(MILK, 500, "ml"), used(MILK, 2, "tbsp"), used(MILK, 1, "l"), used(MILK, 1, "tsp")])
    assert lines == [ShoppingLine(MILK, "ml", 1535, False)]
    assert build_lines([used(LENTILS, 1, "kg"), used(LENTILS, 250, "g")]) == [ShoppingLine(LENTILS, "g", 1250, False)]


def test_units_that_cannot_convert_stay_separate_lines() -> None:
    lines = build_lines([used(COCONUT, 1, "tin"), used(COCONUT, 200, "ml")])
    assert lines == [ShoppingLine(COCONUT, "ml", 200, False), ShoppingLine(COCONUT, "tin", 1, False)]


def test_rounds_once_after_adding_up() -> None:
    # Two meals each needing half a tin need one tin, not two.
    lines = build_lines([used(TOMATOES, 1, "tin", servings=2), used(TOMATOES, 1, "tin", servings=2)])
    assert lines == [ShoppingLine(TOMATOES, "tin", 1, False)]


@pytest.mark.parametrize(
    ("quantity", "unit", "expected"),
    [(0.5, "tin", 1), (1.01, "item", 2), (2.0, "clove", 2), (126.4, "g", 126), (0.3, "g", 1), (532.5, "ml", 532)],
)
def test_packs_and_items_round_up_weights_and_volumes_to_whole_numbers(quantity: float, unit: str, expected: float) -> None:
    assert round_for_shopping(quantity, unit) == expected


def test_to_taste_only_is_a_to_taste_line() -> None:
    assert build_lines([used(SALT, None, None), used(SALT, None, None)]) == [ShoppingLine(SALT, "item", None, True)]


def test_amount_wins_over_to_taste() -> None:
    lines = build_lines([used(SALT, None, None), used(SALT, 1, "tsp", servings=2, serves=2)])
    assert lines == [ShoppingLine(SALT, "ml", 5, True)]  # "5 ml + to taste", no extra line


def test_nothing_planned_is_an_empty_list() -> None:
    assert build_lines([]) == []
