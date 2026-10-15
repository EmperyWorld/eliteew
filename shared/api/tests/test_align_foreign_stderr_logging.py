# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Tests for ``align_foreign_stderr_logging`` — Engine.IO duplicate handlers cleared, Uvicorn console (stderr/stdout) formatters swapped.
# Invariants:
# - Tests mutate logging state; isolation via monkeypatch/logger cleanup restores expectations.
# Related:
# - api/core/logging_config.py
# ---

from __future__ import annotations

import logging
import sys

import pytest

pytest.importorskip("structlog")


def test_align_engineio_handlers_cleared(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_SOCKETIO_LIBRARY_LOG", "1")
    from api.core.logging_config import align_foreign_stderr_logging

    eo = logging.getLogger("engineio.server")
    eo.handlers.clear()

    eo.addHandler(logging.StreamHandler(sys.stderr))

    align_foreign_stderr_logging()

    assert eo.handlers == []


def test_align_uvicorn_access_stderr_gets_color_formatter(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_LOG_COLOR", "1")

    import api.core.logging_config as lc

    acc = logging.getLogger("uvicorn.access")

    prev_handlers = list(acc.handlers)

    acc.handlers.clear()
    stderr_h = logging.StreamHandler(sys.stderr)
    stderr_h.setFormatter(logging.Formatter("<legacy %(message)s>"))
    acc.addHandler(stderr_h)
    try:
        lc.align_foreign_stderr_logging()
        assert len(acc.handlers) == 1
        assert acc.handlers[0] is stderr_h
        rec = logging.LogRecord("uvicorn.access", logging.INFO, "p", 0, "probe line", (), None)
        out = stderr_h.format(rec)
        assert "[INF]" in out
        assert "probe line" in out

    finally:
        acc.handlers.clear()
        acc.handlers.extend(prev_handlers)


def test_align_uvicorn_stderr_fd_wrapped_formatter(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ELITEEW_LOG_COLOR", raising=False)

    import api.core.logging_config as lc

    acc = logging.getLogger("uvicorn.access")
    prev_handlers = list(acc.handlers)
    acc.handlers.clear()

    class _StdErrFdProxy:
        """Fake stream wrapping stderr FD — Uvicorn does not reuse ``sys.stderr`` identity."""

        __slots__ = ()

        def fileno(self) -> int:
            return sys.stderr.fileno()

        def isatty(self) -> bool:
            return sys.stderr.isatty()

        def write(self, s: str, /) -> int:

            return sys.stderr.write(s)

        def flush(self) -> None:
            sys.stderr.flush()

    pseudo = logging.StreamHandler(_StdErrFdProxy())

    pseudo.setFormatter(logging.Formatter("<legacy %(message)s>"))

    acc.addHandler(pseudo)
    try:
        lc.align_foreign_stderr_logging()
        assert len(acc.handlers) == 1

        assert acc.handlers[0] is pseudo

        rec = logging.LogRecord("uvicorn.access", logging.INFO, "p", 0, "via fd-proxy", (), None)

        formatted = pseudo.format(rec)

        assert "[INF]" in formatted

        assert "via fd-proxy" in formatted

    finally:
        acc.handlers.clear()
        acc.handlers.extend(prev_handlers)


def test_align_uvicorn_access_stdout_handler_gets_formatter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Uvicorn ``LOGGING_CONFIG`` wires ``uvicorn.access`` to ``sys.stdout``, not stderr."""

    monkeypatch.delenv("ELITEEW_LOG_COLOR", raising=False)

    import api.core.logging_config as lc

    acc = logging.getLogger("uvicorn.access")
    prev_handlers = list(acc.handlers)
    acc.handlers.clear()

    out_h = logging.StreamHandler(sys.stdout)
    out_h.setFormatter(logging.Formatter("<legacy %(message)s>"))
    acc.addHandler(out_h)
    try:
        lc.align_foreign_stderr_logging()
        assert len(acc.handlers) == 1
        assert acc.handlers[0] is out_h

        rec = logging.LogRecord("uvicorn.access", logging.INFO, "p", 0, "access-line", (), None)

        assert "[INF]" in out_h.format(rec)

        assert "access-line" in out_h.format(rec)

    finally:
        acc.handlers.clear()
        acc.handlers.extend(prev_handlers)


def test_align_uvicorn_stdout_fd_wrapped_formatter(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ELITEEW_LOG_COLOR", raising=False)

    import api.core.logging_config as lc

    acc = logging.getLogger("uvicorn.access")
    prev_handlers = list(acc.handlers)
    acc.handlers.clear()

    class _StdoutFdProxy:
        __slots__ = ()

        def fileno(self) -> int:
            return sys.stdout.fileno()

        def isatty(self) -> bool:
            return sys.stdout.isatty()

        def write(self, s: str, /) -> int:

            return sys.stdout.write(s)

        def flush(self) -> None:
            sys.stdout.flush()

    pseudo = logging.StreamHandler(_StdoutFdProxy())
    pseudo.setFormatter(logging.Formatter("<legacy %(message)s>"))
    acc.addHandler(pseudo)
    try:
        lc.align_foreign_stderr_logging()
        assert len(acc.handlers) == 1

        rec = logging.LogRecord("uvicorn.access", logging.INFO, "p", 0, "via stdout fd-proxy", (), None)

        formatted = pseudo.format(rec)

        assert "[INF]" in formatted

        assert "via stdout fd-proxy" in formatted

    finally:
        acc.handlers.clear()
        acc.handlers.extend(prev_handlers)
