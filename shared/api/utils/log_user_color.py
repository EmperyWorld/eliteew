# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Per-user ANSI foreground for entire stderr log lines when a user label is detected (`user=` / JSON).
# Invariants:
# - Do not write ANSI to file handlers; only filters on `sys.stderr` stream handlers.
# - Apply after redaction filters so secrets stay masked before `getMessage()` expansion.
# Related:
# - api/core/logging_config.py (`_ColorFormatter`, `configure_logging`); `documentation/.../logging-standards.mdc`
# ---

"""Per-user ANSI colors for full log lines on stderr (not for log files)."""

from __future__ import annotations

import hashlib
import logging
import os
import re
import sys

_RESET = "\033[0m"
# Distinct readable foregrounds (normal + bright), avoid black/white/gray
_USER_FG_PALETTE = (31, 32, 33, 34, 35, 36, 91, 92, 93, 94, 95, 96)

_PLAIN_USER_AUTH = re.compile(r"\buser=([^\s]+)\s+authorized\b")
_JSON_USER = re.compile(r'"user"\s*:\s*"([^"]+)"')
_JSON_USERNAME = re.compile(r'"username"\s*:\s*"([^"]+)"')
_JSON_PREFERRED = re.compile(r'"preferred_username"\s*:\s*"([^"]+)"')
_JSON_LABEL_ORDER = (_JSON_USER, _JSON_USERNAME, _JSON_PREFERRED)

logger = logging.getLogger(__name__)


def should_apply_user_color() -> bool:
    """Colorize lines when useful for operators (TTY, or forced via env)."""
    raw = os.environ.get("ELITEEW_LOG_USER_COLOR", "").strip().lower()
    if raw in ("0", "false", "no", "off"):
        return False
    if raw in ("1", "true", "yes", "on"):
        return True
    # default: follow console color policy
    if os.environ.get("ELITEEW_LOG_COLOR", "").strip().lower() in ("1", "true", "yes", "on"):
        return True
    try:
        return bool(sys.stderr.isatty())
    except Exception as exc:
        logger.debug("[STEP] log_user_color_isatty_skip err=%s", exc)
        return False


def ansi_fg_for_user_label(label: str) -> str:
    """Stable ANSI SGR foreground code for a user string (same user → same color)."""
    if not label:
        return "\033[0m"
    h = int(hashlib.sha256(label.encode("utf-8")).hexdigest()[:8], 16)
    code = _USER_FG_PALETTE[h % len(_USER_FG_PALETTE)]
    return f"\033[{code}m"


def try_extract_user_label(text: str) -> str | None:
    """Best-effort user key for coloring: OAuth-style text first, then JSON fields."""
    if not text:
        return None
    m = _PLAIN_USER_AUTH.search(text)
    if m:
        return m.group(1)
    for rx in _JSON_LABEL_ORDER:
        m = rx.search(text)
        if m:
            return m.group(1)
    return None


def wrap_full_line_user_colored(rendered_message: str) -> str:
    """Wrap once in user-derived FG and reset only at end (no embedded reset after the username substring)."""
    if not rendered_message or not should_apply_user_color():
        return rendered_message
    label = try_extract_user_label(rendered_message)
    if not label:
        return rendered_message
    if rendered_message.startswith("\033["):
        return rendered_message
    return f"{ansi_fg_for_user_label(label)}{rendered_message}{_RESET}"


class UserColorConsoleFilter(logging.Filter):
    """Recolor entire formatted message once `msg % args` is known (runs before Formatter). stderr-only."""

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003
        if not should_apply_user_color():
            return True
        try:
            raw = record.getMessage()
        except Exception:
            return True
        if not isinstance(raw, str) or not raw:
            return True
        colored = wrap_full_line_user_colored(raw)
        if colored is raw:
            return True
        record.msg = colored
        record.args = ()
        return True


_USER_COLOR_FILTER = UserColorConsoleFilter()
_USER_COLOR_HANDLERS: set[int] = set()


def _is_stderr_stream_handler(handler: logging.Handler) -> bool:
    if isinstance(handler, logging.FileHandler):
        return False
    if not isinstance(handler, logging.StreamHandler):
        return False
    stream = getattr(handler, "stream", None)
    return stream is sys.stderr


def ensure_user_color_filter_on_stderr_handlers() -> None:
    """Attach full-line user-color filter to stderr handlers (not file). Idempotent."""
    loggers: list[logging.Logger] = [logging.root]
    for name in logging.Logger.manager.loggerDict:
        lg = logging.getLogger(name)
        if isinstance(lg, logging.Logger):
            loggers.append(lg)
    for lg in loggers:
        for h in lg.handlers:
            if not _is_stderr_stream_handler(h):
                continue
            hid = id(h)
            if hid in _USER_COLOR_HANDLERS:
                continue
            _USER_COLOR_HANDLERS.add(hid)
            h.addFilter(_USER_COLOR_FILTER)
