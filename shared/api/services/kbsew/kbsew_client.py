# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# HTTP client for stack0 to KBSEW internal API (search and future read paths).
# Invariants:
# - Uses KBSEW_SERVICE_URL and optional KBSEW_INTERNAL_SERVICE_TOKEN for auth.
# - Maps KBSEW 409 index_stale / barrel-disabled to typed errors (not opaque 502).
# - search payload may include retrieval_mode dense|hybrid for upstream KBSEW.
# Related:
# - api/routers/kbsew_gateway.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

from api.services.kbsew.kbsew_trace import get_kbsew_trace_id

logger = logging.getLogger(__name__)

KBSEW_SERVICE_URL = os.getenv("KBSEW_SERVICE_URL", "http://stack-kbsew:8030").rstrip("/")
KBSEW_INTERNAL_SERVICE_TOKEN = os.getenv("KBSEW_INTERNAL_SERVICE_TOKEN", "").strip()
_SEARCH_TIMEOUT = 60.0


class KbsewClientError(RuntimeError):
    """KBSEW HTTP client failure."""


class KbsewNotFoundError(KbsewClientError):
    """Barrel or resource not found."""


class KbsewServiceUnavailableError(KbsewClientError):
    """KBSEW or embedding dependency temporarily unavailable."""


class KbsewIndexStaleError(KbsewClientError):
    """Barrel index behind PIPELINE_VERSION (HTTP 409 index_stale)."""

    def __init__(
        self,
        message: str,
        *,
        stale_assets: int = 0,
        required_pipeline: str = "",
        barrel_id: str | None = None,
    ) -> None:
        super().__init__(message)
        self.stale_assets = int(stale_assets or 0)
        self.required_pipeline = str(required_pipeline or "").strip()
        self.barrel_id = barrel_id


class KbsewBarrelDisabledError(KbsewClientError):
    """Barrel exists but is disabled for search."""


_KBSEW_EMBED_UNAVAILABLE_MSG = "Knowledge base temporarily unavailable"


def _kbsew_headers(*, authorization: str | None = None) -> dict[str, str]:
    headers: dict[str, str] = {"accept": "application/json", "content-type": "application/json"}
    if authorization:
        headers["authorization"] = authorization
    elif KBSEW_INTERNAL_SERVICE_TOKEN:
        headers["X-KBSEW-Service-Token"] = KBSEW_INTERNAL_SERVICE_TOKEN
    trace_id = get_kbsew_trace_id()
    if trace_id:
        headers["X-KBSEW-Trace-Id"] = trace_id
    return headers


