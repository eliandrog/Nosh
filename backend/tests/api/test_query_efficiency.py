"""Guards against N+1 queries: the number of SQL statements must not grow with the number of recipes."""

from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.api.test_recipes_api import new_recipe


def test_recipe_list_query_count_is_constant(client: TestClient, count_queries: Callable) -> None:
    params = {"all": "true", "pageSize": 50}
    with count_queries() as before:
        assert client.get("/api/recipes", params=params).json()["total"] == 20

    for i in range(5):
        assert client.post("/api/recipes", json=new_recipe(name=f"Extra Stew {i}")).status_code == 201

    with count_queries() as after:
        assert len(client.get("/api/recipes", params=params).json()["items"]) == 25

    assert after.count == before.count
    assert before.count <= 6  # count + page + meal types + dietary + tags + tag rows


def test_every_page_costs_the_same_number_of_queries(client: TestClient, count_queries: Callable) -> None:
    counts = []
    for page in (1, 2, 4):
        with count_queries() as q:
            assert client.get("/api/recipes", params={"all": "true", "pageSize": 5, "page": page}).status_code == 200
        counts.append(q.count)
    assert len(set(counts)) == 1


def test_recipe_detail_uses_a_fixed_number_of_queries(client: TestClient, count_queries: Callable) -> None:
    with count_queries() as q:
        assert client.get("/api/recipes/lentil-dahl").status_code == 200
    assert q.count <= 8  # recipe + each related collection, loaded up front
