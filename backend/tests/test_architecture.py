"""Layer rules: dependencies only point down (api -> services -> repositories -> models)."""

import ast
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "app"


def _imports(folder: str) -> dict[str, set[str]]:
    found = {}
    for path in (APP / folder).glob("*.py"):
        mods = set()
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.ImportFrom) and node.module:
                mods.add(node.module)
                mods.update(f"{node.module}.{a.name}" for a in node.names)
            elif isinstance(node, ast.Import):
                mods.update(a.name for a in node.names)
        found[path.name] = mods
    return found


def _uses(mods: set[str], *prefixes: str) -> set[str]:
    return {m for m in mods if any(m == p or m.startswith(p + ".") for p in prefixes)}


def test_routers_do_not_touch_the_database():
    for name, mods in _imports("api").items():
        assert not _uses(mods, "app.repositories", "app.models", "app.db", "sqlmodel", "sqlalchemy"), name


def test_services_do_not_know_about_http():
    for name, mods in _imports("services").items():
        assert not _uses(mods, "fastapi", "starlette", "app.api"), name


def test_repositories_are_the_lowest_layer():
    for name, mods in _imports("repositories").items():
        assert not _uses(mods, "app.services", "app.api", "fastapi"), name
