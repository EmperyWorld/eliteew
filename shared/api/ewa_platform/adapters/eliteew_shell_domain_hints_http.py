# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Read-only ``DocumentsWorkspaceDriver`` / ``ContentManagerDriver`` adapters backed by GET EliteEW ``shell-state`` JSON,
# with explicit optional subtree ``ewa_hints`` plus deterministic fallbacks from ``windows_snapshot`` / ``content_shortcuts``.
# Invariants:
# - No ``api.services.amka_core`` import; uses ``httpx`` and ``HttpClientConfig`` like ``eliteew_desktop_http``.
# - Hint payloads are JSON-safe mappings only (no mutation endpoints).
# - Corrupt ``ewa_hints`` subtree (wrong types) skips explicit hints and uses ``windows_snapshot`` / ``content_shortcuts`` fallbacks.
# Related:
# - shared/api/ewa_platform/desktop/runtime.py
# - shared/api/ewa_platform/docs/DRIVERS-ROADMAP.md §2.3–2.4
# - api/ewa_platform/contracts/domain_hints_wire.py
# - api/ewa_platform/contracts/ewa_shell_hints_wire.py
# ---
"""Shell-state HTTP hints for documents workspace and content manager ports."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable, Mapping
from contextlib import asynccontextmanager
from typing import Any

import httpx

from api.ewa_platform.adapters.http_client_config import HttpClientConfig
from api.ewa_platform.contracts.domain_driver_snapshots import DomainActionRiskTier
from api.ewa_platform.contracts.ewa_shell_hints_wire import (
    read_ewa_hints_subtree,
    shell_hints_subtree_relaxed_wellformed,
)
from api.ewa_platform.drivers.registry import CONTENT_MANAGER_DRIVER_ID, DOCUMENTS_WORKSPACE_DRIVER_ID
from api.ewa_platform.gateways.desktop_http import eliteew_shell_state_url

ShellStateFetchResult = tuple[Mapping[str, Any] | None, Mapping[str, Any] | None]


def documents_workspace_hint_from_shell_state(body: Mapping[str, Any]) -> dict[str, Any]:
    """Derive documents hint mapping from normalized shell-state JSON (unit-testable)."""

    hints_root = read_ewa_hints_subtree(body)
    if hints_root is not None and shell_hints_subtree_relaxed_wellformed(hints_root):
        embedded = hints_root.get("documents_workspace")
        if isinstance(embedded, Mapping) and embedded:
            out = dict(embedded)
            out.setdefault("source", "shell_state_explicit")
            return out

    ws = body.get("windows_snapshot")
    windows = ws.get("windows") if isinstance(ws, Mapping) else None
    items: list[dict[str, Any]] = []
    if isinstance(windows, list):
        for idx, raw in enumerate(windows):
            if not isinstance(raw, Mapping):
                continue
            if str(raw.get("type", "")).strip().lower() != "app":
                continue
            ac = raw.get("appComponent") if raw.get("appComponent") is not None else raw.get("app_component")
            title = raw.get("title")
            wid = _window_ref(raw, idx)
            entry: dict[str, Any] = {
                "window_id": wid,
                "app_component": ac if isinstance(ac, str) else None,
                "title": title if isinstance(title, str) else None,
            }
            items.append(entry)
    return {
        "open_document_count": len(items),
        "items": items,
        "source": "shell_windows_fallback",
    }


def content_manager_hint_from_shell_state(body: Mapping[str, Any]) -> dict[str, Any]:
    """Derive content-manager hint mapping from normalized shell-state JSON (unit-testable)."""

    hints_root = read_ewa_hints_subtree(body)
    if hints_root is not None and shell_hints_subtree_relaxed_wellformed(hints_root):
        embedded = hints_root.get("content_manager")
        if isinstance(embedded, Mapping) and embedded:
            out = dict(embedded)
            out.setdefault("source", "shell_state_explicit")
            return out

    shortcuts = body.get("content_shortcuts")
    roots: list[str] = []
    if isinstance(shortcuts, list):
        for s in shortcuts:
            if isinstance(s, Mapping):
                sid = s.get("id")
                if isinstance(sid, str) and sid.strip():
                    roots.append(sid.strip())
            elif isinstance(s, str) and s.strip():
                roots.append(s.strip())
    return {"roots": roots, "source": "content_shortcuts_fallback"}


def _window_ref(w: Mapping[str, Any], idx: int) -> str:
    path = w.get("path")
    if isinstance(path, list) and path:
        bits = [str(p) for p in path if p is not None and str(p).strip()]
        if bits:
            return "/".join(bits)
    ac = w.get("appComponent") if w.get("appComponent") is not None else w.get("app_component")
    if isinstance(ac, str) and ac.strip():
        return f"app:{ac.strip()}:{idx}"
    return f"window:{idx}"


class EliteEwShellStateHintHttpCache:
    """Per-turn shared cache for read-only shell-state hints.

    Documents and Content hint drivers often run in the same orchestration turn and read the same
    ``/api/v1/desktop/shell-state`` endpoint. This cache keeps that optional self-HTTP read single-flight.
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._result: ShellStateFetchResult | None = None

    async def get_or_fetch(self, fetcher: Callable[[], Awaitable[ShellStateFetchResult]]) -> ShellStateFetchResult:
        """Return the cached shell-state result, fetching it once when absent."""

        if self._result is not None:
            return self._result
        async with self._lock:
            if self._result is None:
                self._result = await fetcher()
        return self._result


