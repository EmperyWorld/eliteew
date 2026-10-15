# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Custom asyncio loop exception handler that downgrades benign websocket close noise.
# Invariants:
# - ConnectionClosedOK (code 1000) is a normal client disconnect, not an application error.
# - All other asyncio loop exceptions keep default logging behavior.
# Related:
# - api/main.py lifespan
# - api/core/logging_config.py
# ---

"""Asyncio exception handler helpers for EliteEW API."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _is_benign_websocket_close(exc: BaseException | None) -> bool:
    if exc is None:
        return False
    name = type(exc).__name__
    if name == "ConnectionClosedOK":
        return True
    mod = getattr(type(exc), "__module__", "") or ""
    return mod.startswith("websockets.") and name.startswith("ConnectionClosed")


def install_asyncio_exception_handler(*, loop: asyncio.AbstractEventLoop | None = None) -> None:
    """Register handler that suppresses ERROR noise from normal websocket disconnects."""

    target = loop or asyncio.get_running_loop()
    custom_handler = target.get_exception_handler()

    def _handler(inner_loop: asyncio.AbstractEventLoop, context: dict[str, Any]) -> None:
        exc = context.get("exception")
        if _is_benign_websocket_close(exc if isinstance(exc, BaseException) else None):
            logger.debug(
                "asyncio benign websocket close: %s",
                context.get("message") or type(exc).__name__,
            )
            return
        if custom_handler is not None:
            custom_handler(inner_loop, context)
        else:
            inner_loop.default_exception_handler(context)

    target.set_exception_handler(_handler)
