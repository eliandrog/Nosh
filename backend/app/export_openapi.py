"""Write the OpenAPI contract to backend/openapi.json (read by the frontend type generator).

    uv run python -m app.export_openapi
"""

import json
from pathlib import Path

from app.main import app

OPENAPI_FILE = Path(__file__).resolve().parents[1] / "openapi.json"


def render() -> str:
    return json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"


if __name__ == "__main__":
    OPENAPI_FILE.write_text(render(), encoding="utf-8")
    print(f"Wrote {OPENAPI_FILE}")
