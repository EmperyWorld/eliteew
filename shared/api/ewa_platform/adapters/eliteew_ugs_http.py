# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# ``UgsControlDriver`` over EliteEW HTTP (read-only core-alignment facades under ``/api/v1/ewa/ugs/``).
# Invariants:
# - No ``api.services.amka_core`` import from this module; bearer token passed separately.
# Related:
# - api/ewa_platform/gateways/routers/standalone_facade.py
# - api/ewa_platform/drivers/ugs_control.py
# - api/ewa_platform/drivers/registry.py (UGS_CONTROL_DRIVER_ID)
# ---
"""EliteEW HTTP UGS driver implementation for **EWA** orchestration hints (read-only)."""

from __future__ import annotations

from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from typing import Any, Literal

import httpx

from api.ewa_platform.adapters.http_client_config import HttpClientConfig
from api.ewa_platform.drivers.registry import UGS_CONTROL_DRIVER_ID

UgsHttpProfile = Literal["model_routing", "generation_inventory"]


def _alignment_path(profile: UgsHttpProfile) -> str:
    if profile == "generation_inventory":
        return "/api/v1/ewa/ugs/generation-inventory/core-alignment"
    return "/api/v1/ewa/ugs/model-routing/core-alignment"


class EliteEwUgsHttpDriverStub:
    """HTTP-backed ``UgsControlDriver`` (read configuration hint via core-alignment JSON)."""

    def __init__(
        self,
        config: HttpClientConfig,
        *,
        bearer_token: str | None = None,
        profile: UgsHttpProfile = "model_routing",
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._config = config
        self._bearer_token = bearer_token
        self._profile: UgsHttpProfile = profile
        self._client = client

    @property
    def driver_id(self) -> str:
        return UGS_CONTROL_DRIVER_ID

    def _url(self) -> str:
        base = self._config.base_url.strip().rstrip("/")
        return f"{base}{_alignment_path(self._profile)}"

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
        hint = await self.read_configuration_hint()
        return {"ok": hint.get("ok", False), "driver_id": self.driver_id, "profile": self._profile}

    async def read_configuration_hint(self) -> Mapping[str, Any]:
        if not self._bearer_token:
            return {"ok": False, "reason": "missing_bearer_token", "driver_id": self.driver_id}

        url = self._url()
        headers = self._auth_headers()

        try:
            async with self._http_client() as client:
                response = await client.get(url, headers=headers)
        except httpx.RequestError as exc:
            return {
                "ok": False,
                "reason": "transport_error",
                "error": type(exc).__name__,
                "profile": self._profile,
                "driver_id": self.driver_id,
            }

        if response.status_code >= 400:
            return {
                "ok": False,
                "reason": "http_error",
                "status_code": response.status_code,
                "detail": (response.text or "")[:1024],
                "profile": self._profile,
            }

        try:
            payload = response.json()
        except ValueError:
            return {"ok": False, "reason": "invalid_json_response", "profile": self._profile}

        keys: list[str] = []
        if isinstance(payload, dict):
            keys = [str(k) for k in list(payload.keys())[:48]]

        return {
            "ok": True,
            "profile": self._profile,
            "alignment_top_level_keys": keys,
            "driver_id": self.driver_id,
        }
