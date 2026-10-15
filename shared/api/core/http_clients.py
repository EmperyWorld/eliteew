#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Centralized aiohttp/httpx clients shared across the app and Celery workers.
# Invariants:
# - Clients are bound to one owning event loop; drop refs only when that loop is
#   closed or replaced — never on every Celery task.
# - Close clients on process/worker shutdown via close_http_clients().
# Related:
# - api/core/celery_async.py
# ---
"""Centralized HTTP clients (aiohttp and httpx) for the application.

All long-lived HTTP sessions must use these shared clients so they are
closed in one place at shutdown, preventing "Unclosed client session"
and "Unclosed connector" leaks.

Usage:
  from api.core.http_clients import get_aiohttp_session, get_httpx_client

  session = get_aiohttp_session()
  async with session.get(url) as resp: ...

  client = get_httpx_client()
  resp = await client.get(url)
"""

from __future__ import annotations

import asyncio
import logging

import aiohttp  # type: ignore[import-not-found]
import httpx  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)

_aiohttp_session: aiohttp.ClientSession | None = None
_httpx_client: httpx.AsyncClient | None = None
_clients_owner_loop: asyncio.AbstractEventLoop | None = None
_lock = asyncio.Lock()


def _current_loop_or_none() -> asyncio.AbstractEventLoop | None:
    try:
        return asyncio.get_running_loop()
    except RuntimeError:
        return None


def _clients_bound_to_loop(loop: asyncio.AbstractEventLoop) -> bool:
    return (
        _clients_owner_loop is loop
        and not loop.is_closed()
        and _aiohttp_session is not None
        and not _aiohttp_session.closed
        and _httpx_client is not None
        and not _httpx_client.is_closed
    )


async def init_http_clients() -> None:
    """Create shared aiohttp and httpx clients. Call once at app startup."""
    global _aiohttp_session, _httpx_client, _clients_owner_loop  # noqa: PLW0603

    loop = asyncio.get_running_loop()
    async with _lock:
        if _clients_bound_to_loop(loop):
            return
        # Stale refs from a previous/closed loop: forget without awaiting close
        # on the wrong loop (close_http_clients owns orderly shutdown).
        if _clients_owner_loop is not None and _clients_owner_loop is not loop:
            _aiohttp_session = None
            _httpx_client = None
            _clients_owner_loop = None
        if _aiohttp_session is None or _aiohttp_session.closed:
            _aiohttp_session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=300),
                connector=aiohttp.TCPConnector(limit=100, limit_per_host=30),
            )
            logger.info("Central aiohttp ClientSession created")
        if _httpx_client is None or _httpx_client.is_closed:
            _httpx_client = httpx.AsyncClient(
                timeout=httpx.Timeout(60.0, connect=10.0),
                limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
            )
            logger.info("Central httpx AsyncClient created")
        _clients_owner_loop = loop


async def close_http_clients() -> None:
    """Close shared HTTP clients. Call once at app shutdown."""
    global _aiohttp_session, _httpx_client, _clients_owner_loop  # noqa: PLW0603

    async with _lock:
        if _aiohttp_session and not _aiohttp_session.closed:
            try:
                await _aiohttp_session.close()
                logger.info("Central aiohttp ClientSession closed")
            except (OSError, ValueError, TypeError) as exc:
                logger.warning("Error closing aiohttp session: %s", exc)
            finally:
                _aiohttp_session = None

        if _httpx_client and not _httpx_client.is_closed:
            try:
                await _httpx_client.aclose()
                logger.info("Central httpx AsyncClient closed")
            except (OSError, ValueError, TypeError) as exc:
                logger.warning("Error closing httpx client: %s", exc)
            finally:
                _httpx_client = None
        _clients_owner_loop = None


def get_aiohttp_session() -> aiohttp.ClientSession:
    """Return the shared aiohttp ClientSession. Must be called after init_http_clients()."""
    if _aiohttp_session is None or _aiohttp_session.closed:
        raise RuntimeError("HTTP clients not initialized; call init_http_clients() during app startup")
    return _aiohttp_session


def get_httpx_client() -> httpx.AsyncClient:
    """Return the shared httpx AsyncClient. Must be called after init_http_clients()."""
    if _httpx_client is None or _httpx_client.is_closed:
        raise RuntimeError("HTTP clients not initialized; call init_http_clients() during app startup")
    return _httpx_client


def drop_http_clients_for_closed_loop() -> None:
    """Forget loop-bound sessions only when the owning loop is closed or replaced."""
    global _aiohttp_session, _httpx_client, _clients_owner_loop  # noqa: PLW0603

    if _aiohttp_session is None and _httpx_client is None and _clients_owner_loop is None:
        return

    loop = _current_loop_or_none()
    owner = _clients_owner_loop
    if owner is not None and not owner.is_closed() and loop is owner:
        # Same live loop — keep shared clients for the next Celery task.
        return

    _aiohttp_session = None
    _httpx_client = None
    _clients_owner_loop = None
    logger.debug(
        "[STEP] http_clients_drop_for_loop_change had_owner=%s current_same=%s",
        owner is not None,
        loop is owner if owner is not None else False,
    )
