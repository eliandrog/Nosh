"""Pure shopping-list maths: scale, convert and merge a week's ingredients into lines.

No database here, so every rule is unit-testable on its own:
- each planned meal scales its recipe's amounts by servings / recipe serves;
- kg -> g, l / tsp / tbsp -> ml; packs (tin, clove, ...) and counted items are never converted;
- lines merge by (ingredient, unit); units that can't convert stay separate lines;
- rounding happens once, after summing: g / ml to whole numbers, everything else up to whole items;
- "to taste" is never scaled: the amount wins ("5 ml + to taste"); with no amount the line is just "to taste".
"""

import math
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass

from app.constants import COUNT_UNIT, UNITS_BY_KEY

_WHOLE_NUMBER_UNITS = {"g", "ml"}


@dataclass(frozen=True)
class PlannedIngredient:
    """One recipe ingredient line, as used by one planned meal."""

    ingredient_id: int
    quantity: float | None  # None = "to taste"
    unit: str | None  # recipe unit; None = counted items
    servings: int  # servings planned for this meal
    serves: int  # servings the recipe is written for


@dataclass(frozen=True)
class ShoppingLine:
    ingredient_id: int
    unit: str  # "g", "ml", "item", "tin", ...
    quantity: float | None  # None only when the line is just "to taste"
    to_taste: bool


def merged_unit(unit: str | None) -> str:
    if unit is None:
        return COUNT_UNIT
    info = UNITS_BY_KEY[unit]
    return info.base or unit


def _to_merged_amount(quantity: float, unit: str | None, factor: float) -> float:
    conversion = UNITS_BY_KEY[unit].factor if unit is not None and UNITS_BY_KEY[unit].base else 1.0
    return quantity * factor * conversion


def round_for_shopping(quantity: float, unit: str) -> float:
    if unit in _WHOLE_NUMBER_UNITS:
        return float(max(1, round(quantity)))
    return float(math.ceil(quantity - 1e-9))  # packs and counted items: buy whole ones


def build_lines(planned: Iterable[PlannedIngredient]) -> list[ShoppingLine]:
    amounts: dict[tuple[int, str], float] = defaultdict(float)
    to_taste: set[int] = set()
    for p in planned:
        if p.quantity is None:
            to_taste.add(p.ingredient_id)
            continue
        amounts[(p.ingredient_id, merged_unit(p.unit))] += _to_merged_amount(p.quantity, p.unit, p.servings / p.serves)

    lines = [
        ShoppingLine(ingredient_id, unit, round_for_shopping(total, unit), to_taste=False)
        for (ingredient_id, unit), total in sorted(amounts.items())
    ]
    for ingredient_id in sorted(to_taste):
        with_amount = [i for i, line in enumerate(lines) if line.ingredient_id == ingredient_id]
        if with_amount:  # the amount wins: mark one of its lines "+ to taste"
            i = with_amount[0]
            lines[i] = ShoppingLine(ingredient_id, lines[i].unit, lines[i].quantity, to_taste=True)
        else:
            lines.append(ShoppingLine(ingredient_id, COUNT_UNIT, None, to_taste=True))
    return lines
