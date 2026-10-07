"""Single-user settings: dietary preferences and profile."""

from sqlmodel import Session

from app.repositories import settings as settings_repo
from app.schemas import PreferencesIn, PreferencesOut, ProfileIn, ProfileOut


def get_preferences(session: Session) -> PreferencesOut:
    return PreferencesOut(dietary=settings_repo.get_dietary(session))


def update_preferences(session: Session, data: PreferencesIn) -> PreferencesOut:
    settings_repo.set_dietary(session, list(data.dietary))
    session.commit()
    return get_preferences(session)


def _profile_out(session: Session) -> ProfileOut:
    p = settings_repo.get_profile(session)
    return ProfileOut(name=p.name, email=p.email, household_size=p.household_size)


def get_profile(session: Session) -> ProfileOut:
    return _profile_out(session)


def update_profile(session: Session, data: ProfileIn) -> ProfileOut:
    profile = settings_repo.get_profile(session)
    profile.name = (data.name or "").strip() or None
    profile.email = (data.email or "").strip() or None
    profile.household_size = data.household_size
    session.commit()
    return _profile_out(session)
