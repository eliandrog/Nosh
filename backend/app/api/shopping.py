import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Path, Query, Response, status

from app.api.deps import SessionDep, TodayDep
from app.api.errors import error_responses
from app.schemas import ShoppingListItemOut, ShoppingListOut, ShoppingTickIn
from app.services import shopping as shopping_service

router = APIRouter(prefix="/shopping-list", tags=["Shopping list"])

WeekQuery = Annotated[dt.date | None, Query(description="Any date in the week (YYYY-MM-DD); defaults to today")]


@router.get(
    "",
    response_model=ShoppingListOut,
    summary="Get a week's shopping list",
    description=(
        "Everything the week's meals need, scaled by servings, converted (kg→g, l/tsp/tbsp→ml) and added up. "
        "Current and future weeks are recalculated from the plan; past weeks show what was shopped for. "
        "`changes` is set when the list changed since the banner was last dismissed."
    ),
    responses=error_responses(422),
)
def get_shopping_list(session: SessionDep, today: TodayDep, week: WeekQuery = None) -> ShoppingListOut:
    return shopping_service.get_list(session, week or today, today)


@router.patch(
    "/items/{item_id}",
    response_model=ShoppingListItemOut,
    summary="Tick or untick an item",
    responses=error_responses(404, 422),
)
def set_ticked(
    session: SessionDep,
    item_id: Annotated[int, Path(ge=1, description="Shopping list item id")],
    data: ShoppingTickIn,
) -> ShoppingListItemOut:
    return shopping_service.set_ticked(session, item_id, data.ticked)


@router.delete(
    "/ticks",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Clear ticked items",
    description="Unticks every item on that week's list.",
    responses=error_responses(422),
)
def clear_ticked(session: SessionDep, today: TodayDep, week: WeekQuery = None) -> Response:
    shopping_service.clear_ticked(session, week or today)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/changes/dismiss",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Dismiss the 'List updated' banner",
    responses=error_responses(422),
)
def dismiss_changes(session: SessionDep, today: TodayDep, week: WeekQuery = None) -> Response:
    shopping_service.dismiss_changes(session, week or today)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
