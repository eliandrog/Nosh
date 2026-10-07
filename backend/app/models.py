"""SQLModel tables. See TECHNICAL.md "Database schema" for the diagram and rules."""

import datetime as dt
import uuid

from sqlalchemy import CheckConstraint, Column, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlmodel import Field, Relationship, SQLModel

from app.constants import DietaryLabel, MealType


def _enum_column(enum: type, name: str) -> Column:
    """Stored as text, with a CHECK constraint so the DB rejects values outside the enum."""
    return Column(
        SAEnum(enum, name=name, native_enum=False, create_constraint=True, values_callable=lambda e: [m.value for m in e]),
        primary_key=True,
    )


def _now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


class Recipe(SQLModel, table=True):
    # Stable internal identifier; all other tables link to this, so renames never break links.
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # URL-friendly name ("nans-veggie-stew"), see app/recipe_ids.py. Unique across all recipes,
    # deleted ones included, so a slug is never reused; active-name clashes are blocked in code.
    slug: str = Field(unique=True, index=True)
    name: str
    cuisine: str
    serves: int = Field(ge=1)
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
    meal_type: MealType = Field(sa_column=_enum_column(MealType, "meal_type"))


class RecipeDietary(SQLModel, table=True):
    __tablename__ = "recipe_dietary"

    recipe_id: uuid.UUID = Field(foreign_key="recipe.id", primary_key=True, ondelete="CASCADE")
    label: DietaryLabel = Field(sa_column=_enum_column(DietaryLabel, "dietary_label"))


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


class PlanEntry(SQLModel, table=True):
    __tablename__ = "plan_entry"
    __table_args__ = (CheckConstraint("servings >= 1", name="ck_plan_entry_servings"),)

    id: int | None = Field(default=None, primary_key=True)
    date: dt.date = Field(index=True)
    position: int = 0  # order within the day; unlimited meals per day
    # Kept for soft-deleted recipes so past weeks still show them.
    recipe_id: uuid.UUID = Field(foreign_key="recipe.id", index=True)
    servings: int = 1
    created_at: dt.datetime = Field(default_factory=_now)


class ShoppingTick(SQLModel, table=True):
    __tablename__ = "shopping_tick"

    week_start: dt.date = Field(primary_key=True)  # Monday
    line_key: str = Field(primary_key=True)  # ingredient_id + unit group
    ticked_at: dt.datetime = Field(default_factory=_now)


class Profile(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)  # single row
    name: str | None = None
    email: str | None = None
    household_size: int | None = Field(default=None, ge=1)


class DietaryPreference(SQLModel, table=True):
    __tablename__ = "dietary_preference"

    label: str = Field(primary_key=True)


__all__ = [
    "DietaryPreference",
    "Ingredient",
    "MethodStep",
    "PlanEntry",
    "Profile",
    "Recipe",
    "RecipeDietary",
    "RecipeIngredient",
    "RecipeMealType",
    "RecipeTag",
    "ShoppingTick",
    "Tag",
]
