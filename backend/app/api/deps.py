"""Shared router dependencies. The session is injected here so routers never import the DB layer."""

import datetime as dt
from typing import Annotated

from fastapi import Depends, Query
from sqlmodel import Session

from app.core.dates import today as resolve_today
from app.db import get_session

SessionDep = Annotated[Session, Depends(get_session)]


def client_today(
    today: Annotated[
        dt.date | None,
        Query(description="The user's local date (YYYY-MM-DD). Defaults to the server's local date."),
    ] = None,
) -> dt.date:
    return resolve_today(today)


TodayDep = Annotated[dt.date, Depends(client_today)]
