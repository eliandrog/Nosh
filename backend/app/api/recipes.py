from typing import Annotated

from fastapi import APIRouter, Path, Query, Response, status

from app.api.deps import SessionDep, TodayDep
from app.api.errors import error_responses
from app.constants import DietaryLabel, MealType
from app.core.errors import ValidationFailed
from app.schemas import RecipeCreate, RecipeDetail, RecipePage, RecipeUsageOut
from app.services import recipes as recipe_service

router = APIRouter(prefix="/recipes", tags=["Recipes"])

SlugPath = Annotated[str, Path(description="Recipe slug, e.g. `lentil-dahl`")]


def _csv(value: str | None) -> list[str]:
    return [v.strip() for v in (value or "").split(",") if v.strip()]


def _enum_list(value: str | None, enum: type, field: str) -> list:
    items = _csv(value)
    try:
        return [enum(v) for v in items]
    except ValueError:
        allowed = ", ".join(e.value for e in enum)
        raise ValidationFailed("Some details need fixing.", fields={field: f"Use any of: {allowed}."}) from None


@router.get(
    "",
    response_model=RecipePage,
    summary="List recipes (paged)",
    description=(
        "Search and filter recipes, one page at a time (ordered by name). Dietary filter defaults to the saved "
        "preferences unless `dietary` is given or `all=true`. Dietary labels must **all** match (vegetarian also "
        "accepts vegan); meal types and tags match **any**. Search covers recipe names and ingredients. "
        "A page past the end returns no items with the correct `total`."
    ),
    responses=error_responses(422),
)
def list_recipes(
    session: SessionDep,
    q: Annotated[str | None, Query(description="Search text (name or ingredient)", max_length=100)] = None,
    meal_type: Annotated[str | None, Query(alias="mealType", description="Comma-separated, e.g. `lunch,dinner`")] = None,
    dietary: Annotated[str | None, Query(description="Comma-separated, e.g. `vegetarian,gluten-free`")] = None,
    tag: Annotated[str | None, Query(description="Comma-separated tag keys, e.g. `quick,low-cost`")] = None,
    include_all: Annotated[bool, Query(alias="all", description="Ignore saved dietary preferences")] = False,
    page: Annotated[int, Query(ge=1, description="Page number, starting at 1")] = 1,
    page_size: Annotated[
        int, Query(alias="pageSize", ge=1, le=recipe_service.MAX_PAGE_SIZE, description="Recipes per page")
    ] = recipe_service.DEFAULT_PAGE_SIZE,
) -> RecipePage:
    return recipe_service.list_recipes(
        session,
        q=q,
        meal_types=_enum_list(meal_type, MealType, "mealType"),
        dietary=_enum_list(dietary, DietaryLabel, "dietary") if dietary is not None else None,
        tag_keys=_csv(tag),
        include_all=include_all,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{slug}",
    response_model=RecipeDetail,
    summary="Get a recipe",
    description="Full recipe. Pass `servings` to scale ingredient amounts.",
    responses=error_responses(404, 422),
)
def get_recipe(
    session: SessionDep,
    slug: SlugPath,
    servings: Annotated[int | None, Query(ge=1, le=50, description="Scale amounts to this many servings")] = None,
) -> RecipeDetail:
    return recipe_service.get_recipe_detail(session, slug, servings)


@router.post(
    "",
    response_model=RecipeDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a recipe",
    description="Adds a custom recipe. Unknown tag names are created. The slug is made from the name.",
    responses=error_responses(409, 422),
)
def create_recipe(session: SessionDep, data: RecipeCreate) -> RecipeDetail:
    return recipe_service.create_recipe(session, data)


@router.put(
    "/{slug}",
    response_model=RecipeDetail,
    summary="Update a recipe",
    description="Replaces a custom recipe. Built-in recipes are read-only. Renaming updates the slug.",
    responses=error_responses(403, 404, 409, 422),
)
def update_recipe(session: SessionDep, slug: SlugPath, data: RecipeCreate, today: TodayDep) -> RecipeDetail:
    return recipe_service.update_recipe(session, slug, data, today)


@router.delete(
    "/{slug}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Delete a recipe",
    description="Soft-deletes a custom recipe: removed from today and future days, kept in past weeks.",
    responses=error_responses(403, 404),
)
def delete_recipe(session: SessionDep, slug: SlugPath, today: TodayDep) -> Response:
    recipe_service.delete_recipe(session, slug, today)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{slug}/usage",
    response_model=RecipeUsageOut,
    summary="Count upcoming planned meals",
    description="Used by the delete confirmation: how many meals from today onwards use this recipe.",
    responses=error_responses(404),
)
def recipe_usage(session: SessionDep, slug: SlugPath, today: TodayDep) -> RecipeUsageOut:
    return recipe_service.recipe_usage(session, slug, today)
