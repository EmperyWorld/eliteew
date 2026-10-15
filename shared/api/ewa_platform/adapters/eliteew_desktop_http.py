# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# ``DesktopShellDriver`` implementation: EliteEW shell-state over HTTP (GET/PATCH).
# Invariants:
# - No ``api.services.amka_core`` import; ``patch_shell_state`` maps to PATCH body as in
#   ``DesktopShellStatePatch``; other intent kinds return a structured skip (no silent success).
# - ``httpx`` transport faults (timeouts, refused connection) yield ``ok: False`` / ``transport_error``, not raises.
# Related:
# - api/ewa_platform/drivers/desktop_shell.py
# - api/ewa_platform/drivers/registry.py (ELITEEW_DESKTOP_DRIVER_ID)
# - api/ewa_platform/gateways/desktop_http.py
# - api/routers/desktop.py (shell-state handlers)
# ---
"""EliteEW HTTP desktop driver (shell-state + desktop config).

Maps ``patch_shell_state`` to ``PATCH /api/v1/desktop/shell-state`` and
``patch_desktop_config`` to ``PATCH /api/v1/desktop/config``; other intent kinds return a
structured skip (no silent success).
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from typing import Any

import httpx

from api.ewa_platform.adapters.http_client_config import HttpClientConfig
from api.ewa_platform.contracts.desktop_config_patch_wire import sanitize_patch_desktop_config_wire
from api.ewa_platform.contracts.desktop_intent import DesktopIntentKind
from api.ewa_platform.drivers.registry import ELITEEW_DESKTOP_DRIVER_ID
from api.ewa_platform.gateways.desktop_http import eliteew_desktop_config_url, eliteew_shell_state_url


class EliteEwDesktopHttpDriverStub:
    """HTTP-backed ``DesktopShellDriver`` (name kept for import stability)."""

    def __init__(
        self,
        config: HttpClientConfig,
        *,
        bearer_token: str | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._config = config
        self._bearer_token = bearer_token
        self._client = client

    @property
    def driver_id(self) -> str:
        return ELITEEW_DESKTOP_DRIVER_ID

    def _shell_state_url(self) -> str:
        return eliteew_shell_state_url(self._config.base_url, path=self._config.shell_state_path)

    def _desktop_config_url(self) -> str:
        return eliteew_desktop_config_url(self._config.base_url)

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

    async def execute_intent(self, intent: Mapping[str, Any]) -> Mapping[str, Any]:
        if not self._bearer_token:
            return {"ok": False, "reason": "missing_bearer_token"}

        kind = intent.get("intent_kind")

        if kind == DesktopIntentKind.PATCH_DESKTOP_CONFIG.value:
            patch_raw = intent.get("patch")
            if patch_raw is None or not isinstance(patch_raw, Mapping):
                return {"ok": False, "reason": "invalid_or_missing_patch"}
            body = sanitize_patch_desktop_config_wire(patch_raw)
            if not body:
                return {"ok": False, "reason": "empty_patch_after_sanitize"}

            url = self._desktop_config_url()
            headers = {**self._auth_headers(), "Content-Type": "application/json"}

            try:
                async with self._http_client() as client:
                    response = await client.patch(url, headers=headers, json=body)
            except httpx.RequestError as exc:
                return {
                    "ok": False,
                    "reason": "transport_error",
                    "detail": str(exc)[:512],
                }

            if response.status_code == httpx.codes.UNPROCESSABLE_ENTITY:
                return {
                    "ok": False,
                    "reason": "validation_error",
                    "status_code": response.status_code,
                    "detail": response.text[:2048],
                }
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                return {
                    "ok": False,
                    "reason": "http_error",
                    "status_code": exc.response.status_code,
                    "detail": exc.response.text[:2048],
                }

            try:
                payload = response.json()
            except ValueError:
                return {"ok": False, "reason": "invalid_json_response", "detail": response.text[:512]}

            if not isinstance(payload, Mapping):
                return {"ok": False, "reason": "unexpected_response_shape"}
            return {"ok": True, "desktop_config": dict(payload)}

        if kind != DesktopIntentKind.PATCH_SHELL_STATE.value:
            return {
                "ok": False,
                "reason": "unsupported_intent_for_shell_state_http",
                "intent_kind": str(kind),
            }

        patch = intent.get("patch")
        if patch is None or not isinstance(patch, Mapping):
            return {"ok": False, "reason": "invalid_or_missing_patch"}

        url = self._shell_state_url()
        headers = {**self._auth_headers(), "Content-Type": "application/json"}
        body = dict(patch)

        try:
            async with self._http_client() as client:
                response = await client.patch(url, headers=headers, json=body)
        except httpx.RequestError as exc:
            return {
                "ok": False,
                "reason": "transport_error",
                "detail": str(exc)[:512],
            }

        if response.status_code == httpx.codes.UNPROCESSABLE_ENTITY:
            return {
                "ok": False,
                "reason": "validation_error",
                "status_code": response.status_code,
                "detail": response.text[:2048],
            }
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            return {
                "ok": False,
                "reason": "http_error",
                "status_code": exc.response.status_code,
                "detail": exc.response.text[:2048],
            }

        try:
            payload = response.json()
        except ValueError:
            return {"ok": False, "reason": "invalid_json_response", "detail": response.text[:512]}

        if not isinstance(payload, Mapping):
            return {"ok": False, "reason": "unexpected_response_shape"}
        return {"ok": True, "shell_state": dict(payload)}

    async def read_shell_snapshot(self) -> Mapping[str, Any]:
        if not self._bearer_token:
            return {"ok": False, "reason": "missing_bearer_token"}

        url = self._shell_state_url()
        headers = self._auth_headers()

        try:
            async with self._http_client() as client:
                response = await client.get(url, headers=headers)
        except httpx.RequestError as exc:
            return {
                "ok": False,
                "reason": "transport_error",
                "detail": str(exc)[:512],
            }

        if response.status_code == httpx.codes.NOT_MODIFIED:
            return {"ok": True, "not_modified": True, "shell_state": {}}

        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            return {
                "ok": False,
                "reason": "http_error",
                "status_code": exc.response.status_code,
                "detail": exc.response.text[:2048],
            }

        try:
            payload = response.json()
        except ValueError:
            return {"ok": False, "reason": "invalid_json_response", "detail": response.text[:512]}

        if not isinstance(payload, Mapping):
            return {"ok": False, "reason": "unexpected_response_shape"}
        return {"ok": True, "shell_state": dict(payload)}
