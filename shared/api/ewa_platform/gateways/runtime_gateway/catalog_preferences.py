# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Persistent EWA Runtime Gateway catalogue-listing preferences stored in companion ``learned_preferences`` for the first
# iteration: content/mime exclusions and file extension exclusions applied to “show all files” style requests.
# Invariants:
# - Preferences are small allowlisted JSON; extensions are normalized to lower-case dot-prefixed strings.
# - Missing companion profile means no persisted preferences; callers must keep working without them.
# Related:
# - api/ewa_platform/gateways/runtime_gateway/runtime_context.py
# - api/ewa_platform/gateways/runtime_gateway/runtime_command.py
# ---
"""EWA catalogue preference helpers."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.schemas.pydantic.runtime_context import EwaRuntimeCatalogPreferencesOut

CATALOG_PREFS_NS = "ewa_runtime_catalog_preferences_v1"
_KNOWN_CONTENT_TYPES = frozenset(
    {"document", "image", "video", "audio", "ai_result", "presentation", "spreadsheet", "other"}
)
_KNOWN_MIME_GROUPS = frozenset({"audio", "docs", "media", "text", "binary"})
_EXT_RE = re.compile(r"^\.[a-z0-9][a-z0-9_+-]{0,20}$")


def normalize_extension(raw: Any) -> str | None:
    s = str(raw or "").strip().lower()
    if not s:
        return None
    if not s.startswith("."):
        s = f".{s}"
    return s if _EXT_RE.match(s) else None


def normalize_extension_list(raw: Any) -> list[str]:
    rows = raw if isinstance(raw, list) else [raw] if raw else []
    out: list[str] = []
    seen: set[str] = set()
    for item in rows:
        ext = normalize_extension(item)
        if ext and ext not in seen:
            seen.add(ext)
            out.append(ext)
    return out[:64]


def normalize_catalog_preferences(raw: Mapping[str, Any] | None) -> EwaRuntimeCatalogPreferencesOut:
    src = dict(raw or {})
    content_types = [
        str(x).strip().lower()
        for x in (src.get("exclude_content_types") or [])
        if str(x).strip().lower() in _KNOWN_CONTENT_TYPES
    ][:16]
    mime_groups = [
        str(x).strip().lower()
        for x in (src.get("exclude_mime_groups") or [])
        if str(x).strip().lower() in _KNOWN_MIME_GROUPS
    ][:16]
    return EwaRuntimeCatalogPreferencesOut(
        exclude_content_types=sorted(set(content_types)),
        exclude_mime_groups=sorted(set(mime_groups)),  # type: ignore[arg-type]
        extension_exclude=normalize_extension_list(src.get("extension_exclude")),
    )


def catalog_preferences_from_profile(profile: Mapping[str, Any] | None) -> EwaRuntimeCatalogPreferencesOut:
    learned = profile.get("learned_preferences") if isinstance(profile, Mapping) else None
    prefs = learned.get(CATALOG_PREFS_NS) if isinstance(learned, Mapping) else None
    return normalize_catalog_preferences(prefs if isinstance(prefs, Mapping) else None)


def catalog_preferences_to_mapping(prefs: EwaRuntimeCatalogPreferencesOut) -> dict[str, Any]:
    return {
        "exclude_content_types": list(prefs.exclude_content_types),
        "exclude_mime_groups": list(prefs.exclude_mime_groups),
        "extension_exclude": list(prefs.extension_exclude),
    }


def merge_catalog_preferences(
    current: EwaRuntimeCatalogPreferencesOut,
    *,
    add_content_types: list[str] | None = None,
    remove_content_types: list[str] | None = None,
    add_mime_groups: list[str] | None = None,
    remove_mime_groups: list[str] | None = None,
    add_extensions: list[str] | None = None,
    remove_extensions: list[str] | None = None,
    reset: bool = False,
) -> EwaRuntimeCatalogPreferencesOut:
    if reset:
        return EwaRuntimeCatalogPreferencesOut()
    content = set(current.exclude_content_types)
    content.update(x for x in (add_content_types or []) if x in _KNOWN_CONTENT_TYPES)
    content.difference_update(x for x in (remove_content_types or []) if x in _KNOWN_CONTENT_TYPES)
    mime = set(current.exclude_mime_groups)
    mime.update(x for x in (add_mime_groups or []) if x in _KNOWN_MIME_GROUPS)
    mime.difference_update(x for x in (remove_mime_groups or []) if x in _KNOWN_MIME_GROUPS)
    ext = set(current.extension_exclude)
    ext.update(normalize_extension_list(add_extensions or []))
    ext.difference_update(normalize_extension_list(remove_extensions or []))
    return EwaRuntimeCatalogPreferencesOut(
        exclude_content_types=sorted(content),
        exclude_mime_groups=sorted(mime),  # type: ignore[arg-type]
        extension_exclude=sorted(ext),
    )


def parse_catalog_preference_intent(
    user_line: str,
    current: EwaRuntimeCatalogPreferencesOut,
) -> tuple[EwaRuntimeCatalogPreferencesOut, dict[str, Any]] | None:
    """Detect simple user phrases that persist or reset catalogue exclusions."""

    s = user_line.strip().lower()
    if not s:
        return None
    reset_all = bool(
        re.search(
            r"(?:показывай\s+все|покажи\s+в[сc]е\s+включая|верни\s+.*(?:файлы|аудио)|убери\s+исключени|reset\s+catalog|show\s+all\s+files)",
            s,
        )
    )
    remove_exts = normalize_extension_list(re.findall(r"\.[a-z0-9][a-z0-9_+-]{0,20}", s)) if reset_all else []
    persistent = bool(
        re.search(
            r"(?:никогда\s+не\s+показывай|не\s+выводи|не\s+показывай|исключи|запомни.*не\s+показывать|never\s+show|exclude|hide)",
            s,
        )
    )
    add_audio = persistent and bool(re.search(r"\b(?:audio|аудио)\b", s))
    add_exts = normalize_extension_list(re.findall(r"\.[a-z0-9][a-z0-9_+-]{0,20}", s)) if persistent else []
    if reset_all:
        next_prefs = merge_catalog_preferences(
            current,
            remove_content_types=["audio"],
            remove_mime_groups=["audio"],
            remove_extensions=remove_exts or current.extension_exclude,
            reset=not remove_exts and "аудио" not in s and "audio" not in s,
        )
        return next_prefs, {"operation": "reset_or_remove", "removed_extensions": remove_exts}
    if add_audio or add_exts:
        next_prefs = merge_catalog_preferences(
            current,
            add_content_types=["audio"] if add_audio else None,
            add_mime_groups=["audio"] if add_audio else None,
            add_extensions=add_exts,
        )
        return next_prefs, {"operation": "add_exclusions", "audio": add_audio, "extensions": add_exts}
    return None


async def patch_catalog_preferences(
    pool: asyncpg.Pool | None,
    *,
    principal_id: str,
    prefs: EwaRuntimeCatalogPreferencesOut,
    audit_action: str = "catalog_preferences_patch",
) -> tuple[EwaRuntimeCatalogPreferencesOut, bool]:
    """Persist preferences into companion learned_preferences; returns ``(prefs, persisted)``."""

    if pool is None:
        return prefs, False
    profile = await companion_pg.companion_profile_fetch(pool, principal_id=principal_id)
    if profile is None:
        return prefs, False
    learned = dict(profile.get("learned_preferences") or {})
    learned[CATALOG_PREFS_NS] = catalog_preferences_to_mapping(prefs)
    patched = await companion_pg.companion_profile_patch(
        pool,
        principal_id=principal_id,
        learned_preferences=learned,
        audit_action=audit_action,
        audit_detail_override={"catalog_preferences": catalog_preferences_to_mapping(prefs)},
    )
    return prefs, patched is not None
