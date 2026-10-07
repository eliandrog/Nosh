"""Fixed reference lists. These live in code (not tables) and are served via
GET /api/units and GET /api/options."""

from dataclasses import dataclass
from enum import StrEnum


@dataclass(frozen=True)
class Unit:
    key: str | None  # None = counted items ("2 onions"), matching the JSON's null unit
    label: str
    group: str  # weight | volume | count | pack
    base: str | None  # unit it converts to when merging, None = never converted
    factor: float = 1.0  # multiply by this to get the base unit


UNITS: tuple[Unit, ...] = (
    Unit("g", "g", "weight", "g"),
    Unit("kg", "kg", "weight", "g", 1000),
    Unit("ml", "ml", "volume", "ml"),
    Unit("l", "l", "volume", "ml", 1000),
    Unit("tsp", "tsp", "volume", "ml", 5),
    Unit("tbsp", "tbsp", "volume", "ml", 15),
    Unit(None, "item", "count", None),
    Unit("tin", "tin", "pack", None),
    Unit("clove", "clove", "pack", None),
    Unit("slice", "slice", "pack", None),
    Unit("rasher", "rasher", "pack", None),
    Unit("ball", "ball", "pack", None),
    Unit("thumb", "thumb", "pack", None),
    Unit("handful", "handful", "pack", None),
)
UNITS_BY_KEY: dict[str | None, Unit] = {u.key: u for u in UNITS}

class MealType(StrEnum):
    """What a recipe suits. A recipe has one or more; used as a filter (the plan has no fixed slots)."""

    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    DESSERT = "dessert"  # shown as "Pudding" in the UI


class DietaryLabel(StrEnum):
    """Fixed list used for filtering. A recipe has zero or more."""

    VEGETARIAN = "vegetarian"
    VEGAN = "vegan"
    GLUTEN_FREE = "gluten-free"
    DAIRY_FREE = "dairy-free"


MEAL_TYPES: tuple[str, ...] = tuple(m.value for m in MealType)
DIETARY_LABELS: tuple[str, ...] = tuple(d.value for d in DietaryLabel)
CUISINES: tuple[str, ...] = (
    "british",
    "chinese",
    "indian",
    "italian",
    "mediterranean",
    "mexican",
    "thai",
    "other",
)

# ASSUMPTION (5): default recipe images are an emoji per first meal type for now;
# outline icons can replace these later without an API change.
DEFAULT_MEAL_EMOJI: dict[str, str] = {
    "breakfast": "🥣",
    "lunch": "🥪",
    "dinner": "🍲",
    "dessert": "🍰",
}
