import time
import uuid
import logging
from contextvars import ContextVar
from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Context variable accessible across async request tasks
correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="")

logger = logging.getLogger("horizon.access")


def get_current_correlation_id() -> str:
    """Retrieve correlation ID for the active request context."""
    return correlation_id_ctx.get()


class ObservabilityAndSecurityMiddleware(BaseHTTPMiddleware):
    """
    Production middleware providing:
    1. Request correlation ID tracking (X-Correlation-ID)
    2. Latency measurement (X-Response-Time)
    3. Essential HTTP security response headers
    4. Structured access logging with sensitive route filtering
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # 1. Correlation ID
        cid = (
            request.headers.get("x-correlation-id")
            or request.headers.get("x-request-id")
            or str(uuid.uuid4())
        )
        token = correlation_id_ctx.set(cid)

        start_time = time.perf_counter()

        try:
            response: Response = await call_next(request)
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(
                f"Unhandled exception on {request.method} {request.url.path} after {elapsed_ms}ms "
                f"[cid={cid}]: {exc}",
                exc_info=True,
            )
            correlation_id_ctx.reset(token)
            raise exc

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # 2. Attach observability headers
        response.headers["X-Correlation-ID"] = cid
        response.headers["X-Response-Time"] = f"{elapsed_ms}ms"

        # 3. Attach security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # 4. Access logging (skip health checks from log spam)
        if not request.url.path.startswith("/health"):
            forwarded = request.headers.get("x-forwarded-for")
            client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "-")
            logger.info(
                f"{request.method} {request.url.path} -> {response.status_code} "
                f"({elapsed_ms}ms) [client={client_ip}, cid={cid}]"
            )

        correlation_id_ctx.reset(token)
        return response
