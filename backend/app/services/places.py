"""Free meals nearby: places sharing free meals, searched by distance from a point.

- Meals repeat weekly on a weekday; "open today" uses the user's local date.
- Filters apply to meals; a place is listed only if at least one of its meals matches.
- Dietary: every selected label must match (vegetarian also accepts vegan), like recipes.
"""

import datetime as dt
from collections.abc import Sequence

from sqlmodel import Session

from app.constants import DietaryLabel, PlaceMealKind
from app.core.errors import NotFoundError
from app.models import Place, PlaceMeal
from app.repositories import places as place_repo
from app.schemas import PlaceMealOut, PlaceOut
from app.services.geo import bounding_box, haversine_km


class PlaceNotFound(NotFoundError):
    code = "place_not_found"


class PlaceMealNotFound(NotFoundError):
    code = "place_meal_not_found"


def _dietary_ok(meal: PlaceMeal, wanted: Sequence[DietaryLabel]) -> bool:
    labels = {d.label for d in meal.dietary}
    return all(w in labels or (w == DietaryLabel.VEGETARIAN and DietaryLabel.VEGAN in labels) for w in wanted)


def _meal_out(meal: PlaceMeal, today: dt.date) -> PlaceMealOut:
    labels = {d.label for d in meal.dietary}
    return PlaceMealOut(
        id=meal.id,
        name=meal.name,
        kind=meal.kind,
        weekday=meal.weekday,
        start_time=meal.start_time,
        end_time=meal.end_time,
        serves=meal.serves,
        serves_note=meal.serves_note,
        dietary=[d for d in DietaryLabel if d in labels],
        open_today=meal.weekday == today.weekday(),
    )


def _place_out(place: Place, meals: list[PlaceMeal], today: dt.date, distance_km: float | None) -> PlaceOut:
    return PlaceOut(
        id=place.id,
        name=place.name,
        type=place.type,
        postcode=place.postcode,
        latitude=place.latitude,
        longitude=place.longitude,
        is_demo=place.is_demo,
        distance_km=None if distance_km is None else round(distance_km, 2),
        meals=[_meal_out(m, today) for m in meals],
    )


def find_nearby(
    session: Session,
    *,
    lat: float,
    lng: float,
    radius_km: float,
    today: dt.date,
    open_today: bool = False,
    kind: PlaceMealKind | None = None,
    dietary: Sequence[DietaryLabel] = (),
) -> list[PlaceOut]:
    """Places within radius_km of the point, nearest first, with their matching meals."""
    box = bounding_box(lat, lng, radius_km)
    results: list[tuple[float, PlaceOut]] = []
    for place in place_repo.in_box(
        session, min_lat=box.min_lat, max_lat=box.max_lat, min_lng=box.min_lng, max_lng=box.max_lng
    ):
        distance = haversine_km(lat, lng, place.latitude, place.longitude)
        if distance > radius_km:
            continue  # inside the box but outside the circle
        meals = [
            m
            for m in place.meals
            if (not open_today or m.weekday == today.weekday())
            and (kind is None or m.kind == kind)
            and _dietary_ok(m, dietary)
        ]
        if meals:
            results.append((distance, _place_out(place, meals, today, distance)))
    results.sort(key=lambda r: (r[0], r[1].name))
    return [place for _, place in results]


def get_place(session: Session, place_id: int, today: dt.date) -> PlaceOut:
    place = place_repo.get(session, place_id)
    if place is None:
        raise PlaceNotFound("We couldn't find that place.")
    return _place_out(place, list(place.meals), today, None)


def get_meal(session: Session, meal_id: int) -> PlaceMeal:
    meal = place_repo.get_meal(session, meal_id)
    if meal is None:
        raise PlaceMealNotFound("We couldn't find that free meal.")
    return meal
