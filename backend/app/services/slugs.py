"""Slug rule shared by recipes and tags: lowercase, apostrophes removed, other non-alphanumerics -> '-'."""

import re


def slugify(name: str) -> str:
    s = name.lower().replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")
