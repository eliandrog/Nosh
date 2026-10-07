"""Plan entry queries. Entries are ordered within a day by `position` (unique per date)."""

import datetime as dt
import uuid

from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, delete, func, select

from app.models import PlanEntry


def list_between(session: Session, start: dt.date, end: dt.date) -> list[PlanEntry]:
    """Entries from start to end (inclusive), with their recipe loaded up front (no N+1)."""
    stmt = (
        select(PlanEntry)
        .where(col(PlanEntry.date) >= start, col(PlanEntry.date) <= end)
        .options(selectinload(PlanEntry.recipe))
        .order_by(PlanEntry.date, PlanEntry.position)
    )
    return list(session.exec(stmt))


def list_day(session: Session, day: dt.date) -> list[PlanEntry]:
    return list(session.exec(select(PlanEntry).where(PlanEntry.date == day).order_by(PlanEntry.position)))


def get(session: Session, entry_id: int) -> PlanEntry | None:
    return session.get(PlanEntry, entry_id)


def next_position(session: Session, day: dt.date) -> int:
    highest = session.exec(select(func.max(PlanEntry.position)).where(PlanEntry.date == day)).one()
    return 0 if highest is None else highest + 1


def add(session: Session, entry: PlanEntry) -> PlanEntry:
    session.add(entry)
    return entry


def remove(session: Session, entry: PlanEntry) -> None:
    session.delete(entry)


def planned_dates(session: Session, start: dt.date, end: dt.date) -> list[dt.date]:
    stmt = (
        select(PlanEntry.date)
        .where(col(PlanEntry.date) >= start, col(PlanEntry.date) <= end)
        .distinct()
        .order_by(PlanEntry.date)
    )
    return list(session.exec(stmt))


def count_from(session: Session, recipe_id: uuid.UUID, day: dt.date) -> int:
    stmt = select(func.count()).select_from(PlanEntry).where(PlanEntry.recipe_id == recipe_id, col(PlanEntry.date) >= day)
    return session.exec(stmt).one()


def delete_from(session: Session, recipe_id: uuid.UUID, day: dt.date) -> int:
    result = session.exec(delete(PlanEntry).where(col(PlanEntry.recipe_id) == recipe_id, col(PlanEntry.date) >= day))
    return result.rowcount or 0
