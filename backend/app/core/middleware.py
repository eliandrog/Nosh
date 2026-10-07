"""Request id + access log for every request."""

import logging
import re
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.errors import internal_error_response
from app.core.request_context import reset_request_id, set_request_id

logger = logging.getLogger("app.access")

REQUEST_ID_HEADER = "X-Request-ID"
_SAFE_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Reuses a safe incoming X-Request-ID or creates one, echoes it back, and logs the request."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming = request.headers.get(REQUEST_ID_HEADER, "")
        request_id = incoming if _SAFE_ID.match(incoming) else uuid.uuid4().hex[:12]
        token = set_request_id(request_id)
        start = time.perf_counter()
        try:
            try:
                response = await call_next(request)
            except Exception as exc:  # anything the route handlers didn't turn into an AppError
                response = internal_error_response(exc)
            response.headers[REQUEST_ID_HEADER] = request_id
            duration_ms = (time.perf_counter() - start) * 1000
            logger.info("%s %s %s %.0fms", request.method, request.url.path, response.status_code, duration_ms)
            return response
        finally:
            reset_request_id(token)
