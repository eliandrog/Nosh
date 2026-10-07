"""Distance helpers, no dependencies: a lat/lng box for a cheap SQL prefilter, then exact haversine."""

import math
from dataclasses import dataclass

EARTH_RADIUS_KM = 6371.0088  # mean Earth radius
KM_PER_DEGREE_LAT = 111.32


@dataclass(frozen=True)
class Box:
    min_lat: float
    max_lat: float
    min_lng: float
    max_lng: float


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points, in km."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d_lat, d_lng = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(d_lng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def bounding_box(lat: float, lng: float, radius_km: float) -> Box:
    """A box that contains every point within radius_km (slightly larger than the circle)."""
    d_lat = radius_km / KM_PER_DEGREE_LAT
    cos_lat = max(math.cos(math.radians(lat)), 1e-6)  # avoid dividing by zero at the poles
    d_lng = min(radius_km / (KM_PER_DEGREE_LAT * cos_lat), 180.0)
    return Box(max(lat - d_lat, -90.0), min(lat + d_lat, 90.0), max(lng - d_lng, -180.0), min(lng + d_lng, 180.0))
