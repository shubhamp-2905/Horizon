import time
import threading
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import Request, HTTPException, status
from app.core.config import settings


class InMemoryRateLimiter:
    """
    Thread-safe, sliding-window rate limiter for sensitive endpoints.
    Tracks request timestamps per client IP / subject and enforces request quotas.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._hits: Dict[str, List[float]] = defaultdict(list)
        self._last_cleanup = time.time()

    def is_rate_limited(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
        """
        Check if key exceeds rate limit.
        Returns (is_limited: bool, retry_after_seconds: int).
        """
        now = time.time()
        window_start = now - window_seconds

        with self._lock:
            # Periodic cleanup of keys older than 10 minutes
            if now - self._last_cleanup > 300:
                expired_threshold = now - 600
                keys_to_delete = [
                    k for k, timestamps in self._hits.items()
                    if not timestamps or timestamps[-1] < expired_threshold
                ]
                for k in keys_to_delete:
                    del self._hits[k]
                self._last_cleanup = now

            # Evict timestamps outside current window
            timestamps = self._hits[key]
            valid_timestamps = [t for t in timestamps if t > window_start]
            self._hits[key] = valid_timestamps

            if len(valid_timestamps) >= max_requests:
                # Calculate time until oldest timestamp in window expires
                oldest_in_window = valid_timestamps[0]
                retry_after = max(1, int(oldest_in_window + window_seconds - now))
                return True, retry_after

            # Record this hit
            self._hits[key].append(now)
            return False, 0

    def reset(self):
        """Reset all rate limiter state (useful for tests)."""
        with self._lock:
            self._hits.clear()
            self._last_cleanup = time.time()


limiter = InMemoryRateLimiter()


def rate_limit(max_requests: int = 60, window_seconds: int = 60):
    """
    FastAPI dependency to rate limit requests.
    Example: `Depends(rate_limit(max_requests=5, window_seconds=60))`
    """
    def dependency(request: Request):
        if not getattr(settings, "RATE_LIMIT_ENABLED", True):
            return

        # Identify client by IP (or X-Forwarded-For if behind proxy)
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"

        route_path = request.url.path
        rate_limit_key = f"{client_ip}:{route_path}"

        is_limited, retry_after = limiter.is_rate_limited(
            key=rate_limit_key,
            max_requests=max_requests,
            window_seconds=window_seconds,
        )

        if is_limited:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"Rate limit exceeded. Try again in {retry_after} seconds.",
                    "retry_after": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

    return dependency
