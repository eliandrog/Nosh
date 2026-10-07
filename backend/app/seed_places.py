"""Demo data for Free meals nearby.

DEMO DATA: the place names are fictional and don't refer to any real organisation.
The postcodes are real (Brixton, London) and the coordinates are those postcodes'
centres, looked up on postcodes.io, so map pins land in the right area. Meals repeat
weekly by weekday, so the data stays valid whatever the date.

Seeded only when the place table is empty, so restarting never creates duplicates.
"""

import datetime as dt
from dataclasses import dataclass

from sqlmodel import Session

from app.constants import DietaryLabel, PlaceMealKind, PlaceType
from app.models import Place, PlaceMeal, PlaceMealDietary
from app.repositories import places as place_repo

WEDNESDAY, THURSDAY = 2, 3  # weekday numbers: 0 = Monday


@dataclass(frozen=True)
class DemoMeal:
    name: str
    kind: PlaceMealKind
    weekday: int
    start: dt.time
    end: dt.time
    serves: int
    serves_note: str | None
    dietary: tuple[DietaryLabel, ...]


@dataclass(frozen=True)
class DemoPlace:
    name: str
    type: PlaceType
    postcode: str
    latitude: float
    longitude: float
    meals: tuple[DemoMeal, ...]


DEMO_PLACES: tuple[DemoPlace, ...] = (
    DemoPlace(
        name="Demo Community Kitchen",
        type=PlaceType.COMMUNITY_KITCHEN,
        postcode="SW2 1RW",
        latitude=51.460662,
        longitude=-0.116872,
        meals=(
            DemoMeal(
                name="Vegetable curry with rice",
                kind=PlaceMealKind.HOT,
                weekday=WEDNESDAY,
                start=dt.time(12),
                end=dt.time(14),
                serves=1,
                serves_note="1 per portion",
                dietary=(DietaryLabel.VEGAN, DietaryLabel.GLUTEN_FREE),
            ),
        ),
    ),
    DemoPlace(
        name="Sample Street Café",
        type=PlaceType.CAFE,
        postcode="SW2 1JQ",
        latitude=51.461104,
        longitude=-0.114723,
        meals=(
            DemoMeal(
                name="Shepherd's pie and peas",
                kind=PlaceMealKind.HOT,
                weekday=WEDNESDAY,
                start=dt.time(17, 30),
                end=dt.time(19),
                serves=2,
                serves_note="takeaway tray",
                dietary=(),
            ),
        ),
    ),
    DemoPlace(
        name="Example Food Hub",
        type=PlaceType.FOOD_HUB,
        postcode="SW9 8PR",
        latitude=51.462606,
        longitude=-0.111969,
        meals=(
            DemoMeal(
                name="Food parcel: tins, pasta, fresh veg",
                kind=PlaceMealKind.PARCEL,
                weekday=THURSDAY,
                start=dt.time(10),
                end=dt.time(13),
                serves=4,
                serves_note="feeds 4 for about 3 days",
                dietary=(DietaryLabel.VEGETARIAN,),
            ),
        ),
    ),
)


def seed_places(session: Session) -> int:
    """Insert the demo places in one transaction. Returns how many were added."""
    if not place_repo.is_empty(session):
        return 0
    for p in DEMO_PLACES:
        place = Place(
            name=p.name, type=p.type, postcode=p.postcode, latitude=p.latitude, longitude=p.longitude, is_demo=True
        )
        place.meals = [
            PlaceMeal(
                name=m.name,
                kind=m.kind,
                weekday=m.weekday,
                start_time=m.start,
                end_time=m.end,
                serves=m.serves,
                serves_note=m.serves_note,
                dietary=[PlaceMealDietary(label=d) for d in m.dietary],
            )
            for m in p.meals
        ]
        session.add(place)
    session.commit()
    return len(DEMO_PLACES)
