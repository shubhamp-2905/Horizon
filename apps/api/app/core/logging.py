import re
import sys
import json
import logging
from typing import Any, Dict
from app.core.config import settings

# Regex to redact sensitive patterns
SENSITIVE_PATTERNS = [
    (re.compile(r'(password[\'\":\s=]+)([\'\"][^\'\"]+[\'\"]|[^\s,;]+)', re.IGNORECASE), r'\1[REDACTED]'),
    (re.compile(r'(token[\'\":\s=]+)([\'\"][^\'\"]+[\'\"]|[^\s,;]+)', re.IGNORECASE), r'\1[REDACTED]'),
    (re.compile(r'(secret[\'\":\s=]+)([\'\"][^\'\"]+[\'\"]|[^\s,;]+)', re.IGNORECASE), r'\1[REDACTED]'),
    (re.compile(r'(Bearer\s+)[A-Za-z0-9_\-\.]+', re.IGNORECASE), r'\1[REDACTED]'),
    (re.compile(r'(api[_\-]?key[\'\":\s=]+)([\'\"][^\'\"]+[\'\"]|[^\s,;]+)', re.IGNORECASE), r'\1[REDACTED]'),
]


class SensitiveDataFilter(logging.Filter):
    """Logging filter that scrubs sensitive credentials and attaches request correlation ID."""

    def filter(self, record: logging.LogRecord) -> bool:
        # 1. Attach correlation ID if available in request context
        try:
            from app.core.middleware import get_current_correlation_id
            cid = get_current_correlation_id()
            record.correlation_id = cid or "-"
        except Exception:
            record.correlation_id = "-"

        # 2. Mask sensitive credentials in log message
        if isinstance(record.msg, str):
            msg = record.msg
            for pattern, repl in SENSITIVE_PATTERNS:
                msg = pattern.sub(repl, msg)
            record.msg = msg

        return True


class JsonFormatter(logging.Formatter):
    """Structured JSON formatter for production log ingestors (Datadog, CloudWatch, Render)."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": getattr(record, "correlation_id", "-"),
            "environment": getattr(settings, "ENVIRONMENT", "development"),
        }
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)


def setup_logging() -> None:
    """Initialize structured logging, sensitive data scrubbing, and correlation tracking."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Clear existing handlers
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)
    handler.addFilter(SensitiveDataFilter())

    # Use JSON in production, clean readable string in development
    if getattr(settings, "LOG_FORMAT", "text").lower() == "json" or settings.is_production:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] [%(name)s] [cid=%(correlation_id)s] %(message)s")
        )

    root_logger.addHandler(handler)
