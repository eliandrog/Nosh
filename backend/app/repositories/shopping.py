"""Shopping list queries (stored lines per week and the per-week change counts)."""

import datetime as dt

from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, select, update

from app.models import ShoppingListItem, ShoppingListUpdate


def list_items(session: Session, week_start: dt.date) -> list[ShoppingListItem]:
    stmt = (
        select(ShoppingListItem)
        .where(ShoppingListItem.week_start == week_start)
        .options(selectinload(ShoppingListItem.ingredient))
    )
    return list(session.exec(stmt))


def get_item(session: Session, item_id: int) -> ShoppingListItem | None:
    return session.get(ShoppingListItem, item_id)


def add_item(session: Session, item: ShoppingListItem) -> None:
    session.add(item)


def remove_item(session: Session, item: ShoppingListItem) -> None:
    session.delete(item)


def untick_all(session: Session, week_start: dt.date) -> None:
    session.exec(
        update(ShoppingListItem)
        .where(col(ShoppingListItem.week_start) == week_start, col(ShoppingListItem.ticked).is_(True))
        .values(ticked=False)
    )


def get_update(session: Session, week_start: dt.date) -> ShoppingListUpdate | None:
    return session.get(ShoppingListUpdate, week_start)


def add_update(session: Session, record: ShoppingListUpdate) -> None:
    session.add(record)
