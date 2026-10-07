"""API request/response shapes (sketch for the next branch, feature/recipes-api).

JSON is camelCase on the wire; Python stays snake_case. These are kept separate
from the SQLModel tables so the API contract can differ from the storage shape.
Errors use app.core.errors.ErrorResponse: {"error": {code, message, details?, requestId}}."""

import datetime as dt
import uuid

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.constants import Cuisine, DietaryLabel, MealType


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class UnitOut(ApiModel):
    key: str | None
    label: str
    group: str


class OptionsOut(ApiModel):
    """GET /api/options: the fixed lists, typed as enums so clients get exact values."""

    meal_types: list[MealType]
    dietary_labels: list[DietaryLabel]
    cuisines: list[Cuisine]


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


class RecipePage(ApiModel):
    """GET /api/recipes: one page of results. A page past the end has no items but the right totals."""

    items: list[RecipeSummary]
    total: int  # matching recipes across all pages
    page: int  # 1-based
    page_size: int
    total_pages: int  # at least 1


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


class TagIn(ApiModel):
    """POST /api/tags (the recipe form can also send new tag names directly)."""

    name: str = Field(min_length=1, max_length=40)


# ---------- Settings ----------


class PreferencesOut(ApiModel):
    dietary: list[DietaryLabel]


class PreferencesIn(ApiModel):
    dietary: list[DietaryLabel] = []


class ProfileOut(ApiModel):
    name: str | None
    email: str | None
    household_size: int | None  # default servings when adding a meal


class ProfileIn(ApiModel):
    name: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    household_size: int | None = Field(default=None, ge=1)


# ---------- Week plan ----------


class PlanEntryOut(ApiModel):
    id: int
    date: dt.date
    position: int  # order within the day
    recipe_id: uuid.UUID
    recipe_slug: str
    recipe_name: str
    recipe_deleted: bool  # past meals can show "(deleted)"
    servings: int


class PlanDayOut(ApiModel):
    date: dt.date
    entries: list[PlanEntryOut]


class WeekPlanOut(ApiModel):
    """GET /api/plan?week=YYYY-MM-DD (any date in the week; defaults to this week)."""

    week_start: dt.date  # Monday
    days: list[PlanDayOut]  # always 7, Monday to Sunday


class PlanEntryCreate(ApiModel):
    """POST /api/plan/entries. The meal goes last on that day."""

    date: dt.date
    recipe_id: uuid.UUID
    servings: int = Field(ge=1)


class PlanEntryUpdate(ApiModel):
    """PATCH /api/plan/entries/{id}: change servings, swap recipe, move day or reorder."""

    date: dt.date | None = None
    position: int | None = Field(default=None, ge=0)
    recipe_id: uuid.UUID | None = None
    servings: int | None = Field(default=None, ge=1)


class PlanDaysOut(ApiModel):
    """GET /api/plan/days?month=YYYY-MM: days with meals, for the calendar dots."""

    month: str
    dates: list[dt.date]


# ---------- Shopping list ----------


class ShoppingListItemOut(ApiModel):
    id: int
    ingredient_id: int
    name: str
    unit: str  # "g", "ml", "item", "tin", ...
    quantity: float | None  # None with toTaste = "to taste"
    to_taste: bool  # amount + toTaste reads "5 ml + to taste"
    ticked: bool
    used_in: list[str]  # recipe names planned this week that use it (computed live)


class ShoppingListChangesOut(ApiModel):
    added: int
    removed: int
    changed: int


class ShoppingListOut(ApiModel):
    """GET /api/shopping-list?week=YYYY-MM-DD."""

    week_start: dt.date
    items: list[ShoppingListItemOut]
    changes: ShoppingListChangesOut | None  # None = no "List updated" banner to show


class ShoppingTickIn(ApiModel):
    """PATCH /api/shopping-list/items/{id}."""

    ticked: bool


# Published in the OpenAPI spec (components.schemas) even before their endpoints exist,
# so the frontend can generate its TypeScript types from one source of truth.
CONTRACT_MODELS: tuple[type[BaseModel], ...] = (
    UnitOut,
    OptionsOut,
    TagOut,
    TagIn,
    RecipeSummary,
    RecipePage,
    RecipeDetail,
    IngredientLine,
    IngredientLineIn,
    RecipeCreate,
    RecipeUsageOut,
    IngredientSuggestion,
    PreferencesOut,
    PreferencesIn,
    ProfileOut,
    ProfileIn,
    PlanEntryOut,
    PlanDayOut,
    WeekPlanOut,
    PlanEntryCreate,
    PlanEntryUpdate,
    PlanDaysOut,
    ShoppingListItemOut,
    ShoppingListChangesOut,
    ShoppingListOut,
    ShoppingTickIn,
)
