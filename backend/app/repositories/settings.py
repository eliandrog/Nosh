"""Single-user settings: dietary preferences and profile."""

from sqlmodel import Session, delete, select

from app.constants import DietaryLabel
from app.models import DietaryPreference, Profile


def get_dietary(session: Session) -> list[DietaryLabel]:
    return [p.label for p in session.exec(select(DietaryPreference).order_by(DietaryPreference.label))]


def set_dietary(session: Session, labels: list[DietaryLabel]) -> None:
    session.exec(delete(DietaryPreference))
    session.add_all(DietaryPreference(label=label) for label in dict.fromkeys(labels))


def get_profile(session: Session) -> Profile:
    profile = session.get(Profile, 1)
    if profile is None:
        profile = Profile(id=1)
        session.add(profile)
    return profile
