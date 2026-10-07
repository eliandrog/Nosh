"""Place queries (Free meals nearby). Meals and their dietary labels load up front (no N+1)."""

from sqlalchemy.orm import selectinload
from sqlmodel import Session, col, select

from app.models import Place, PlaceMeal


def _with_meals():
    return selectinload(Place.meals).selectinload(PlaceMeal.dietary)


def in_box(session: Session, *, min_lat: float, max_lat: float, min_lng: float, max_lng: float) -> list[Place]:
    """Cheap SQL prefilter by a latitude/longitude box; the exact distance is checked in Python."""
    stmt = (
        select(Place)
        .where(col(Place.latitude).between(min_lat, max_lat), col(Place.longitude).between(min_lng, max_lng))
        .options(_with_meals())
    )
    return list(session.exec(stmt))


def get(session: Session, place_id: int) -> Place | None:
    return session.exec(select(Place).where(Place.id == place_id).options(_with_meals())).first()


def get_meal(session: Session, meal_id: int) -> PlaceMeal | None:
    stmt = select(PlaceMeal).where(PlaceMeal.id == meal_id).options(selectinload(PlaceMeal.place))
    return session.exec(stmt).first()


def is_empty(session: Session) -> bool:
    return session.exec(select(Place.id).limit(1)).first() is None