def _parse_error_payload(detail: str) -> dict[str, Any]:
    raw = (detail or "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if isinstance(parsed, dict):
        nested = parsed.get("detail")
        if isinstance(nested, dict):
            return nested
        return parsed
    return {}


def _map_kbsew_http_error(
    *,
    status_code: int,
    detail: str,
    barrel_id: str | None = None,
) -> KbsewClientError:
    payload = _parse_error_payload(detail)
    code = str(payload.get("code") or "").strip().lower()
    if status_code == 409 and code == "index_stale":
        logger.warning(
            "[STEP] kbsew_client_index_stale barrel_id=%s stale_assets=%s required_pipeline=%s trace_id=%s",
            barrel_id,
            payload.get("stale_assets"),
            payload.get("required_pipeline"),
            get_kbsew_trace_id(),
        )
        return KbsewIndexStaleError(
            "Knowledge base index is refreshing",
            stale_assets=int(payload.get("stale_assets") or 0),
            required_pipeline=str(payload.get("required_pipeline") or ""),
            barrel_id=barrel_id,
        )
    if status_code == 409:
        msg = str(payload.get("message") or detail or "barrel disabled").strip()
        if "disabled" in msg.lower() or "выключ" in msg.lower():
            return KbsewBarrelDisabledError(msg[:240] or "Barrel disabled")
        # Prefer structured index_stale even if code missing but fields present.
        if "stale" in msg.lower() or payload.get("required_pipeline"):
            return KbsewIndexStaleError(
                "Knowledge base index is refreshing",
                stale_assets=int(payload.get("stale_assets") or 0),
                required_pipeline=str(payload.get("required_pipeline") or ""),
                barrel_id=barrel_id,
            )
        return KbsewBarrelDisabledError(msg[:240] or "Barrel conflict")
    if status_code in {404, 503} and "embed" in detail.lower():
        logger.warning(
            "[STEP] kbsew_client_embed_unavailable status=%s barrel_id=%s trace_id=%s",
            status_code,
            barrel_id,
            get_kbsew_trace_id(),
        )
        return KbsewServiceUnavailableError(_KBSEW_EMBED_UNAVAILABLE_MSG)
    if status_code == 503:
        return KbsewServiceUnavailableError(_KBSEW_EMBED_UNAVAILABLE_MSG)
    return KbsewClientError(f"KBSEW request failed ({status_code})")


async def kbsew_list_barrels(*, authorization: str | None = None) -> list[dict[str, object]]:
    url = f"{KBSEW_SERVICE_URL}/api/v1/kbsew/barrels"
    try:
        async with httpx.AsyncClient(timeout=_SEARCH_TIMEOUT) as client:
            response = await client.get(url, headers=_kbsew_headers(authorization=authorization))
    except httpx.HTTPError as exc:
        logger.warning("[STEP] kbsew_client_list_barrels_http_fail trace_id=%s reason=%s", get_kbsew_trace_id(), exc)
        raise KbsewClientError("KBSEW barrel registry request failed") from exc

    if response.status_code >= 400:
        detail = response.text[:300]
        logger.warning(
            "[STEP] kbsew_client_list_barrels_http_error status=%s trace_id=%s detail=%s",
            response.status_code,
            get_kbsew_trace_id(),
            detail,
        )
        raise _map_kbsew_http_error(status_code=response.status_code, detail=detail)

    data = response.json()
    if not isinstance(data, list):
        return []
    return [item for item in data if isinstance(item, dict)]


async def kbsew_list_drivers(*, authorization: str | None = None) -> list[str]:
    url = f"{KBSEW_SERVICE_URL}/api/v1/kbsew/drivers"
    try:
        async with httpx.AsyncClient(timeout=_SEARCH_TIMEOUT) as client:
            response = await client.get(url, headers=_kbsew_headers(authorization=authorization))
    except httpx.HTTPError as exc:
        logger.warning("[STEP] kbsew_client_list_drivers_http_fail reason=%s", exc)
        raise KbsewClientError("KBSEW drivers request failed") from exc
    if response.status_code >= 400:
        detail = response.text[:300]
        raise _map_kbsew_http_error(status_code=response.status_code, detail=detail)
    data = response.json()
    types = data.get("driver_types") if isinstance(data, dict) else None
    if not isinstance(types, list):
        return []
    return [str(t).strip() for t in types if str(t).strip()]


async def kbsew_health_bundle() -> dict[str, Any]:
    """Unauthenticated /health + /ready for MCP ops probes."""
    out: dict[str, Any] = {}
    try:
        async with httpx.AsyncClient(timeout=_SEARCH_TIMEOUT) as client:
            health = await client.get(f"{KBSEW_SERVICE_URL}/health", headers={"accept": "application/json"})
            if health.status_code >= 400:
                raise KbsewClientError(f"KBSEW /health failed ({health.status_code})")
            out["health"] = health.json()
            ready = await client.get(f"{KBSEW_SERVICE_URL}/ready", headers={"accept": "application/json"})
            if ready.status_code >= 400:
                out["ready"] = {"ok": False, "status_code": ready.status_code}
            else:
                out["ready"] = ready.json()
    except httpx.HTTPError as exc:
        logger.warning("[STEP] kbsew_client_health_http_fail reason=%s", exc)
        raise KbsewClientError("KBSEW health request failed") from exc
    return out


async def kbsew_search_barrel(
    *,
    query: str,
    barrel_id: str,
    limit: int | None = None,
    retrieval_mode: str | None = None,
    authorization: str | None = None,
) -> list[str]:
    url = f"{KBSEW_SERVICE_URL}/api/v1/kbsew/search"
    payload: dict[str, str | int] = {"query": query, "barrel_id": barrel_id}
    if limit is not None:
        payload["limit"] = max(1, min(20, int(limit)))
    if retrieval_mode:
        mode = str(retrieval_mode).strip().lower()
        if mode in {"dense", "hybrid"}:
            payload["retrieval_mode"] = mode
    try:
        async with httpx.AsyncClient(timeout=_SEARCH_TIMEOUT) as client:
            response = await client.post(url, json=payload, headers=_kbsew_headers(authorization=authorization))
    except httpx.HTTPError as exc:
        logger.warning("[STEP] kbsew_client_search_http_fail barrel_id=%s reason=%s", barrel_id, exc)
        raise KbsewClientError("KBSEW search request failed") from exc

    if response.status_code == 404:
        raise KbsewNotFoundError("Barrel not found")
    if response.status_code >= 400:
        detail = response.text[:800]
        logger.warning(
            "[STEP] kbsew_client_search_http_error barrel_id=%s status=%s trace_id=%s detail=%s",
            barrel_id,
            response.status_code,
            get_kbsew_trace_id(),
            detail[:300],
        )
        raise _map_kbsew_http_error(status_code=response.status_code, detail=detail, barrel_id=barrel_id)

    data = response.json()
    chunks = data.get("chunks")
    if not isinstance(chunks, list):
        return []
    return [str(item).strip() for item in chunks if str(item).strip()]
