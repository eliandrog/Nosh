import pytest

from app.services.geo import bounding_box, haversine_km


def test_haversine_known_distance_london_to_paris() -> None:
    assert haversine_km(51.5074, -0.1278, 48.8566, 2.3522) == pytest.approx(343.6, abs=1)


def test_haversine_is_zero_for_the_same_point_and_symmetric() -> None:
    assert haversine_km(51.46, -0.11, 51.46, -0.11) == 0
    assert haversine_km(51.46, -0.11, 51.47, -0.12) == pytest.approx(haversine_km(51.47, -0.12, 51.46, -0.11))


@pytest.mark.parametrize("radius_km", [0.5, 2, 10])
def test_bounding_box_contains_every_point_within_the_radius(radius_km: float) -> None:
    lat, lng = 51.4613, -0.1149
    box = bounding_box(lat, lng, radius_km)
    # Points just inside the circle in each direction must be inside the box.
    step = radius_km * 0.999
    for d_lat, d_lng in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        p_lat = lat + d_lat * step / 111.32
        p_lng = lng + d_lng * step / (111.32 * 0.6225)  # cos(51.46°) ≈ 0.6225
        assert haversine_km(lat, lng, p_lat, p_lng) <= radius_km
        assert box.min_lat <= p_lat <= box.max_lat and box.min_lng <= p_lng <= box.max_lng


def test_bounding_box_stays_within_valid_coordinates_at_the_edges() -> None:
    box = bounding_box(89.99, 179.99, 10)
    assert box.max_lat <= 90 and box.max_lng <= 180 and box.min_lat >= -90 and box.min_lng >= -180
