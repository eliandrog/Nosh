"""Weekly shopping list: stored per week and rebuilt from the plan.

- Current and future weeks are rebuilt by full recalculation (never incrementally) whenever
  their plan changes, a recipe they use is edited or deleted, or the list is opened.
- Past weeks are never rebuilt, so they keep what was actually shopped for.
- Ticks: a new line starts unticked; if a line's amount goes up it's unticked (buy the extra);
  same or lower keeps its tick; lines no longer needed are removed.
- The "List updated" banner counts added / removed / changed lines since it was last dismissed.
  The first build of a week doesn't show it.
- "Used in" is computed live from the week's planned meals.
"""

import datetime as dt
import uuid
from collections import defaultdict
from dataclasses import dataclass

from sqlmodel import Session

from app.core.dates import week_start
from app.core.errors import NotFoundError
from app.models import PlanEntry, ShoppingListItem, ShoppingListUpdate
from app.repositories import plan as plan_repo
from app.repositories import shopping as shopping_repo
from app.schemas import ShoppingListChangesOut, ShoppingListItemOut, ShoppingListOut
from app.services.shopping_merge import PlannedIngredient, build_lines


class ShoppingItemNotFound(NotFoundError):
    code = "shopping_item_not_found"


@dataclass(frozen=True)
class Changes:
    added: int = 0
    removed: int = 0
    changed: int = 0

    @property
    def any(self) -> bool:
        return bool(self.added or self.removed or self.changed)


def _week_entries(session: Session, start: dt.date) -> list[PlanEntry]:
    return plan_repo.list_between_with_ingredients(session, start, start + dt.timedelta(days=6))


def _planned_ingredients(entries: list[PlanEntry]) -> list[PlannedIngredient]:
    return [
        PlannedIngredient(line.ingredient_id, line.quantity, line.unit, entry.servings, entry.recipe.serves)
        for entry in entries
        for line in entry.recipe.ingredients
    ]


def _went_up(old: ShoppingListItem, quantity: float | None, to_taste: bool) -> bool:
    if quantity is not None and (old.quantity is None or quantity > old.quantity):
        return True
    return to_taste and not old.to_taste and old.quantity is None


def _sync(session: Session, start: dt.date, entries: list[PlanEntry]) -> Changes:
    wanted = {(line.ingredient_id, line.unit): line for line in build_lines(_planned_ingredients(entries))}
    existing = {(item.ingredient_id, item.unit): item for item in shopping_repo.list_items(session, start)}
    added = removed = changed = 0

    for key, item in existing.items():
        if key not in wanted:
            shopping_repo.remove_item(session, item)
            removed += 1
    for key, line in wanted.items():
        item = existing.get(key)
        if item is None:
            shopping_repo.add_item(
                session,
                ShoppingListItem(week_start=start, ingredient_id=line.ingredient_id, unit=line.unit, quantity=line.quantity, to_taste=line.to_taste),
            )
            added += 1
        elif (item.quantity, item.to_taste) != (line.quantity, line.to_taste):
            if _went_up(item, line.quantity, line.to_taste):
                item.ticked = False
            item.quantity, item.to_taste = line.quantity, line.to_taste
            changed += 1
    return Changes(added, removed, changed)


def _record(session: Session, start: dt.date, changes: Changes, *, first_build: bool) -> None:
    record = shopping_repo.get_update(session, start)
    if record is None:
        # First build: remember the week exists, without a banner.
        shopping_repo.add_update(session, ShoppingListUpdate(week_start=start, dismissed=True))
        return
    if first_build or not changes.any:
        return
    if record.dismissed:
        record.added, record.removed, record.changed, record.dismissed = 0, 0, 0, False
    record.added += changes.added
    record.removed += changes.removed
    record.changed += changes.changed
    record.updated_at = dt.datetime.now(dt.UTC)


def rebuild_week(session: Session, day: dt.date, today: dt.date, entries: list[PlanEntry] | None = None) -> None:
    """Recalculate a current or future week's list (past weeks are left as shopped). Caller commits."""
    start = week_start(day)
    if start < week_start(today):
        return
    first_build = shopping_repo.get_update(session, start) is None
    changes = _sync(session, start, entries if entries is not None else _week_entries(session, start))
    _record(session, start, changes, first_build=first_build)


def rebuild_weeks_using_recipe(session: Session, recipe_id: uuid.UUID, today: dt.date) -> None:
    """After a recipe is edited or deleted: rebuild every current/future week that plans it."""
    starts = {week_start(d) for d in plan_repo.week_dates_using_recipe(session, recipe_id, week_start(today))}
    starts.add(week_start(today))  # a delete may have just removed this week's meals
    for start in sorted(starts):
        rebuild_week(session, start, today)


# ---------- Reads and ticks ----------


def _used_in(entries: list[PlanEntry]) -> dict[int, list[str]]:
    names: dict[int, set[str]] = defaultdict(set)
    for entry in entries:
        for line in entry.recipe.ingredients:
            names[line.ingredient_id].add(entry.recipe.name)
    return {ingredient_id: sorted(n, key=str.lower) for ingredient_id, n in names.items()}


def _item_out(item: ShoppingListItem, used_in: dict[int, list[str]]) -> ShoppingListItemOut:
    return ShoppingListItemOut(
        id=item.id,
        ingredient_id=item.ingredient_id,
        name=item.ingredient.name,
        unit=item.unit,
        quantity=item.quantity,
        to_taste=item.to_taste,
        ticked=item.ticked,
        used_in=used_in.get(item.ingredient_id, []),
    )


def _changes_out(record: ShoppingListUpdate | None) -> ShoppingListChangesOut | None:
    if record is None or record.dismissed or not (record.added or record.removed or record.changed):
        return None
    return ShoppingListChangesOut(added=record.added, removed=record.removed, changed=record.changed)


def get_list(session: Session, day: dt.date, today: dt.date) -> ShoppingListOut:
    start = week_start(day)
    entries = _week_entries(session, start)
    if start >= week_start(today):
        rebuild_week(session, start, today, entries)
        session.commit()
    items = sorted(shopping_repo.list_items(session, start), key=lambda i: (i.ingredient.name.lower(), i.unit))
    used_in = _used_in(entries)
    return ShoppingListOut(
        week_start=start,
        items=[_item_out(item, used_in) for item in items],
        changes=_changes_out(shopping_repo.get_update(session, start)),
    )


def set_ticked(session: Session, item_id: int, ticked: bool) -> ShoppingListItemOut:
    item = shopping_repo.get_item(session, item_id)
    if item is None:
        raise ShoppingItemNotFound("We couldn't find that item on your list.")
    item.ticked = ticked
    session.commit()
    return _item_out(item, _used_in(_week_entries(session, item.week_start)))


def clear_ticked(session: Session, day: dt.date) -> None:
    shopping_repo.untick_all(session, week_start(day))
    session.commit()


def dismiss_changes(session: Session, day: dt.date) -> None:
    record = shopping_repo.get_update(session, week_start(day))
    if record is not None:
        record.dismissed = True
        session.commit()
