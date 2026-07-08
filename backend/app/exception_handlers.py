# S3-018: Centralized Error Handling and Logging
# http_exception_handler logs your existing HTTPExceptions (404s, 400s, etc)
# without changing their behavior. unhandled_exception_handler is the safety
# net for anything else (bugs, unexpected library errors) — logs full detail
# server-side, returns a generic message to the client instead of leaking
# internals.
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.logging_config import logger


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "-")
    user_id = getattr(request.state, "user_id", "-")
    logger.warning(
        "[%s] user=%s HTTPException %s on %s %s: %s",
        request_id,
        user_id,
        exc.status_code,
        request.method,
        request.url.path,
        exc.detail,
    )
    return JSONResponse(
        status_code=exc.status_code,
        # S3-018: keep the detail key so response shape matches FastAPI's
        content={"detail": exc.detail, "request_id": request_id},
        headers=getattr(exc, "headers", None),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "-")
    user_id = getattr(request.state, "user_id", "-")
    logger.error(
        "[%s] user=%s Unhandled %s on %s %s: %s",
        request_id,
        user_id,
        type(exc).__name__,
        request.method,
        request.url.path,
        exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "Something went wrong on our end. Please try again.",
            "request_id": request_id,
        },
    )
