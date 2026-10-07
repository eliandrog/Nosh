"""SQLModel tables. See TECHNICAL.md "Database schema" for the diagram and rules."""

import datetime as dt
import uuid

from sqlalchemy import CheckConstraint, Column, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlmodel import Field, Relationship, SQLModel

from app.constants import SHOPPING_UNITS, UNITS, Cuisine, DietaryLabel, MealType, PlaceMealKind, PlaceType

_UNIT_KEYS_SQL = ", ".join(f"'{u.key}'" for u in UNITS if u.key is not None)
_SHOPPING_UNITS_SQL = ", ".join(f"'{u}'" for u in SHOPPING_UNITS)


def _enum_column(enum: type, name: str, primary_key: bool = False) -> Column:
    """Stored as text, with a CHECK constraint so the DB rejects values outside the enum."""
    return Column(
        SAEnum(enum, name=name, native_enum=False, create_constraint=True, values_callable=lambda e: [m.value for m in e]),
        primary_key=primary_key,
        nullable=False,
    )


def _now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


class Recipe(SQLModel, table=True):
    # Table models aren't validated by SQLModel, so rules live in the DB too.
    __table_args__ = (CheckConstraint("serves >= 1", name="ck_recipe_serves"),)

    # Stable internal identifier; all other tables link to this, so renames never break links.
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # URL-friendly name ("nans-veggie-stew"), see app/recipe_ids.py. Unique across all recipes,
    # deleted ones included, so a slug is never reused; active-name clashes are blocked in code.
    slug: str = Field(unique=True, index=True)
    name: str
    cuisine: Cuisine = Field(sa_column=_enum_column(Cuisine, "cuisine"))
    serves: int  # always 1 or more (DB check + API schema)
    is_custom: bool = False
    image_url: str | None = None
    deleted: bool = False  # soft delete

    ingredients: list["RecipeIngredient"] = Relationship(
        back_populates="recipe",
        sa_relationship_kwargs={"order_by": "RecipeIngredient.position", "cascade": "all, delete-orphan"},
    )
    method_steps: list["MethodStep"] = Relationship(
        back_populates="recipe",
        sa_relationship_kwargs={"order_by": "MethodStep.position", "cascade": "all, delete-orphan"},
    )
    meal_types: list["RecipeMealType"] = Relationship(
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    dietary: list["RecipeDietary"] = Relationship(
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    tags: list["RecipeTag"] = Relationship(
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Ingredient(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str  # first-seen spelling, used for display
    name_key: str = Field(unique=True)  # merge key (lowercase -> alias -> plural rule)


class RecipeIngredient(SQLModel, table=True):
    __tablename__ = "recipe_ingredient"
    __table_args__ = (
        CheckConstraint(f"unit IS NULL OR unit IN ({_UNIT_KEYS_SQL})", name="ck_recipe_ingredient_unit"),
        CheckConstraint("quantity IS NULL OR quantity > 0", name="ck_recipe_ingredient_quantity"),
    )

    recipe_id: uuid.UUID = Field(foreign_key="recipe.id", primary_key=True, ondelete="CASCADE")
    position: int = Field(primary_key=True)
    ingredient_id: int = Field(foreign_key="ingredient.id", index=True)
    quantity: float | None = None  # None = "to taste"
    unit: str | None = None  # None = counted items
    prep: str | None = None

    recipe: Recipe = Relationship(back_populates="ingredients")
    ingredient: Ingredient = Relationship()


class MethodStep(SQLModel, table=True):
    __tablename__ = "method_step"
    __table_args__ = (UniqueConstraint("recipe_id", "position"),)

    id: int | None = Field(default=None, primary_key=True)
    recipe_id: uuid.UUID = Field(foreign_key="recipe.id", index=True, ondelete="CASCADE")
    position: int
    text: str

    recipe: Recipe = Relationship(back_populates="method_steps")


class RecipeMealType(SQLModel, table=True):
    __tablename__ = "recipe_meal_type"

    recipe_id: uuid.UUID = Field(foreign_key="recipe.id", primary_key=True, ondelete="CASCADE")
    # At least one per recipe: enforced on input (seed + API), not expressible as a simple constraint.
    meal_type: MealType = Field(sa_column=_enum_column(MealType, "meal_type", primary_key=True))


class RecipeDietary(SQLModel, table=True):
    __tablename__ = "recipe_dietary"

    recipe_id: uuid.UUID = Field(foreign_key="recipe.id", primary_key=True, ondelete="CASCADE")
    label: DietaryLabel = Field(sa_column=_enum_column(DietaryLabel, "dietary_label", primary_key=True))


class Tag(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    key: str = Field(unique=True)  # e.g. "low-cost"
    name: str  # e.g. "Low cost"
    is_builtin: bool = False


class RecipeTag(SQLModel, table=True):
    __tablename__ = "recipe_tag"

    recipe_id: uuid.UUID = Field(foreign_key="recipe.id", primary_key=True, ondelete="CASCADE")
    tag_id: int = Field(foreign_key="tag.id", primary_key=True, ondelete="CASCADE")

    tag: Tag = Relationship()


class Place(SQLModel, table=True):
    """A place sharing free meals (Free meals nearby). Location is a postcode plus its coordinates."""

    __table_args__ = (
        CheckConstraint("latitude BETWEEN -90 AND 90", name="ck_place_latitude"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="ck_place_longitude"),
    )

    id: int | None = Field(default=None, primary_key=True)
    name: str
    type: PlaceType = Field(sa_column=_enum_column(PlaceType, "place_type"))
    postcode: str
    latitude: float = Field(index=True)
    longitude: float = Field(index=True)
    is_demo: bool = False  # seeded demo data: fictional names, real postcodes

    meals: list["PlaceMeal"] = Relationship(
        back_populates="place",
        sa_relationship_kwargs={"order_by": "PlaceMeal.weekday, PlaceMeal.start_time", "cascade": "all, delete-orphan"},
    )


class PlaceMeal(SQLModel, table=True):
    """A meal a place shares every week on one weekday (not fixed dates, so data stays valid)."""

    __tablename__ = "place_meal"
    __table_args__ = (
        CheckConstraint("weekday BETWEEN 0 AND 6", name="ck_place_meal_weekday"),  # 0 = Monday
        CheckConstraint("start_time < end_time", name="ck_place_meal_times"),
        CheckConstraint("serves >= 1", name="ck_place_meal_serves"),
    )

    id: int | None = Field(default=None, primary_key=True)
    place_id: int = Field(foreign_key="place.id", index=True, ondelete="CASCADE")
    name: str
    kind: PlaceMealKind = Field(sa_column=_enum_column(PlaceMealKind, "place_meal_kind"))
    weekday: int
    start_time: dt.time
    end_time: dt.time
    serves: int  # people one portion/parcel feeds
    serves_note: str | None = None  # e.g. "feeds 4 for about 3 days"

    place: Place = Relationship(back_populates="meals")
    dietary: list["PlaceMealDietary"] = Relationship(sa_relationship_kwargs={"cascade": "all, delete-orphan"})


class PlaceMealDietary(SQLModel, table=True):
    __tablename__ = "place_meal_dietary"

    place_meal_id: int = Field(foreign_key="place_meal.id", primary_key=True, ondelete="CASCADE")
    label: DietaryLabel = Field(sa_column=_enum_column(DietaryLabel, "place_meal_dietary_label", primary_key=True))


class PlanEntry(SQLModel, table=True):
    __tablename__ = "plan_entry"
    __table_args__ = (
        CheckConstraint("servings >= 1", name="ck_plan_entry_servings"),
        # A planned meal is either a recipe or a free meal from a place, never both or neither.
        CheckConstraint(
            "(recipe_id IS NOT NULL) + (place_meal_id IS NOT NULL) = 1", name="ck_plan_entry_recipe_or_place_meal"
        ),
        # One meal per position per day. New meals go to max(position) + 1; reordering
        # rewrites the day's positions in one transaction.
        UniqueConstraint("date", "position", name="uq_plan_entry_date_position"),
    )

    id: int | None = Field(default=None, primary_key=True)
    date: dt.date = Field(index=True)
    position: int = 0  # order within the day; unlimited meals per day
    # Kept for soft-deleted recipes so past weeks still show them.
    recipe_id: uuid.UUID | None = Field(default=None, foreign_key="recipe.id", index=True)
    place_meal_id: int | None = Field(default=None, foreign_key="place_meal.id", index=True)
    servings: int = 1

    recipe: Recipe | None = Relationship()
    place_meal: PlaceMeal | None = Relationship()


class ShoppingListItem(SQLModel, table=True):
    """A stored line of a week's shopping list.

    Rebuilt from the plan whenever the current or a future week changes; past weeks are
    never rebuilt, so they keep what was actually shopped for. Lines whose units can't be
    converted stay separate (e.g. coconut milk in "ml" and in "tin").
    """

    __tablename__ = "shopping_list_item"
    __table_args__ = (
        UniqueConstraint("week_start", "ingredient_id", "unit"),
        CheckConstraint("quantity IS NULL OR quantity > 0", name="ck_shopping_list_item_quantity"),
        # A line always has an amount, or is "to taste", or both ("5 ml + to taste").
        CheckConstraint("quantity IS NOT NULL OR to_taste = 1", name="ck_shopping_list_item_amount_or_to_taste"),
        CheckConstraint(f"unit IN ({_SHOPPING_UNITS_SQL})", name="ck_shopping_list_item_unit"),
    )

    id: int | None = Field(default=None, primary_key=True)
    week_start: dt.date = Field(index=True)  # Monday of the week
    ingredient_id: int = Field(foreign_key="ingredient.id")
    unit: str  # merged unit: "g", "ml", "item", "tin", ... (never NULL so the unique rule works)
    quantity: float | None = None  # merged, scaled total of the lines that have an amount
    # True if any recipe uses this ingredient "to taste". If others give an amount, the amount
    # wins and the line reads "5 ml + to taste"; if none do, quantity is None ("to taste").
    to_taste: bool = False
    ticked: bool = False

    ingredient: Ingredient = Relationship()


class Profile(SQLModel, table=True):
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_profile_single_row"),
        CheckConstraint("household_size IS NULL OR household_size >= 1", name="ck_profile_household_size"),
    )

    id: int = Field(default=1, primary_key=True)  # single row
    name: str | None = None
    email: str | None = None
    household_size: int | None = None  # default servings; 1 or more (DB check)


class ShoppingListUpdate(SQLModel, table=True):
    """What changed in a week's shopping list since the user last dismissed the banner.

    Each rebuild adds its counts to the week's row; dismissing the banner sets dismissed=True
    (the next change resets the counts and shows the banner again).
    """

    __tablename__ = "shopping_list_update"
    __table_args__ = (CheckConstraint("added >= 0 AND removed >= 0 AND changed >= 0", name="ck_shopping_list_update_counts"),)

    week_start: dt.date = Field(primary_key=True)  # Monday of the week
    added: int = 0
    removed: int = 0
    changed: int = 0  # quantity went up or down
    updated_at: dt.datetime = Field(default_factory=_now)
    dismissed: bool = False


class DietaryPreference(SQLModel, table=True):
    __tablename__ = "dietary_preference"

    # The user's chosen dietary needs (single user): one row per selected label.
    label: DietaryLabel = Field(sa_column=_enum_column(DietaryLabel, "dietary_preference_label", primary_key=True))


__all__ = [
    "DietaryPreference",
    "Ingredient",
    "MethodStep",
    "Place",
    "PlaceMeal",
    "PlaceMealDietary",
    "PlanEntry",
    "Profile",
    "Recipe",
    "RecipeDietary",
    "RecipeIngredient",
    "RecipeMealType",
    "RecipeTag",
    "ShoppingListItem",
    "ShoppingListUpdate",
    "Tag",
]
