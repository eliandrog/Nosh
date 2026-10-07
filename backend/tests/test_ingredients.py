import json

import pytest

from app.services.ingredients import merge_key
from app.seed import SEED_FILE


@pytest.mark.parametrize(
    ("name", "key"),
    [
        ("Onion", "onion"),
        ("  onion ", "onion"),
        ("ONIONS", "onion"),
        ("apples", "apple"),
        ("Basmati Rice", "rice"),
        ("carrots", "carrot"),
        ("tomatoes", "tomato"),
        ("cherry tomatoes", "cherry tomato"),
        ("mixed berries", "mixed berry"),
        ("frozen peas", "frozen pea"),
        ("hummus", "hummus"),
        ("couscous", "couscous"),
        ("asparagus", "asparagus"),
        ("salt and pepper", "salt and pepper"),
        ("red  lentils", "red lentil"),
    ],
)
def test_merge_key(name, key):
    assert merge_key(name) == key


def test_only_intended_merges_in_the_starter_recipes():
    names = {i["item"] for r in json.loads(SEED_FILE.read_text()) for i in r["ingredients"]}
    groups: dict[str, set[str]] = {}
    for n in names:
        groups.setdefault(merge_key(n), set()).add(n)
    merged = {frozenset(g) for g in groups.values() if len(g) > 1}
    assert merged == {
        frozenset({"apple", "apples"}),
        frozenset({"carrot", "carrots"}),
        frozenset({"basmati rice", "rice"}),
    }
