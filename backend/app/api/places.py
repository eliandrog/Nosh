from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.api.deps import SessionDep, TodayDep
from app.api.errors import error_responses
from app.api.params import enum_list
from app.constants import DietaryLabel, PlaceMealKind
from app.schemas import PlaceOut
from app.services import places as place_service

router = APIRouter(prefix="/places", tags=["Free meals nearby"])

MAX_RADIUS_KM = 10


@router.get(
    "",
    response_model=list[PlaceOut],
    summary="Find free meals nearby",
    description=(
        "Places within `radiusKm` of a point, nearest first, each with its matching meals and `distanceKm`. "
        "Filters apply to meals (`openToday` uses the user's local date; dietary labels must **all** match, "
        "vegetarian also accepts vegan). A place is listed only if at least one meal matches."
    ),
    responses=error_responses(422),
)
def find_nearby(
    session: SessionDep,
    today: TodayDep,
    lat: Annotated[float, Query(ge=-90, le=90, description="Latitude of the search point, e.g. 51.4613")],
    lng: Annotated[float, Query(ge=-180, le=180, description="Longitude of the search point, e.g. -0.1149")],
    radius_km: Annotated[
        float, Query(alias="radiusKm", gt=0, le=MAX_RADIUS_KM, description="Search radius in km (max 10)")
    ] = 2,
    open_today: Annotated[bool, Query(alias="openToday", description="Only meals served today")] = False,
    kind: Annotated[PlaceMealKind | None, Query(description="`hot` meals or food `parcel`s")] = None,
    dietary: Annotated[str | None, Query(description="Comma-separated, e.g. `vegetarian,gluten-free`")] = None,
) -> list[PlaceOut]:
    return place_service.find_nearby(
        session,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        today=today,
        open_today=open_today,
        kind=kind,
        dietary=enum_list(dietary, DietaryLabel, "dietary"),
    )


@router.get(
    "/{place_id}",
    response_model=PlaceOut,
    summary="Get a place",
    description="A place with all its meals (`distanceKm` is null here).",
    responses=error_responses(404, 422),
)
def get_place(
    session: SessionDep, today: TodayDep, place_id: Annotated[int, Path(ge=1, description="Place id")]
) -> PlaceOut:
    return place_service.get_place(session, place_id, today)
