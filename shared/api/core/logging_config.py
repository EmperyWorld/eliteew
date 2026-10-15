# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Central stdlib + structlog configuration: stderr `_ColorFormatter`, optional file tee, Socket.IO/Uvicorn alignment helpers.
# Periodic `pulse_align_stderr_handlers` re-applies formatter when Uvicorn attaches console handlers late.
# Invariants:
# - Redaction attaches before emission; stderr user-color filters run on stream handlers only (see `log_user_color`).
# - `align_foreign_stderr_logging` is safe to call multiple times after third-party handlers appear.
# - Uvicorn default `LOGGING_CONFIG`: `uvicorn.access` → **stdout**, `uvicorn` → stderr — both are aligned.
# Related:
# - `api.utils.log_redaction`, `api.utils.log_user_color`; env `ELITEEW_LOG_COLOR`,
#   `ELITEEW_SOCKETIO_LIBRARY_LOG`; optional pulse tuning `ELITEEW_LOG_ALIGN_ROUNDS`,
#   `ELITEEW_LOG_ALIGN_INTERVAL_SEC`.
# ---
"""Centralized structured logging configuration using structlog."""

from __future__ import annotations

import asyncio
import logging
import os
import sys

import structlog  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings
from api.utils.log_redaction import ensure_redact_filter_on_all_handlers
from api.utils.log_user_color import ensure_user_color_filter_on_stderr_handlers

DEFAULT_LOG_LEVEL = unified_settings.log_level.upper()

# По умолчанию пишем в файл рядом с проектом, чтобы логи было видно
DEFAULT_LOG_FILE = "logs/eliteew-api.log"

# ANSI colors for console (when TTY). Use ELITEEW_LOG_COLOR=1 to force color in Docker.
_RESET = "\033[0m"
# Level colors: DEBUG=dim cyan, INFO=green, WARNING=bold yellow, ERROR=bold red
_COLOR_DEBUG = "\033[0;36m"
_COLOR_INFO = "\033[0;32m"
_COLOR_WARNING = "\033[1;33m"  # bold yellow — хорошо видно
_COLOR_ERROR = "\033[1;31m"  # bold red — ошибки бросаются в глаза

# Короткие префиксы уровня (в том же цвете), чтобы в потоке логов сразу видеть уровень
_LEVEL_PREFIX = {
    logging.DEBUG: "[DBG] ",
    logging.INFO: "[INF] ",
    logging.WARNING: "[WRN] ",
    logging.ERROR: "[ERR] ",
    logging.CRITICAL: "[CRIT] ",
}


def _truthy_eliteew_log_color() -> bool:
    return os.environ.get("ELITEEW_LOG_COLOR", "").strip().lower() in ("1", "true", "yes")


def _streams_equivalent_process_console(stream: object | None) -> bool:
    """Match handlers wired to **process** stdin/out/err — Uvicorn access uses ``sys.stdout`` by default."""

    if stream is None:
        return False
    if stream is sys.stderr or stream is sys.stdout:
        return True
    try:
        c = stream.fileno()  # type: ignore[attr-defined]
    except Exception:
        nm = getattr(stream, "name", None)

        return nm in ("<stderr>", "<stdout>") if nm else False

    for ref in (sys.stderr, sys.stdout):
        try:
            rfd = ref.fileno()

        except Exception:
            continue
        if isinstance(c, int) and isinstance(rfd, int) and c == rfd:
            return True

    return False


class _ColorFormatter(logging.Formatter):
    """Окрашивает строку лога по уровню и добавляет префикс [ERR]/[WRN] для быстрого поиска."""

    def __init__(self, stream: object, force_color: bool = False) -> None:
        super().__init__("%(message)s")
        self._stream = stream
        self._force = force_color

    def format(self, record: logging.LogRecord) -> str:
        msg = super().format(record)
        prefix = _LEVEL_PREFIX.get(record.levelno, "")
        line = f"{prefix}{msg}"

        use_color = self._force or getattr(self._stream, "isatty", lambda: False)()
        if not use_color:
            return line

        if record.levelno >= logging.ERROR:
            return f"{_COLOR_ERROR}{line}{_RESET}"

        if record.levelno >= logging.WARNING:
            return f"{_COLOR_WARNING}{line}{_RESET}"

        if record.levelno >= logging.INFO:
            return f"{_COLOR_INFO}{line}{_RESET}"

        return f"{_COLOR_DEBUG}{line}{_RESET}"


