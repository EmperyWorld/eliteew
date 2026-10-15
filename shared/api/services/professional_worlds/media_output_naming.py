# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Naming and Unified Content metadata conventions for Professional Worlds generated media artifacts.
# Invariants:
# - Filenames exclude path separators; metadata keys remain stable (`eliteew_professional_worlds`, `preset_key`).
# Related:
# - api/routers/professional_worlds.py · api/services/unified_content
# ---
from __future__ import annotations

import re
from typing import Any
from uuid import UUID


def build_professional_media_output_name(*, preset_key: str, source_stem: str, vertical_slug: str) -> dict[str, Any]:
    """Safe basename + Unified Content metadata block for realtor/professional enhancements."""
    safe_preset = re.sub(r"[^a-zA-Z0-9_-]+", "_", preset_key).strip("_")[:80] or "preset"
    safe_stem = re.sub(r"[^a-zA-Z0-9._-]+", "_", source_stem).strip("._")[:120] or "source"
    base = f"{vertical_slug}_{safe_preset}_{safe_stem}"
    return {
        "filename_base": base[:220],
        "unified_metadata": {
            "eliteew_professional_worlds": True,
            "preset_key": preset_key,
            "vertical_slug": vertical_slug,
            "kind": "media_enhancement_output",
            "naming_version": 1,
        },
    }


def pw_media_display_name(
    *,
    vertical_slug: str,
    preset_key: str,
    property_title: str | None,
    time_suffix: str,
) -> str:
    """Human-readable Unified Content asset title for Realtor/PW media presets."""
    title = (property_title or "").strip()[:52] or "listing"
    return f"PW {vertical_slug} · {preset_key} · {title} · {time_suffix}"


def pw_media_uc_metadata(
    *,
    vertical_slug: str,
    preset_key: str,
    property_id: UUID | None,
    enhancement_job_id: UUID | None,
    batch_job_id: UUID | None,
    batch_item_id: UUID | None,
) -> dict[str, Any]:
    """Structured metadata conventions for PW-generated realtor media."""
    md: dict[str, Any] = {
        "source_service": "professional_worlds",
        "preset_key": preset_key,
        "vertical_slug": vertical_slug,
    }
    if property_id is not None:
        md["property_id"] = str(property_id)
    if enhancement_job_id is not None:
        md["enhancement_job_id"] = str(enhancement_job_id)
    if batch_job_id is not None:
        md["batch_job_id"] = str(batch_job_id)
    if batch_item_id is not None:
        md["batch_item_id"] = str(batch_item_id)
    return {"eliteew_pw_media": md}
