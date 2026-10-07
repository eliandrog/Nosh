import os
import tempfile
from pathlib import Path

import pytest
from sqlmodel import Session

# Point the app at a throwaway database before app.db is imported anywhere.
_TMP_DIR = tempfile.mkdtemp(prefix="nosh-test-")
os.environ.setdefault("NOSH_DB_PATH", str(Path(_TMP_DIR) / "app.db"))

from app.db import init_db, make_engine  # noqa: E402


@pytest.fixture
def engine(tmp_path):
    eng = make_engine(tmp_path / "test.db")
    init_db(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def session(engine):
    with Session(engine) as s:
        yield s
