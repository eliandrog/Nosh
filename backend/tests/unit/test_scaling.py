import pytest

from app.services.scaling import scale_quantity


@pytest.mark.parametrize(
    ("quantity", "unit", "factor", "expected"),
    [
        (250, "g", 0.5, 125),  # g/ml: nearest whole
        (333, "ml", 0.5, 166),  # 166.5 rounds to even
        (1, "kg", 1 / 3, 0.33),  # kg/l: 2 decimals
        (1, "tin", 0.5, 0.5),  # packs/spoons: nearest half
        (2, "tbsp", 0.75, 1.5),
        (1, "tin", 0.2, 0.5),  # never below half
        (1, None, 0.5, 1),  # counted items: round up
        (3, "clove", 0.5, 2),
        (2, None, 1.0, 2),  # exact stays exact
        (None, None, 2.0, None),  # "to taste" never scaled
    ],
)
def test_scale_quantity(quantity, unit, factor, expected):
    assert scale_quantity(quantity, unit, factor) == expected


def test_small_weights_never_round_to_zero():
    assert scale_quantity(1, "g", 0.1) == 1
