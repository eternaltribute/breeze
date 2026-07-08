# S3-018: Centralized Error Handling and Logging
# Logs every request (method/path/status/duration/user) and assigns a
# request_id that exception_handlers.py reuses, so a client-reported bug
# can be traced to one exact log line.
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.logging_config import logger


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = uuid.uuid4().hex[:8]
        request.state.request_id = request_id
        start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.perf_counter() - start) * 1000, 1)
            user_id = getattr(request.state, "user_id", "-")
            logger.error(
                "[%s] user=%s %s %s crashed after %sms",
                request_id,
                user_id,
                request.method,
                request.url.path,
                duration_ms,
            )
            raise

        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        user_id = getattr(request.state, "user_id", "-")
        log_fn = logger.warning if response.status_code >= 400 else logger.info
        log_fn(
            "[%s] user=%s %s %s -> %s (%sms)",
            request_id,
            user_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        response.headers["X-Request-ID"] = request_id
        return response
