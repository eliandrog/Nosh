from fastapi import APIRouter

from app.api.deps import SessionDep
from app.api.errors import error_responses
from app.schemas import PreferencesIn, PreferencesOut, ProfileIn, ProfileOut
from app.services import settings as settings_service

router = APIRouter(tags=["Preferences & profile"])


@router.get("/preferences", response_model=PreferencesOut, summary="Get dietary preferences")
def get_preferences(session: SessionDep) -> PreferencesOut:
    return settings_service.get_preferences(session)


@router.put(
    "/preferences",
    response_model=PreferencesOut,
    summary="Set dietary preferences",
    description="Replaces the saved dietary labels. The recipe list filters by these by default.",
    responses=error_responses(422),
)
def update_preferences(session: SessionDep, data: PreferencesIn) -> PreferencesOut:
    return settings_service.update_preferences(session, data)


@router.get("/profile", response_model=ProfileOut, summary="Get profile")
def get_profile(session: SessionDep) -> ProfileOut:
    return settings_service.get_profile(session)


@router.put(
    "/profile",
    response_model=ProfileOut,
    summary="Update profile",
    description="Name, email and household size (the default servings when adding a meal). Profile only, no login.",
    responses=error_responses(422),
)
def update_profile(session: SessionDep, data: ProfileIn) -> ProfileOut:
    return settings_service.update_profile(session, data)
