# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Structured JSON registry Document contributions per speaker (llama-server
# json_object+schema). Council speech is owned by council_speech.py.
# Invariants:
# - This schema asks for document items only; it never asks for council speech.
# - Schema item count matches user request (clamped 1–30).
# Related:
# - archive/legacy_freeform/stream_turn.py
# - archive/legacy_freeform/council_transcript.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---
"""JSON-schema registry list generation for ensemble council + document split."""

from __future__ import annotations

import logging
import re
from typing import Any

from api.utils.llm_json_extract import extract_llm_json_payload

logger = logging.getLogger(__name__)

_MAX_ITEMS = 30


def _clamp_item_count(item_count: int) -> int:
    return max(1, min(int(item_count), _MAX_ITEMS))


def registry_contribution_schema(item_count: int) -> dict[str, Any]:
    """OpenAI/llama-server JSON schema for one speaker's Document block."""
    count = _clamp_item_count(item_count)
    return {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string"},
                    },
                    "required": ["name", "description"],
                    "additionalProperties": False,
                },
                "minItems": count,
                "maxItems": count,
            },
        },
        "required": ["items"],
        "additionalProperties": False,
    }


def build_registry_response_format(item_count: int) -> dict[str, Any]:
    """Pass-through shape that works on stack2 llama-server (json_object + schema)."""
    return {
        "type": "json_object",
        "schema": registry_contribution_schema(item_count),
    }


def registry_json_system_append(
    *,
    zone_title: str,
    item_count: int,
    peer_item_names: list[str] | None = None,
) -> str:
    count = _clamp_item_count(item_count)
    peer_hint = ""
    if peer_item_names:
        sample = [n.strip() for n in peer_item_names if (n or "").strip()][:24]
        if sample:
            peer_hint = " Не повторяй названия, уже занятые коллегами: " + ", ".join(sample) + "."
    return (
        f"\n\n[Реестр · отдельная дорожка документа] Вклад зоны «{zone_title}». "
        f"В items — ровно {count} уникальных приложений/сервисов только этой зоны.{peer_hint} "
        "Ответ СТРОГО JSON: только items — массив {name, description}. "
        "Не добавляй речь совещания, преамбулу или общий реестр команды."
    )


def parse_registry_contribution(raw_text: str) -> dict[str, Any] | None:
    if not (raw_text or "").strip():
        return None
    try:
        data = extract_llm_json_payload(raw_text)
    except Exception as exc:  # noqa: BLE001 — defensive parse boundary
        logger.warning("[STEP] registry_json_parse_fail error=%s", exc)
        return None
    if not isinstance(data, dict):
        return None
    return data


def _normalize_items(raw_items: Any, *, expected: int) -> list[dict[str, str]]:
    if not isinstance(raw_items, list):
        return []
    out: list[dict[str, str]] = []
    for entry in raw_items:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name") or "").strip()
        desc = str(entry.get("description") or "").strip()
        if not name:
            continue
        out.append({"name": name, "description": desc})
        if len(out) >= expected:
            break
    return out


def format_registry_items_markdown(zone_title: str, items: list[dict[str, str]]) -> str:
    lines: list[str] = []
    for idx, item in enumerate(items, start=1):
        name = item.get("name", "").strip()
        desc = item.get("description", "").strip()
        if not name:
            continue
        if desc:
            lines.append(f"{idx}. **{name}** — {desc}")
        else:
            lines.append(f"{idx}. **{name}**")
    body = "\n".join(lines).strip()
    title = (zone_title or "").strip()
    if title and body:
        return f"## {title}\n\n{body}"
    if title:
        return f"## {title}"
    return body


def _names_fallback_preview(zone_title: str, items: list[dict[str, str]]) -> str:
    names = [it.get("name", "").strip() for it in items if it.get("name", "").strip()]
    zone = (zone_title or "").strip()
    if names:
        head = ", ".join(names[:4])
        suffix = "…" if len(names) > 4 else ""
        return f"{zone}: {len(names)} пунктов — {head}{suffix}".strip()
    return zone or "Реестр"


def build_registry_document_and_preview(
    raw_text: str,
    *,
    zone_title: str,
    item_count: int,
) -> tuple[str | None, str | None]:
    """Return (document_markdown, council_preview) or (None, None) on parse failure."""
    data = parse_registry_contribution(raw_text)
    if not data:
        return None, None
    expected = _clamp_item_count(item_count)
    items = _normalize_items(data.get("items"), expected=expected)
    if len(items) < max(1, expected // 2):
        logger.warning(
            "[STEP] registry_json_thin_items zone=%s got=%s expected=%s",
            zone_title,
            len(items),
            expected,
        )
        return None, None
    document_md = format_registry_items_markdown(zone_title, items)
    preview = _names_fallback_preview(zone_title, items)
    return document_md, preview


def collect_peer_item_names(peer_pairs: list[tuple[str, str, str]]) -> list[str]:
    """Extract app names from prior speaker markdown sections for dedupe hints."""
    names: list[str] = []
    for _hid, _title, body in peer_pairs:
        for match in re.finditer(r"\*\*([^*]+)\*\*", body or ""):
            name = match.group(1).strip()
            if name and name not in names:
                names.append(name)
    return names
