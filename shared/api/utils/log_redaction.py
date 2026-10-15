"""Redact secrets (JWT, Bearer, query token=) from log records before they reach handlers."""

from __future__ import annotations

import logging
import re

from api.utils.json_safe import mask_secret_for_log

# Typical Keycloak JWT: three base64url segments
_JWT_PATTERN = re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+")
_BEARER_JWT_PATTERN = re.compile(
    r"(Bearer\s+)(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)",
    re.IGNORECASE,
)
# URL query: ?token= &access_token=
_TOKEN_QUERY_PATTERN = re.compile(
    r"([?&])(token|access_token|access-token)=([^&\s\"]+)",
    re.IGNORECASE,
)


def redact_sensitive_log_text(text: str, *, head: int = 8, tail: int = 6) -> str:
    """Mask JWT-like strings and token query values anywhere in a log line."""

    if not text:
        return text

    def _mask_jwt(m: re.Match[str]) -> str:
        return mask_secret_for_log(m.group(0), head=head, tail=tail)

    s = _JWT_PATTERN.sub(_mask_jwt, text)

    def _mask_bearer(m: re.Match[str]) -> str:
        return m.group(1) + mask_secret_for_log(m.group(2), head=head, tail=tail)

    s = _BEARER_JWT_PATTERN.sub(_mask_bearer, s)

    def _mask_query(m: re.Match[str]) -> str:
        return f"{m.group(1)}{m.group(2)}={mask_secret_for_log(m.group(3), head=head, tail=tail)}"

    s = _TOKEN_QUERY_PATTERN.sub(_mask_query, s)
    return s


class RedactSensitiveLogFilter(logging.Filter):
    """Applied to logging handlers so uvicorn access lines and other emitters never print full tokens."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003
        try:
            if isinstance(record.msg, str):
                record.msg = redact_sensitive_log_text(record.msg)
            if record.args:
                record.args = tuple(redact_sensitive_log_text(a) if isinstance(a, str) else a for a in record.args)
        except Exception:
            # Never break logging
            return True
        return True


_REDACT_SINGLETON = RedactSensitiveLogFilter()
_HANDLERS_WITH_REDACT: set[int] = set()


def ensure_redact_filter_on_all_handlers() -> None:
    """Attach the redaction filter to every handler (incl. uvicorn.access after it registers). Idempotent."""
    loggers: list[logging.Logger] = [logging.root]
    for name in logging.Logger.manager.loggerDict:
        lg = logging.getLogger(name)
        if isinstance(lg, logging.Logger):
            loggers.append(lg)
    for lg in loggers:
        for h in lg.handlers:
            hid = id(h)
            if hid in _HANDLERS_WITH_REDACT:
                continue
            _HANDLERS_WITH_REDACT.add(hid)
            h.addFilter(_REDACT_SINGLETON)
