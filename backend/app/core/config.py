"""App settings, read once from environment variables."""

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    db_path: Path = field(default_factory=lambda: Path(os.environ.get("NOSH_DB_PATH", BACKEND_DIR / "nosh.db")))
    log_level: str = field(default_factory=lambda: os.environ.get("NOSH_LOG_LEVEL", "INFO").upper())
    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            o.strip() for o in os.environ.get("NOSH_CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()
        )
    )


settings = Settings()
