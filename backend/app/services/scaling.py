"""Scale recipe quantities to a number of servings, with sensible rounding.

Recipe view rules (the shopping list rounds packs up separately):
- g, ml: nearest whole number; kg, l: 2 decimals
- tsp, tbsp, tin, ball, thumb, handful: nearest half (never below ½)
- counted items (no unit), clove, slice, rasher: round up to whole items
- "to taste" (no quantity): never scaled
"""

import math

_HALVES = {"tsp", "tbsp", "tin", "ball", "thumb", "handful"}
_WHOLE_UP = {None, "clove", "slice", "rasher"}
_TWO_DP = {"kg", "l"}


def scale_quantity(quantity: float | None, unit: str | None, factor: float) -> float | None:
    if quantity is None:
        return None
    value = quantity * factor
    if unit in _WHOLE_UP:
        return float(math.ceil(value - 1e-9))
    if unit in _HALVES:
        return max(0.5, round(value * 2) / 2)
    if unit in _TWO_DP:
        return round(value, 2)
    return float(max(1, round(value)))
