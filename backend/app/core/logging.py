"""One logging setup for the app and Uvicorn: same format everywhere, request id on every line.

    2026-10-07 12:00:00,123 INFO  app.access [a1b2c3d4] GET /api/recipes 200 12ms
"""

import logging
import logging.config

from app.core.request_context import get_request_id

LOG_FORMAT = "%(asctime)s %(levelname)-5s %(name)s [%(request_id)s] %(message)s"


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True


def configure_logging(level: str = "INFO") -> None:
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "filters": {"request_id": {"()": RequestIdFilter}},
            "formatters": {"default": {"format": LOG_FORMAT}},
            "handlers": {
                "console": {"class": "logging.StreamHandler", "formatter": "default", "filters": ["request_id"]}
            },
            "root": {"handlers": ["console"], "level": level},
            "loggers": {
                # Route Uvicorn through the same handler/format; our middleware logs access lines.
                "uvicorn": {"handlers": [], "propagate": True},
                "uvicorn.error": {"handlers": [], "propagate": True},
                "uvicorn.access": {"handlers": [], "propagate": False, "level": "WARNING"},
            },
        }
    )