def _get_log_level(level: str | None) -> int:
    normalized = (level or DEFAULT_LOG_LEVEL).upper()
    return getattr(logging, normalized, logging.INFO)


def configure_logging(level: str | None = None) -> None:
    """Configure stdlib logging and structlog for JSON output.
    Logs go to stderr (docker logs / console) and optionally to a file.
    When stderr is a TTY or ELITEEW_LOG_COLOR=1, lines are colored by level.
    """
    log_level = _get_log_level(level)

    # Reset any existing configuration to avoid duplicate handlers when reloading
    logging.root.handlers = []
    stream = sys.stderr
    force_color = _truthy_eliteew_log_color()
    stream_handler = logging.StreamHandler(stream)
    stream_handler.setFormatter(_ColorFormatter(stream, force_color=force_color))
    handlers: list[logging.Handler] = [stream_handler]

    # Дублируем логи в файл: ELITEEW_LOG_FILE или по умолчанию logs/eliteew-api.log
    log_file = getattr(unified_settings, "log_file", None)
    log_path = log_file or os.environ.get("ELITEEW_LOG_FILE", DEFAULT_LOG_FILE)
    try:
        log_dir = os.path.dirname(log_path)
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)
        file_handler = logging.FileHandler(log_path, encoding="utf-8")
        file_handler.setLevel(log_level)
        file_handler.setFormatter(logging.Formatter("%(message)s"))
        handlers.append(file_handler)
    except OSError:
        pass  # без файла — только stderr

    logging.basicConfig(
        level=log_level,
        format="%(message)s",
        handlers=handlers,
    )

    ensure_redact_filter_on_all_handlers()
    ensure_user_color_filter_on_stderr_handlers()

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Align FastAPI / Uvicorn loggers with the configured level
    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(logger_name).setLevel(log_level)


def align_foreign_stderr_logging() -> None:
    """Unify duplicates from Socket.IO/Engine.IO and Uvicorn access lines with `_ColorFormatter`.

    Built-in Socket.IO installs raw ``StreamHandler``s plus propagation → two identical lines plus raw ``INFO:``.
    Uvicorn ships **access** logs on **stdout** handlers (see ``uvicorn.config.LOGGING_CONFIG``); those must be
    swapped too, not only stderr. Clearing leaf engineio/socketio handlers restores a single ``[INF]`` path.

    Transport ping logs default to WARNING unless ``ELITEEW_SOCKETIO_LIBRARY_LOG``.
    """
    stderr = sys.stderr
    force_color = _truthy_eliteew_log_color()

    lib_verbose = os.environ.get("ELITEEW_SOCKETIO_LIBRARY_LOG", "").strip().lower() in ("1", "true", "yes")
    eo = logging.getLogger("engineio.server")
    so = logging.getLogger("socketio.server")

    eo.handlers.clear()
    so.handlers.clear()

    eo.propagate = True
    so.propagate = True

    if lib_verbose:
        eo.setLevel(logging.INFO)
        so.setLevel(logging.INFO)
    else:
        eo.setLevel(logging.WARNING)
        so.setLevel(logging.WARNING)

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        replaced = False
        for handler in lg.handlers:
            if not isinstance(handler, logging.StreamHandler):
                continue
            stream = getattr(handler, "stream", None)
            if not _streams_equivalent_process_console(stream):
                continue

            use_stream = stream if stream is not None else stderr
            handler.setFormatter(_ColorFormatter(use_stream, force_color=force_color))

            replaced = True

        # Match historic Uvicorn config: keep access logs routed through handlers only.

        if replaced and name.startswith("uvicorn"):
            lg.propagate = False


async def pulse_align_stderr_handlers(*, rounds: int | None = None, delay_sec: float | None = None) -> None:
    """Re-run console alignment periodically: Uvicorn may attach stdout/stderr handlers late."""

    n = rounds if rounds is not None else int(os.getenv("ELITEEW_LOG_ALIGN_ROUNDS", "40"))

    delay = delay_sec if delay_sec is not None else float(os.getenv("ELITEEW_LOG_ALIGN_INTERVAL_SEC", "0.15"))

    for _ in range(max(1, n)):
        align_foreign_stderr_logging()

        ensure_redact_filter_on_all_handlers()

        ensure_user_color_filter_on_stderr_handlers()

        await asyncio.sleep(max(0.05, delay))


def bind_global_context(**kwargs: object) -> None:
    """Bind global context (e.g., service name, environment) once."""

    structlog.contextvars.bind_contextvars(**kwargs)
