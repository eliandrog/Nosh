"""Plan entry queries needed by other features (the week-plan endpoints come later)."""

import datetime as dt
import uuid

from sqlmodel import Session, col, delete, func, select

from app.models import PlanEntry


def count_from(session: Session, recipe_id: uuid.UUID, day: dt.date) -> int:
    stmt = select(func.count()).select_from(PlanEntry).where(PlanEntry.recipe_id == recipe_id, col(PlanEntry.date) >= day)
    return session.exec(stmt).one()


def delete_from(session: Session, recipe_id: uuid.UUID, day: dt.date) -> int:
    result = session.exec(delete(PlanEntry).where(col(PlanEntry.recipe_id) == recipe_id, col(PlanEntry.date) >= day))
    return result.rowcount or 0
