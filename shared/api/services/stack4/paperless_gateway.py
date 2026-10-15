# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Async HTTP client for Paperless-ngx (stack4): list, fetch metadata, download and optional upload.
# Invariants:
# - Base URL and API token from unified_settings / env only; never hardcoded secrets.
# - Missing token → PaperlessNotConfigured; HTTP failures → PaperlessGatewayError with structured context.
# Related:
# - docker/stack/stack4.yml
# - api/services/elite_editor/elite_orchestrator.py
# - api/routers/paperless_integration.py
# ---

"""Paperless-ngx gateway for EliteEW document workflows."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any

import httpx

from api.core.http_clients import get_httpx_client
from api.core.unified_config import get_unified_settings

logger = logging.getLogger(__name__)

_TIMEOUT_SEC = 60.0


class PaperlessGatewayError(Exception):
    """Paperless HTTP or parse failure."""


class PaperlessNotConfigured(PaperlessGatewayError):
    """Paperless URL or API token is missing."""


@dataclass(frozen=True, slots=True)
class PaperlessDocumentSummary:
    id: int
    title: str
    created: str | None
    modified: str | None
    file_type: str | None
    correspondent: int | None
    document_type: int | None
    tags: list[int]
    archive_serial_number: str | None
    original_file_name: str | None


def _resolve_base_url() -> str:
    settings = get_unified_settings()
    paperless_cfg = getattr(settings, "paperless", None)
    if paperless_cfg is not None:
        internal = str(getattr(paperless_cfg, "internal_url", "") or "").strip().rstrip("/")
        if internal:
            return internal
    explicit = (os.environ.get("PAPERLESS_URL") or "").strip().rstrip("/")
    if explicit:
        return explicit
    return ""


def _resolve_api_token() -> str:
    settings = get_unified_settings()
    token = str(getattr(settings, "paperless_api_token", "") or "").strip()
    if token:
        return token
    return (os.environ.get("PAPERLESS_API_TOKEN") or os.environ.get("PAPERLESS_TOKEN") or "").strip()


def paperless_configured() -> bool:
    return bool(_resolve_base_url() and _resolve_api_token())


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Token {token}"}


def _parse_summary(raw: dict[str, Any]) -> PaperlessDocumentSummary:
    return PaperlessDocumentSummary(
        id=int(raw["id"]),
        title=str(raw.get("title") or f"Document {raw['id']}"),
        created=str(raw["created"]) if raw.get("created") else None,
        modified=str(raw["modified"]) if raw.get("modified") else None,
        file_type=str(raw["file_type"]) if raw.get("file_type") else None,
        correspondent=int(raw["correspondent"]) if raw.get("correspondent") is not None else None,
        document_type=int(raw["document_type"]) if raw.get("document_type") is not None else None,
        tags=[int(t) for t in (raw.get("tags") or []) if t is not None],
        archive_serial_number=str(raw["archive_serial_number"])
        if raw.get("archive_serial_number") is not None
        else None,
        original_file_name=str(raw.get("original_file_name") or raw.get("filename") or "") or None,
    )


class PaperlessGateway:
    """Async facade over Paperless-ngx REST API."""

    def __init__(
        self,
        *,
        base_url: str | None = None,
        api_token: str | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = (base_url or _resolve_base_url()).rstrip("/")
        self._api_token = (api_token or _resolve_api_token()).strip()
        self._client = client

    def _require_config(self) -> None:
        if not self._base_url:
            raise PaperlessNotConfigured("PAPERLESS_URL not configured")
        if not self._api_token:
            raise PaperlessNotConfigured("PAPERLESS_API_TOKEN not configured")

    def _http(self) -> httpx.AsyncClient:
        return self._client if self._client is not None else get_httpx_client()

    async def health_ok(self) -> bool:
        if not self._base_url:
            return False
        try:
            response = await self._http().get(f"{self._base_url}/api/", timeout=10.0, follow_redirects=True)
            return response.status_code < 500
        except httpx.HTTPError:
            return False

    async def list_documents(
        self,
        *,
        query: str | None = None,
        page: int = 1,
        page_size: int = 25,
        ordering: str = "-created",
    ) -> tuple[list[PaperlessDocumentSummary], int]:
        self._require_config()
        params: dict[str, str | int] = {
            "page": max(1, page),
            "page_size": max(1, min(page_size, 100)),
            "ordering": ordering,
        }
        if query and query.strip():
            params["query"] = query.strip()
        response = await self._http().get(
            f"{self._base_url}/api/documents/",
            params=params,
            headers=_auth_headers(self._api_token),
            timeout=_TIMEOUT_SEC,
        )
        if response.status_code == 401:
            raise PaperlessGatewayError("Paperless API unauthorized (check PAPERLESS_API_TOKEN)")
        response.raise_for_status()
        payload = response.json()
        results = payload.get("results") if isinstance(payload, dict) else None
        if not isinstance(results, list):
            raise PaperlessGatewayError("Paperless list response missing results")
        total = int(payload.get("count") or len(results)) if isinstance(payload, dict) else len(results)
        summaries = [_parse_summary(item) for item in results if isinstance(item, dict) and "id" in item]
        return summaries, total

    async def get_document(self, paperless_id: int) -> PaperlessDocumentSummary:
        self._require_config()
        response = await self._http().get(
            f"{self._base_url}/api/documents/{paperless_id}/",
            headers=_auth_headers(self._api_token),
            timeout=_TIMEOUT_SEC,
        )
        if response.status_code == 404:
            raise PaperlessGatewayError(f"Paperless document {paperless_id} not found")
        if response.status_code == 401:
            raise PaperlessGatewayError("Paperless API unauthorized (check PAPERLESS_API_TOKEN)")
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise PaperlessGatewayError("Paperless document response is not an object")
        return _parse_summary(payload)

    async def download_document_bytes(self, paperless_id: int) -> tuple[bytes, PaperlessDocumentSummary]:
        meta = await self.get_document(paperless_id)
        response = await self._http().get(
            f"{self._base_url}/api/documents/{paperless_id}/download/",
            headers=_auth_headers(self._api_token),
            timeout=_TIMEOUT_SEC,
        )
        if response.status_code == 401:
            raise PaperlessGatewayError("Paperless API unauthorized (check PAPERLESS_API_TOKEN)")
        response.raise_for_status()
        return response.content, meta


_gateway: PaperlessGateway | None = None


def get_paperless_gateway() -> PaperlessGateway:
    global _gateway
    if _gateway is None:
        _gateway = PaperlessGateway()
    return _gateway
