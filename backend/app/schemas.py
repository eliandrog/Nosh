"""API request/response shapes (sketch for the next branch, feature/recipes-api).

JSON is camelCase on the wire; Python stays snake_case. These are kept separate
from the SQLModel tables so the API contract can differ from the storage shape.
Errors use app.core.errors.ErrorResponse: {"error": {code, message, details?, requestId}}."""

import uuid

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.constants import CUISINES, DIETARY_LABELS, MEAL_TYPES, Cuisine, DietaryLabel, MealType


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class UnitOut(ApiModel):
    key: str | None
    label: str
    group: str


class OptionsOut(ApiModel):
    meal_types: list[str] = list(MEAL_TYPES)
    dietary_labels: list[str] = list(DIETARY_LABELS)
    cuisines: list[str] = list(CUISINES)


class TagOut(ApiModel):
    key: str
    name: str
    is_builtin: bool


class RecipeSummary(ApiModel):
    """GET /api/recipes item."""

    id: uuid.UUID  # stable internal id
    slug: str  # used in URLs: /api/recipes/{slug}
    name: str
    cuisine: Cuisine
    serves: int
    meal_types: list[MealType]
    dietary: list[DietaryLabel]
    tags: list[TagOut]
    is_custom: bool
    image_url: str | None
    default_image: str  # ASSUMPTION (5): emoji per first meal type for now


class IngredientLine(ApiModel):
    ingredient_id: int
    item: str
    quantity: float | None  # None = "to taste"
    unit: str | None  # None = counted items
    prep: str | None = None


class RecipeDetail(RecipeSummary):
    """GET /api/recipes/{id}?servings=N. Quantities are scaled when servings is given."""

    servings: int
    ingredients: list[IngredientLine]
    method: list[str]


class IngredientLineIn(ApiModel):
    item: str = Field(min_length=1)
    quantity: float | None = Field(default=None, gt=0)
    unit: str | None = None  # validated against UNITS_BY_KEY in the endpoint
    prep: str | None = None


class RecipeCreate(ApiModel):
    """POST /api/recipes and PUT /api/recipes/{id} (custom recipes only)."""

    name: str = Field(min_length=1)
    cuisine: Cuisine
    serves: int = Field(ge=1)  # always 1 or more
    meal_types: list[MealType] = Field(min_length=1)  # one or more
    dietary: list[DietaryLabel] = []  # zero or more
    # Zero or more tag names; any that don't exist yet are created on save (see app/tags.py).
    tags: list[str] = []
    ingredients: list[IngredientLineIn] = Field(min_length=1)
    method: list[str] = Field(min_length=1)


class RecipeUsageOut(ApiModel):
    """ASSUMPTION (3): GET /api/recipes/{id}/usage -> {"upcomingMeals": N} for the delete confirmation."""

    upcoming_meals: int


class IngredientSuggestion(ApiModel):
    """ASSUMPTION (1): GET /api/ingredients?q= returns matching ingredient names for the form."""

    id: int
    name: str
