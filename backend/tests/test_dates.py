import datetime as dt

import pytest

from app.core.dates import today, week_start


def test_client_date_wins():
    assert today(dt.date(2026, 10, 7)) == dt.date(2026, 10, 7)


def test_falls_back_to_local_date():
    assert today() == dt.date.today()


@pytest.mark.parametrize(
    ("day", "monday"),
    [
        (dt.date(2026, 10, 5), dt.date(2026, 10, 5)),  # Monday
        (dt.date(2026, 10, 7), dt.date(2026, 10, 5)),  # Wednesday
        (dt.date(2026, 10, 11), dt.date(2026, 10, 5)),  # Sunday
        (dt.date(2026, 9, 25), dt.date(2026, 9, 21)),
    ],
)
def test_week_starts_on_monday(day, monday):
    assert week_start(day) == monday
