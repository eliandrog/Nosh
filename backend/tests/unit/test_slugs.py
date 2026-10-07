import pytest

from app.services.slugs import slugify


@pytest.mark.parametrize(
    ("name", "slug"),
    [
        ("Nan's Veggie Stew", "nans-veggie-stew"),
        ("  NAN’S   Veggie  STEW! ", "nans-veggie-stew"),
        ("Chicken Stir-Fry", "chicken-stir-fry"),
        ("Ploughman's Lunch", "ploughmans-lunch"),
        ("!!!", ""),
    ],
)
def test_slugify(name, slug):
    assert slugify(name) == slug
