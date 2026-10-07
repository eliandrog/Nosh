"""Week plan rules. Each day is a list of meals (no fixed slots), ordered by position.

- New meals go last on their day.
- Only active recipes can be planned or swapped in; past meals keep soft-deleted recipes.
- A planned meal can instead be a free meal from a place (Free meals nearby); it can only go on
  the weekday that place serves it, and the shopping list skips it.
- Moving a meal puts it last on the new day; reordering rewrites that day's positions.
"""

import calendar
import datetime as dt
import uuid
from collections import defaultdict

from sqlmodel import Session

from app.core.dates import week_start
from app.core.errors import NotFoundError, ValidationFailed
from app.models import PlaceMeal, PlanEntry, Recipe
from app.repositories import plan as plan_repo
from app.repositories import recipes as recipe_repo
from app.schemas import (
    PlanDayOut,
    PlanDaysOut,
    PlanEntryCreate,
    PlanEntryOut,
    PlanEntryUpdate,
    PlanPlaceMealOut,
    WeekPlanOut,
)
from app.services import places as place_service
from app.services import shopping as shopping_service
from app.services.recipes import RecipeNotFound


class PlanEntryNotFound(NotFoundError):
    code = "plan_entry_not_found"


WEEKDAYS = ("Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays")


def to_entry_out(entry: PlanEntry) -> PlanEntryOut:
    common = {"id": entry.id, "date": entry.date, "position": entry.position, "servings": entry.servings}
    if entry.place_meal is not None:
        meal = entry.place_meal
        return PlanEntryOut(
            **common,
            kind="free_meal",
            recipe_id=None,
            recipe_slug=None,
            recipe_name=None,
            recipe_deleted=False,
            place_meal=PlanPlaceMealOut(
                id=meal.id,
                name=meal.name,
                kind=meal.kind,
                place_id=meal.place_id,
                place_name=meal.place.name,
                start_time=meal.start_time,
                end_time=meal.end_time,
            ),
        )
    return PlanEntryOut(
        **common,
        kind="recipe",
        recipe_id=entry.recipe_id,
        recipe_slug=entry.recipe.slug,
        recipe_name=entry.recipe.name,
        recipe_deleted=entry.recipe.deleted,
    )


def _check_weekday(meal: PlaceMeal, day: dt.date) -> None:
    if day.weekday() != meal.weekday:
        when = WEEKDAYS[meal.weekday]
        raise ValidationFailed(
            f"{meal.name} is only served on {when}.", fields={"date": f"Pick a day this meal is served: {when}."}
        )


def get_week(session: Session, day: dt.date) -> WeekPlanOut:
    start = week_start(day)
    days = [start + dt.timedelta(days=i) for i in range(7)]
    by_day: dict[dt.date, list[PlanEntryOut]] = defaultdict(list)
    for entry in plan_repo.list_between(session, days[0], days[-1]):
        by_day[entry.date].append(to_entry_out(entry))
    return WeekPlanOut(week_start=start, days=[PlanDayOut(date=d, entries=by_day[d]) for d in days])


def planned_days(session: Session, month: str) -> PlanDaysOut:
    """Days in the month (YYYY-MM) that have at least one meal, for the calendar dots."""
    try:
        year, mon = (int(part) for part in month.split("-"))
        first = dt.date(year, mon, 1)
    except ValueError:
        raise ValidationFailed("Some details need fixing.", fields={"month": "Use the format YYYY-MM."}) from None
    last = first.replace(day=calendar.monthrange(year, mon)[1])
    return PlanDaysOut(month=month, dates=plan_repo.planned_dates(session, first, last))


def _active_recipe(session: Session, recipe_id: uuid.UUID) -> Recipe:
    recipe = recipe_repo.get_by_id(session, recipe_id)
    if recipe is None or recipe.deleted:
        raise RecipeNotFound("We couldn't find that recipe.")
    return recipe


def _get_entry(session: Session, entry_id: int) -> PlanEntry:
    entry = plan_repo.get(session, entry_id)
    if entry is None:
        raise PlanEntryNotFound("We couldn't find that meal in your plan.")
    return entry


def add_entry(session: Session, data: PlanEntryCreate, today: dt.date) -> PlanEntryOut:
    if data.place_meal_id is not None:
        meal = place_service.get_meal(session, data.place_meal_id)
        _check_weekday(meal, data.date)
        source = {"place_meal": meal}
    else:
        source = {"recipe": _active_recipe(session, data.recipe_id)}
    position = plan_repo.next_position(session, data.date)
    entry = plan_repo.add(session, PlanEntry(date=data.date, position=position, servings=data.servings, **source))
    session.flush()
    shopping_service.rebuild_week(session, entry.date, today)
    session.commit()
    return to_entry_out(entry)


def _reorder(session: Session, entry: PlanEntry, position: int) -> None:
    """Put `entry` at `position` on its day and renumber the day 0..n-1 (positions are unique per day)."""
    others = [e for e in plan_repo.list_day(session, entry.date) if e.id != entry.id]
    ordered = others[:position] + [entry] + others[position:]
    for i, e in enumerate(ordered):  # step 1: move clear of the unique rule, then renumber
        e.position = -(i + 1)
    session.flush()
    for i, e in enumerate(ordered):
        e.position = i


def update_entry(session: Session, entry_id: int, data: PlanEntryUpdate, today: dt.date) -> PlanEntryOut:
    """Change servings, swap the recipe, move to another day (goes last) and/or reorder within the day."""
    entry = _get_entry(session, entry_id)
    old_date = entry.date
    if data.recipe_id is not None and data.recipe_id != entry.recipe_id:
        entry.recipe = _active_recipe(session, data.recipe_id)
        entry.place_meal = None  # swapping a free meal for a recipe turns it into a recipe meal
    if data.servings is not None:
        entry.servings = data.servings
    if data.date is not None and data.date != entry.date:
        if entry.place_meal is not None:
            _check_weekday(entry.place_meal, data.date)
        position = plan_repo.next_position(session, data.date)  # read before changing the date
        entry.date, entry.position = data.date, position
    if data.position is not None:
        _reorder(session, entry, data.position)
    session.flush()
    for week in sorted({week_start(old_date), week_start(entry.date)}):  # a move can change two weeks
        shopping_service.rebuild_week(session, week, today)
    session.commit()
    return to_entry_out(entry)


def delete_entry(session: Session, entry_id: int, today: dt.date) -> None:
    entry = _get_entry(session, entry_id)
    day = entry.date
    plan_repo.remove(session, entry)
    session.flush()
    shopping_service.rebuild_week(session, day, today)
    session.commit()
