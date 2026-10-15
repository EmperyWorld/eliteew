#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve mobile OTA manifest from the dedicated stack-mobile-release nginx service.
# Invariants:
# - Fail open to local sidecar metadata when the release server is unreachable.
# Related:
# - docker/stack/stack-mobile-release.yml, api.routers.mobile_app
# ---

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import httpx

from api.core.unified_config import unified_settings
from api.services.mobile_apk_metadata import (
    MobileApkMetadata,
    MobileReleaseNotesHistoryEntry,
    _parse_release_notes_history,
    read_mobile_apk_metadata,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class MobileReleaseManifest:
    apk_available: bool
    apk_size_bytes: int | None
    version_code: int | None
    version_name: str | None
    apk_sha256: str | None = None
    published_at: str | None = None
    release_notes: str | None = None
    min_supported_version_code: int | None = None
    release_notes_history: tuple[MobileReleaseNotesHistoryEntry, ...] = ()


def _coerce_version_code(raw: object) -> int | None:
    if raw is None:
        return None
    try:
        code = int(raw)
    except (TypeError, ValueError):  # fmt: skip
        return None
    return code if code > 0 else None


def _coerce_version_name(raw: object) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip()
    return text or None


def manifest_to_apk_metadata(manifest: MobileReleaseManifest | None) -> MobileApkMetadata | None:
    if manifest is None:
        return None
    return MobileApkMetadata(
        version_code=manifest.version_code,
        version_name=manifest.version_name,
        apk_sha256=manifest.apk_sha256,
        published_at=manifest.published_at,
        release_notes=manifest.release_notes,
        min_supported_version_code=manifest.min_supported_version_code,
        release_notes_history=manifest.release_notes_history,
    )


async def fetch_mobile_release_manifest() -> MobileReleaseManifest | None:
    """Load OTA manifest from stack-mobile-release (nginx) when configured."""

    base = (unified_settings.mobile_release_base_url or "").strip().rstrip("/")
    if not base:
        return None
    url = f"{base}/v1/manifest.json"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError, TypeError):  # fmt: skip
        logger.warning("mobile_release manifest fetch failed url=%s", url, exc_info=True)
        return None
    if not isinstance(payload, dict):
        return None
    size_raw = payload.get("apk_size_bytes")
    size = int(size_raw) if isinstance(size_raw, int) or str(size_raw or "").isdigit() else None
    sha_raw = payload.get("sha256")
    sha256 = str(sha_raw).strip().lower() if sha_raw is not None else None
    if sha256 is not None and len(sha256) != 64:
        sha256 = None
    published_at = str(payload.get("published_at") or "").strip() or None
    release_notes = str(payload.get("release_notes") or "").strip() or None
    return MobileReleaseManifest(
        apk_available=bool(payload.get("apk_available")),
        apk_size_bytes=size if size and size > 0 else None,
        version_code=_coerce_version_code(payload.get("version_code")),
        version_name=_coerce_version_name(payload.get("version_name")),
        apk_sha256=sha256,
        published_at=published_at,
        release_notes=release_notes[:4000] if release_notes else None,
        min_supported_version_code=_coerce_version_code(payload.get("min_supported_version_code")),
        release_notes_history=_parse_release_notes_history(payload),
    )


async def resolve_mobile_apk_release_state(
    apk_path: Path | None,
    *,
    apk_ok: bool,
    apk_size: int | None,
) -> tuple[bool, int | None, MobileApkMetadata | None]:
    """Prefer dedicated release-server manifest; fall back to local sidecar metadata."""

    manifest = await fetch_mobile_release_manifest()
    if manifest is not None and manifest.apk_available:
        meta = manifest_to_apk_metadata(manifest)
        size = manifest.apk_size_bytes if manifest.apk_size_bytes is not None else apk_size
        return True, size, meta

    if not apk_ok or apk_path is None:
        return apk_ok, apk_size, None
    return apk_ok, apk_size, read_mobile_apk_metadata(apk_path)
