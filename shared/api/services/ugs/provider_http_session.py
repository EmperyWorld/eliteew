# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Global aiohttp session singleton for UGS provider HTTP clients.
# Invariants:
# - Session is shared across ProviderManagerServiceV2 instances; closed on app shutdown only.
# Related:
# - api/services/ugs/provider_manager_service_v2.py
# ---

import asyncio
import logging

import aiohttp  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class _HTTPSessionState:
    """State holder for global HTTP session singleton."""

    http_session: aiohttp.ClientSession | None = None
    connector: aiohttp.TCPConnector | None = None


_http_session_state = _HTTPSessionState()
_session_lock = asyncio.Lock()


async def get_global_http_session() -> aiohttp.ClientSession:
    """Get or create global HTTP session singleton"""
    if _http_session_state.http_session is None or _http_session_state.http_session.closed:
        async with _session_lock:
            # Double-check after acquiring lock
            if _http_session_state.http_session is None or _http_session_state.http_session.closed:
                _http_session_state.connector = aiohttp.TCPConnector(limit=100, limit_per_host=30)
                _http_session_state.http_session = aiohttp.ClientSession(connector=_http_session_state.connector)
                logger.info("Global ProviderManagerServiceV2 HTTP session created")

    return _http_session_state.http_session  # type: ignore[return-value]


async def close_global_http_session() -> None:
    """Close global HTTP session (called on app shutdown)"""
    if _http_session_state.http_session and not _http_session_state.http_session.closed:
        try:
            await _http_session_state.http_session.close()
            if _http_session_state.connector:
                await _http_session_state.connector.close()
            logger.info("Global ProviderManagerServiceV2 HTTP session closed")
        except (OSError, ValueError, TypeError):  # fmt: skip
            logger.warning("Error closing global HTTP session")
        finally:
            _http_session_state.http_session = None
            _http_session_state.connector = None


class ProviderHTTPSessionMixin:
    """Mixin — HTTP session ensure for ProviderManagerServiceV2."""

    async def _ensure_http_session(self) -> None:
        """Ensure HTTP session is initialized"""
        if self.session is None or self.session.closed:
            self.session = await get_global_http_session()
            logger.debug("ProviderManagerServiceV2 HTTP session ensured")
