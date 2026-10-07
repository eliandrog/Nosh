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


@pytest.fixture
def client(engine):
    """Full app over HTTP, using this test's fresh seeded database."""
    from fastapi.testclient import TestClient

    from app.db import get_session
    from app.main import create_app

    app = create_app()

    def _session():
        with Session(engine) as s:
            yield s

    app.dependency_overrides[get_session] = _session
    with TestClient(app) as c:
        yield c


@pytest.fixture
def count_queries(engine):
    """Counts SQL statements run inside the `with` block: `with count_queries() as q: ...; q.count`."""
    from contextlib import contextmanager

    from sqlalchemy import event

    class Counter:
        count = 0

    @contextmanager
    def _count():
        counter = Counter()

        def _on_execute(*_args):
            counter.count += 1

        event.listen(engine, "before_cursor_execute", _on_execute)
        try:
            yield counter
        finally:
            event.remove(engine, "before_cursor_execute", _on_execute)

    return _count
