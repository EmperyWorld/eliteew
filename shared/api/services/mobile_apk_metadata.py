#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve version metadata for the published production Android APK (sidecar JSON at publish time).
# Invariants:
# - Missing or invalid metadata returns None fields; callers must not invent version numbers.
# Related:
# - api.routers.mobile_app, docker/scripts/serve-mobile-apk-tunnel.sh
# ---

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class MobileReleaseNotesHistoryEntry:
    version_code: int
    version_name: str
    release_notes: str


@dataclass(frozen=True, slots=True)
class MobileApkMetadata:
    version_code: int | None
    version_name: str | None
    apk_sha256: str | None = None
    published_at: str | None = None
    release_notes: str | None = None
    min_supported_version_code: int | None = None
    release_notes_history: tuple[MobileReleaseNotesHistoryEntry, ...] = ()


def _meta_sidecar_path(apk_path: Path) -> Path:
    return apk_path.with_name(f"{apk_path.name}.meta.json")


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


def _coerce_sha256(raw: object) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip().lower()
    if len(text) != 64:
        return None
    if not all(ch in "0123456789abcdef" for ch in text):
        return None
    return text


def _coerce_text(raw: object, *, max_len: int = 4000) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip()
    return text[:max_len] if text else None


def _parse_release_notes_history(payload: dict) -> tuple[MobileReleaseNotesHistoryEntry, ...]:
    raw = payload.get("release_notes_history")
    if not isinstance(raw, list):
        return ()
    entries: list[MobileReleaseNotesHistoryEntry] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        code = _coerce_version_code(item.get("version_code"))
        name = _coerce_version_name(item.get("version_name"))
        notes = _coerce_text(item.get("release_notes"))
        if code is None or name is None or notes is None:
            continue
        entries.append(
            MobileReleaseNotesHistoryEntry(
                version_code=code,
                version_name=name,
                release_notes=notes,
            )
        )
    entries.sort(key=lambda entry: entry.version_code)
    return tuple(entries)


def read_mobile_apk_metadata(apk_path: Path) -> MobileApkMetadata:
    """Load version fields from ``<apk>.meta.json`` written during operator publish."""

    sidecar = _meta_sidecar_path(apk_path)
    if not sidecar.is_file():
        return MobileApkMetadata(version_code=None, version_name=None)
    try:
        payload = json.loads(sidecar.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):  # fmt: skip
        logger.warning("mobile_apk metadata: unreadable sidecar %s", sidecar, exc_info=True)
        return MobileApkMetadata(version_code=None, version_name=None)
    if not isinstance(payload, dict):
        return MobileApkMetadata(version_code=None, version_name=None)
    return MobileApkMetadata(
        version_code=_coerce_version_code(payload.get("version_code")),
        version_name=_coerce_version_name(payload.get("version_name")),
        apk_sha256=_coerce_sha256(payload.get("sha256")),
        published_at=_coerce_text(payload.get("published_at"), max_len=128),
        release_notes=_coerce_text(payload.get("release_notes")),
        min_supported_version_code=_coerce_version_code(payload.get("min_supported_version_code")),
        release_notes_history=_parse_release_notes_history(payload),
    )
