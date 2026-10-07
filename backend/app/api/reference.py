from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import SessionDep
from app.api.errors import error_responses
from app.schemas import IngredientIn, IngredientOut, IngredientSuggestion, OptionsOut, TagIn, TagOut, UnitOut
from app.services import reference as reference_service

router = APIRouter(tags=["Reference data"])


@router.get("/options", response_model=OptionsOut, summary="Fixed lists for forms and filters")
def get_options() -> OptionsOut:
    return reference_service.options()


@router.get("/units", response_model=list[UnitOut], summary="Units for the ingredient unit dropdown")
def list_units() -> list[UnitOut]:
    return reference_service.units()


@router.get("/tags", response_model=list[TagOut], summary="List tags")
def list_tags(session: SessionDep) -> list[TagOut]:
    return reference_service.list_tags(session)


@router.post(
    "/tags",
    response_model=TagOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a tag",
    description="Returns the existing tag if one with the same key already exists (e.g. `Low cost` / `low-cost`).",
    responses=error_responses(422),
)
def create_tag(session: SessionDep, data: TagIn) -> TagOut:
    return reference_service.create_tag(session, data)


@router.get(
    "/ingredients",
    response_model=list[IngredientSuggestion],
    summary="Suggest ingredient names",
    description="Type-ahead for the recipe form: names starting with the text first, then names containing it.",
    responses=error_responses(422),
)
def suggest_ingredients(
    session: SessionDep,
    q: Annotated[str, Query(min_length=1, max_length=60, description="Text typed so far")],
    limit: Annotated[int, Query(ge=1, le=20)] = 10,
) -> list[IngredientSuggestion]:
    return reference_service.suggest_ingredients(session, q, limit)


@router.post(
    "/ingredients",
    response_model=IngredientOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add an ingredient",
    description=(
        "Adds a new ingredient for the recipe form's dropdown. If one with the same merge key already exists "
        "(e.g. `Onions` and `onion`), returns it with **200** and `created: false` instead of a duplicate."
    ),
    responses={200: {"model": IngredientOut, "description": "Already existed; the existing ingredient"}, **error_responses(422)},
)
def create_ingredient(session: SessionDep, data: IngredientIn, response: Response) -> IngredientOut:
    result = reference_service.create_ingredient(session, data)
    if not result.created:
        response.status_code = status.HTTP_200_OK
    return result
