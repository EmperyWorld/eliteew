# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Structured draft payloads per destination app (EWRP, Site Studio, GAF, EWDesk, Unified Content links).
# Invariants:
# - No outbound send / publish flags defaulted to True; callers must keep explicit operator consent.
# - Internal-only prompts and admin keys stay out of runtime-facing dicts assembled here where possible.
# Related:
# - api/services/professional_worlds/cross_app_drafts_service.py
# - api/routers/professional_worlds.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID


def _base(property_row: dict[str, Any]) -> dict[str, Any]:
    return {
        "property_id": str(property_row["id"]),
        "title_hint": property_row.get("title"),
        "city": property_row.get("city"),
    }


def build_ewrp_draft_adapter(
    property_row: dict[str, Any],
    *,
    outline_markdown: str,
    unified_content_refs: list[UUID],
    artifact_id: UUID,
) -> dict[str, Any]:
    """Presentation draft capsule for EWRP (title/outline/media refs deep link envelope)."""
    return {
        "destination": "ewrp",
        "property": _base(property_row),
        "presentation": {
            "title": property_row.get("title") or "Объект",
            "outline_markdown": outline_markdown,
        },
        "media_unified_content_ids": [str(u) for u in unified_content_refs],
        "deep_link": {"app_component": "EWRP", "artifact_id": str(artifact_id)},
        "constraints": {"auto_publish_forbidden": True},
    }


def build_site_studio_draft_adapter(
    property_row: dict[str, Any],
    *,
    sections: list[dict[str, Any]],
    unified_content_refs: list[UUID],
    artifact_id: UUID,
    internal_review_required: bool = True,
) -> dict[str, Any]:
    """Site Studio capsule with page-oriented sections (no silent public toggle)."""
    return {
        "destination": "site_studio",
        "property": _base(property_row),
        "page_sections": sections,
        "media_unified_content_ids": [str(u) for u in unified_content_refs],
        "deep_link": {"app_component": "UserSiteStudio", "artifact_id": str(artifact_id)},
        "constraints": {
            "internal_review_required": internal_review_required,
            "never_auto_publish_external": True,
        },
    }


def build_gaf_chat_draft_adapter(
    property_row: dict[str, Any],
    *,
    recipient_context: dict[str, Any],
    message_body: str,
    attachment_unified_content_ids: list[UUID],
    artifact_id: UUID,
) -> dict[str, Any]:
    """GAF Chat capsule: seeded composer body + refs; outbound send remains user-driven in GAF."""
    return {
        "destination": "gaf_chat",
        "property": _base(property_row),
        "recipient": recipient_context,
        "message_body_draft": message_body,
        "attachment_unified_content_ids": [str(u) for u in attachment_unified_content_ids],
        "deep_link": {"app_component": "GAFChatApp", "artifact_id": str(artifact_id)},
        "constraints": {"auto_send_forbidden": True},
    }


def build_ewdesk_suggestion_adapter(
    property_row: dict[str, Any],
    *,
    markdown_body: str,
    artifact_id: UUID,
) -> dict[str, Any]:
    """EWDesk operator-facing suggestion marker (explicit publish separation)."""
    return {
        "destination": "ewdesk",
        "property": _base(property_row),
        "suggestion_markdown": markdown_body,
        "operator_only_publish": True,
        "deep_link": {"app_component": "EWDeskApp", "artifact_id": str(artifact_id)},
    }


def build_unified_content_asset_link(
    unified_content_ids: list[UUID],
    *,
    property_id: UUID,
) -> dict[str, Any]:
    """Unified Content navigator bridge for branded assets."""
    return {
        "destination": "unified_content",
        "property_id": str(property_id),
        "unified_content_ids": [str(u) for u in unified_content_ids],
        "deep_link": {"openContentManagerWithIds": True},
    }