class EliteEwDocumentsWorkspaceShellHintHttpDriver:
    """HTTP GET shell-state → documents workspace hint (read-only)."""

    def __init__(
        self,
        config: HttpClientConfig,
        *,
        bearer_token: str | None = None,
        client: httpx.AsyncClient | None = None,
        state_cache: EliteEwShellStateHintHttpCache | None = None,
    ) -> None:
        self._config = config
        self._bearer_token = bearer_token
        self._client = client
        self._state_cache = state_cache

    @property
    def driver_id(self) -> str:
        return DOCUMENTS_WORKSPACE_DRIVER_ID

    @property
    def max_supported_risk_tier(self) -> DomainActionRiskTier:
        return DomainActionRiskTier.READ_ONLY

    def _shell_state_url(self) -> str:
        return eliteew_shell_state_url(self._config.base_url, path=self._config.shell_state_path)

    def _auth_headers(self) -> dict[str, str]:
        if not self._bearer_token:
            return {}
        return {"Authorization": f"Bearer {self._bearer_token}"}

    @asynccontextmanager
    async def _http_client(self) -> AsyncIterator[httpx.AsyncClient]:
        if self._client is not None:
            yield self._client
            return
        timeout = httpx.Timeout(self._config.timeout_sec)
        async with httpx.AsyncClient(timeout=timeout, verify=self._config.verify_tls) as client:
            yield client

    async def ping(self) -> Mapping[str, Any]:
        return {"ok": True, "driver_id": self.driver_id}

    async def _fetch_shell_state_payload(self) -> ShellStateFetchResult:
        try:
            async with self._http_client() as client:
                response = await client.get(self._shell_state_url(), headers=self._auth_headers())
        except httpx.RequestError as exc:
            return None, {"source": "shell_state_transport_error", "error": type(exc).__name__}
        if response.status_code != httpx.codes.OK:
            return None, {"source": "shell_state_http_error", "status_code": response.status_code}
        try:
            payload = response.json()
        except ValueError:
            return None, {"source": "invalid_json"}
        if not isinstance(payload, Mapping):
            return None, {"source": "unexpected_shape"}
        return payload, None

    async def _shell_state_payload(self) -> ShellStateFetchResult:
        if self._state_cache is None:
            return await self._fetch_shell_state_payload()
        return await self._state_cache.get_or_fetch(self._fetch_shell_state_payload)

    async def describe_open_documents_hint(self) -> Mapping[str, Any]:
        if not self._bearer_token:
            return {"open_document_count": 0, "items": [], "source": "missing_bearer_token"}
        payload, error = await self._shell_state_payload()
        if error is not None:
            return {
                "open_document_count": 0,
                "items": [],
                **dict(error),
            }
        return documents_workspace_hint_from_shell_state(payload)


class EliteEwContentManagerShellHintHttpDriver:
    """HTTP GET shell-state → content-manager roots hint (read-only)."""

    def __init__(
        self,
        config: HttpClientConfig,
        *,
        bearer_token: str | None = None,
        client: httpx.AsyncClient | None = None,
        state_cache: EliteEwShellStateHintHttpCache | None = None,
    ) -> None:
        self._config = config
        self._bearer_token = bearer_token
        self._client = client
        self._state_cache = state_cache

    @property
    def driver_id(self) -> str:
        return CONTENT_MANAGER_DRIVER_ID

    @property
    def max_supported_risk_tier(self) -> DomainActionRiskTier:
        return DomainActionRiskTier.READ_ONLY

    def _shell_state_url(self) -> str:
        return eliteew_shell_state_url(self._config.base_url, path=self._config.shell_state_path)

    def _auth_headers(self) -> dict[str, str]:
        if not self._bearer_token:
            return {}
        return {"Authorization": f"Bearer {self._bearer_token}"}

    @asynccontextmanager
    async def _http_client(self) -> AsyncIterator[httpx.AsyncClient]:
        if self._client is not None:
            yield self._client
            return
        timeout = httpx.Timeout(self._config.timeout_sec)
        async with httpx.AsyncClient(timeout=timeout, verify=self._config.verify_tls) as client:
            yield client

    async def ping(self) -> Mapping[str, Any]:
        return {"ok": True, "driver_id": self.driver_id}

    async def _fetch_shell_state_payload(self) -> ShellStateFetchResult:
        try:
            async with self._http_client() as client:
                response = await client.get(self._shell_state_url(), headers=self._auth_headers())
        except httpx.RequestError as exc:
            return None, {"source": "shell_state_transport_error", "error": type(exc).__name__}
        if response.status_code != httpx.codes.OK:
            return None, {"source": "shell_state_http_error", "status_code": response.status_code}
        try:
            payload = response.json()
        except ValueError:
            return None, {"source": "invalid_json"}
        if not isinstance(payload, Mapping):
            return None, {"source": "unexpected_shape"}
        return payload, None

    async def _shell_state_payload(self) -> ShellStateFetchResult:
        if self._state_cache is None:
            return await self._fetch_shell_state_payload()
        return await self._state_cache.get_or_fetch(self._fetch_shell_state_payload)

    async def list_entity_roots_hint(self) -> Mapping[str, Any]:
        if not self._bearer_token:
            return {"roots": [], "source": "missing_bearer_token"}
        payload, error = await self._shell_state_payload()
        if error is not None:
            return {"roots": [], **dict(error)}
        return content_manager_hint_from_shell_state(payload)
