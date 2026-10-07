"""Ingredient merge key: decides when two ingredient names are the same item
on the shopping list. Only the key is normalised; displayed names are kept.

Keys use dashes, like recipe and tag slugs: "Red Lentils" -> "red-lentil".
"""

import re

from app.services.slugs import slugify

# Explicit merges, checked before the plural rule. Keys are already trimmed + lowercased.
ALIASES: dict[str, str] = {
    "apples": "apple",
    "onions": "onion",
    "basmati rice": "rice",
}

# Words the plural rule must leave alone.
PLURAL_EXCEPTIONS: frozenset[str] = frozenset({"hummus", "couscous", "asparagus"})

_WHITESPACE = re.compile(r"\s+")


def _singular(word: str) -> str:
    if word in PLURAL_EXCEPTIONS or len(word) <= 3:
        return word
    if word.endswith("ies"):
        return word[:-3] + "y"
    if word.endswith("oes"):
        return word[:-2]
    if word.endswith("s") and not word.endswith(("ss", "us")):
        return word[:-1]
    return word


def normalise_name(name: str) -> str:
    """Trim, lowercase and collapse whitespace."""
    return _WHITESPACE.sub(" ", name.strip().lower())


def merge_key(name: str) -> str:
    """trim + lowercase -> alias list -> simple plural rule (last word only) -> dashes."""
    key = normalise_name(name)
    if key in ALIASES:
        return slugify(ALIASES[key])
    head, _, last = key.rpartition(" ")
    last = _singular(last)
    return slugify(f"{head} {last}" if head else last)
