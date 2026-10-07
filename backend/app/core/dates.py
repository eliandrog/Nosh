"""Dates follow the user's local calendar, not UTC.

"Today" decides which week the app opens on and which planned meals count as
upcoming (e.g. deleting a recipe removes meals from today onwards). The frontend
sends its local date; if it doesn't, the backend falls back to the machine's local
date (fine for a single local app).
"""

import datetime as dt


def today(client_today: dt.date | None = None) -> dt.date:
    return client_today or dt.date.today()  # local date, deliberately not UTC


def week_start(day: dt.date) -> dt.date:
    """Monday of the week containing day."""
    return day - dt.timedelta(days=day.weekday())
