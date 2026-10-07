"""Reference data, preferences and profile end to end."""

from fastapi.testclient import TestClient


def test_ingredient_suggestions_put_prefix_matches_first(client: TestClient) -> None:
    names = [s["name"] for s in client.get("/api/ingredients", params={"q": "to"}).json()]
    assert names, "expected suggestions"
    first_non_prefix = next((i for i, n in enumerate(names) if not n.lower().startswith("to")), len(names))
    assert all(not n.lower().startswith("to") for n in names[first_non_prefix:])  # prefix matches come first
    assert "chopped tomatoes" in names


def test_creating_an_existing_tag_returns_it_instead_of_duplicating(client: TestClient) -> None:
    first = client.post("/api/tags", json={"name": "Low cost"})
    again = client.post("/api/tags", json={"name": "  low-COST "})
    assert first.status_code == again.status_code == 201
    assert first.json() == again.json() == {"key": "low-cost", "name": "Low cost", "isBuiltin": False}
    assert [t["key"] for t in client.get("/api/tags").json()].count("low-cost") == 1


def test_preferences_round_trip_without_duplicates(client: TestClient) -> None:
    saved = client.put("/api/preferences", json={"dietary": ["vegan", "vegan", "gluten-free"]})
    assert saved.json() == {"dietary": ["gluten-free", "vegan"]}
    assert client.get("/api/preferences").json() == saved.json()


def test_profile_round_trip_and_validation(client: TestClient) -> None:
    assert client.get("/api/profile").json() == {"name": None, "email": None, "householdSize": None}

    saved = client.put("/api/profile", json={"name": " Sam ", "email": "sam@example.com", "householdSize": 3})
    assert saved.json() == {"name": "Sam", "email": "sam@example.com", "householdSize": 3}

    bad = client.put("/api/profile", json={"email": "not-an-email", "householdSize": 0})
    assert bad.status_code == 422
    assert {"email", "householdSize"} <= set(bad.json()["error"]["details"]["fields"])


def test_suggestions_and_recipe_search_match_readable_names_with_spaces(client: TestClient) -> None:
    assert [s["name"] for s in client.get("/api/ingredients", params={"q": "red len"}).json()] == ["red lentils"]
    found = [r["slug"] for r in client.get("/api/recipes", params={"q": "red len", "all": "true"}).json()["items"]]
    assert found == ["lentil-dahl"]
