import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Path, Query, Response, status

from app.api.deps import SessionDep, TodayDep
from app.api.errors import error_responses
from app.schemas import PlanDaysOut, PlanEntryCreate, PlanEntryOut, PlanEntryUpdate, WeekPlanOut
from app.services import plan as plan_service

router = APIRouter(prefix="/plan", tags=["Week plan"])

EntryId = Annotated[int, Path(description="Plan entry id", ge=1)]


@router.get(
    "",
    response_model=WeekPlanOut,
    summary="Get a week's plan",
    description="Monday to Sunday with each day's meals in order. `week` can be any date in the week; defaults to today.",
    responses=error_responses(422),
)
def get_week(
    session: SessionDep,
    today: TodayDep,
    week: Annotated[dt.date | None, Query(description="Any date in the week (YYYY-MM-DD)")] = None,
) -> WeekPlanOut:
    return plan_service.get_week(session, week or today)


@router.get(
    "/days",
    response_model=PlanDaysOut,
    summary="Days with meals in a month",
    description="For the calendar picker's dots.",
    responses=error_responses(422),
)
def planned_days(
    session: SessionDep,
    month: Annotated[str, Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", description="YYYY-MM")],
) -> PlanDaysOut:
    return plan_service.planned_days(session, month)


@router.post(
    "/entries",
    response_model=PlanEntryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a meal to a day",
    description="The meal goes last on that day. Unlimited meals per day.",
    responses=error_responses(404, 422),
)
def add_entry(session: SessionDep, data: PlanEntryCreate) -> PlanEntryOut:
    return plan_service.add_entry(session, data)


@router.patch(
    "/entries/{entry_id}",
    response_model=PlanEntryOut,
    summary="Change a planned meal",
    description="Change servings, swap the recipe, move it to another day (goes last there) or reorder it within its day.",
    responses=error_responses(404, 422),
)
def update_entry(session: SessionDep, entry_id: EntryId, data: PlanEntryUpdate) -> PlanEntryOut:
    return plan_service.update_entry(session, entry_id, data)


@router.delete(
    "/entries/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Remove a meal from the plan",
    responses=error_responses(404),
)
def delete_entry(session: SessionDep, entry_id: EntryId) -> Response:
    plan_service.delete_entry(session, entry_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
