# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Helpers for **companion-initiated desktop actions**. The LLM may emit ``<<ACTIONS>>...<<END>>`` tails or structured JSON
# ``actions`` arrays; parsing yields a strict, allowlisted list; **``patch_desktop_config`` is executed on the API server**
# (Bearer ``PATCH /desktop/config``); **``music_play_track``** starts global now-playing for a catalog audio id (companion flow).
# Other types are SPA ``CustomEvent`` gestures.
# Instructions tell the model to copy ``unified_content_id`` from shell ``listing`` lines that end with `` uc=<id>`` when opening DocEditor — never hallucinate IDs.
# Invariants:
# - Pure parsing helpers — no asyncio / DB I/O here; companion chat applies ``patch_desktop_config`` server-side separately.
# - Allowlist is *closed*: unknown ``type`` / ``app_component`` (where required) / malformed payload fragments are silently
#   dropped + WARN log; **``patch_desktop_config``** does **not** use ``app_component``.
# - ``ALLOWED_APP_COMPONENTS`` tracks routable SPA ``app_component`` IDs (aligned with ``desktopWindowAppContent`` /
#   ``DEFAULT_APPS`` + registry extras); **UnifiedAdminApp** / **DesktopAppMaintenance** stay excluded as operator surfaces.
# - Parser MUST NEVER raise on malformed LLM output.
# - ``close_app`` / ``minimize_app`` / ``focus_app`` operate on **most recent** window of that ``app_component``.
# Related:
# - api/ewa_platform/companion/actions/ambient.py (expansion of ``ambient_adjust``)
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/companion/ux/reply_extract.py
# ---
"""EWA companion action allowlist + tail parser."""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Mapping, Sequence
from typing import Any

from api.ewa_platform.companion.ux.control_tails import (
    iter_malformed_control_tail_bodies,
    strip_malformed_control_tails,
)
from api.ewa_platform.contracts.desktop_config_patch_wire import sanitize_patch_desktop_config_wire

logger = logging.getLogger(__name__)

# Legacy constant name retained for audits mentioning ``companion_actions_v1`` payloads in older logs.
ACTIONS_NS_LOG: str = "companion_actions_v1"

ALLOWED_ACTION_TYPES: frozenset[str] = frozenset(
    {
        "open_app",
        "close_app",
        "focus_app",
        "minimize_app",
        "patch_desktop_config",
        "ambient_adjust",
        "music_play_track",
    }
)

COMPANION_ACTIONS_EXCLUDED_APP_COMPONENTS: frozenset[str] = frozenset({"UnifiedAdminApp", "DesktopAppMaintenance"})

# Full catalog of desktop-routable apps (SPA switch + default shortcuts). Mirrors
# shared/web/frontend/src/pages/Desktop/constants/index.ts (DEFAULT_APPS) and registry extras such as Presentations*.
_KNOWN_DESKTOP_APP_COMPONENTS: frozenset[str] = frozenset(
    {
        "AppStore",
        "AssistantApp",
        "ClipboardManager",
        "ContentManagerPro",
        "CustomerCabinet",
        "DesktopAiChatApp",
        "DesktopShellSettings",
        "DesktopWidgetShelfApp",
        "DocEditor",
        "DocEditorV2",
        "DesktopAppMaintenance",
        "EWDeskApp",
        "EwaApp",
        "EWRP",
        "FeedbackHubApp",
        "FriendsApp",
        "GAFChatApp",
        "ImageStudio",
        "KirsClientSite",
        "KirsCuration",
        "LocalServiceIframeApp",
        "MarketingCabinet",
        "MusicGenerator",
        "MusicPlayer",
        "NotificationsApp",
        "PoemmaApp",
        "ProjectAboutApp",
        "Presentations",
        "PresentationsArchive",
        "ProfessionalWorlds",
        "SocialHubApp",
        "StudioGU",
        "UnifiedAdminApp",
        "UGS",
        "UGSHubApp",
        "UserProfile",
        "UserSiteStudio",
        "VideoCallApp",
        "VideoStudio",
    }
)

ALLOWED_APP_COMPONENTS: frozenset[str] = frozenset(
    _KNOWN_DESKTOP_APP_COMPONENTS - COMPANION_ACTIONS_EXCLUDED_APP_COMPONENTS
)

MAX_ACTIONS_PER_TURN: int = 3
_MAX_OPEN_OPT_ID_CHARS: int = 128
_MAX_CM_SEARCH_QUERY_CHARS: int = 500


def _search_query_field(raw: Any) -> str | None:
    """Allowlist a short catalog search string for Content Manager pre-filter (no structured injection)."""

    val = raw if isinstance(raw, str) else str(raw or "")
    s = val.strip()
    if not s or len(s) > _MAX_CM_SEARCH_QUERY_CHARS:
        return None
    if any(c in s for c in "\n\r\x00\t"):
        return None
    return s


_ACTIONS_TAIL_RE = re.compile(r"<<ACTIONS>>(?P<body>.+?)<<END>>", re.DOTALL | re.IGNORECASE)


def _folder_item_id_field(raw: Any) -> str | None:
    """Allowlist a desktop folder ``item_id`` for Content Manager explorer scope (e.g. ``ewa_file``)."""

    val = raw if isinstance(raw, str) else str(raw or "")
    s = val.strip()
    if not s or len(s) > _MAX_OPEN_OPT_ID_CHARS:
        return None
    if any(c in s for c in "\n\r\x00<>\"'` "):
        return None
    return s


def _opaque_id(raw: Any) -> str | None:
    """Allow UUID-like / content ids without newlines/control chars."""

    val = raw if isinstance(raw, str) else str(raw or "")
    s = val.strip()
    if not s or len(s) > _MAX_OPEN_OPT_ID_CHARS:
        return None
    if any(c in s for c in "\n\r\x00<>\"'`"):
        return None
    return s


def _normalize_action(raw: Any) -> dict[str, Any] | None:
    """Coerce a single action dict into a canonical, allowlisted shape; ``None`` if rejected."""

    if not isinstance(raw, Mapping):
        return None
    action_type = str(raw.get("type", "")).strip().lower()
    if action_type not in ALLOWED_ACTION_TYPES:
        return None

    if action_type == "patch_desktop_config":
        rationale_pc = str(raw.get("rationale", "") or raw.get("why", "")).strip()[:200]
        patch_in = raw.get("patch")
        if not isinstance(patch_in, Mapping):
            return None
        body = sanitize_patch_desktop_config_wire(patch_in)
        if not body:
            return None
        base_pc: dict[str, Any] = {"type": "patch_desktop_config", "patch": body}
        if rationale_pc:
            base_pc["rationale"] = rationale_pc
        return base_pc

    if action_type == "ambient_adjust":
        mood = str(raw.get("mood", "") or raw.get("ambient", "")).strip().lower()[:32]
        if not mood:
            return None
        intensity_raw = raw.get("intensity")
        intensity: float | None
        try:
            intensity = float(intensity_raw) if intensity_raw is not None else None
        except (TypeError, ValueError):  # fmt: skip
            intensity = None
        if intensity is not None:
            intensity = max(0.0, min(1.0, intensity))
        theme_ref = str(raw.get("theme_ref", "") or "").strip()[:80] or None
        rationale_amb = str(raw.get("rationale", "") or raw.get("why", "")).strip()[:200]
        base_amb: dict[str, Any] = {"type": "ambient_adjust", "mood": mood}
        if intensity is not None:
            base_amb["intensity"] = intensity
        if theme_ref:
            base_amb["theme_ref"] = theme_ref
        if rationale_amb:
            base_amb["rationale"] = rationale_amb
        return base_amb

    if action_type == "music_play_track":
        unified = _opaque_id(
            raw.get("unified_content_id") if "unified_content_id" in raw else raw.get("unifiedContentId"),
        )
        if not unified:
            return None
        tn_raw = raw.get("track_name") if "track_name" in raw else raw.get("trackName")
        nm_raw = raw.get("name") if "name" in raw else None
        track_name = str(tn_raw or nm_raw or "").strip()[:240] or unified
        thumb_raw = raw.get("thumbnail_url") if "thumbnail_url" in raw else raw.get("thumbnailUrl")
        thumb = str(thumb_raw or "").strip()[:2000] if thumb_raw is not None else ""
        base_m: dict[str, Any] = {
            "type": "music_play_track",
            "unified_content_id": unified,
            "track_name": track_name,
        }
        if thumb:
            base_m["thumbnail_url"] = thumb
        rationale_m = str(raw.get("rationale", "") or raw.get("why", "")).strip()[:200]
        if rationale_m:
            base_m["rationale"] = rationale_m
        return base_m

    from api.services.desktop_app_component_legacy import remap_legacy_desktop_app_component

    component = remap_legacy_desktop_app_component(
        str(raw.get("app_component", "") or raw.get("appComponent", "")).strip() or None
    )
    component = (component or "").strip()
    if not component or component not in ALLOWED_APP_COMPONENTS:
        return None
    rationale = str(raw.get("rationale", "") or raw.get("why", "")).strip()[:200]

    base: dict[str, Any] = {
        "type": action_type,
        "app_component": component,
    }
    if rationale:
        base["rationale"] = rationale

    if action_type == "open_app":
        unified = _opaque_id(
            raw.get("unified_content_id") if "unified_content_id" in raw else raw.get("unifiedContentId")
        )
        cm_focus = _opaque_id(
            raw.get("content_manager_focus_unified_content_id")
            if "content_manager_focus_unified_content_id" in raw
            else raw.get("contentManagerFocusUnifiedContentId")
        )
        if unified and component == "DocEditor":
            base["unified_content_id"] = unified
        if cm_focus and component == "ContentManagerPro":
            base["content_manager_focus_unified_content_id"] = cm_focus
        cif_in = raw.get("content_manager_initial_filter")
        if isinstance(cif_in, Mapping) and component == "ContentManagerPro":
            sq_raw = cif_in.get("search_query") if "search_query" in cif_in else cif_in.get("searchQuery")
            sq = _search_query_field(sq_raw)
            if sq:
                base["content_manager_initial_filter"] = {"search_query": sq}
        cm_folder = _folder_item_id_field(
            raw.get("content_manager_folder_item_id")
            if "content_manager_folder_item_id" in raw
            else raw.get("contentManagerFolderItemId")
        )
        if cm_folder and component == "ContentManagerPro":
            base["content_manager_folder_item_id"] = cm_folder
        ewrp_job = _opaque_id(raw.get("ewrp_job_id") if "ewrp_job_id" in raw else raw.get("ewrpJobId"))
        if ewrp_job and component in {"EWRP", "Presentations", "PresentationsArchive"}:
            base["ewrp_job_id"] = ewrp_job
        return base

    if action_type in {"close_app", "focus_app", "minimize_app"}:
        return base

    return None


def normalize_actions_list_from_json(raw: Any) -> list[dict[str, Any]]:
    """Parse an ``actions`` array from structured JSON envelopes (same coercion as tails)."""

    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        row = _normalize_action(item)
        if row is not None:
            out.append(row)
        if len(out) >= MAX_ACTIONS_PER_TURN:
            break
    return out


def _ingest_actions_json_body(body: str, parsed: list[dict[str, Any]]) -> None:
    if not body:
        return
    try:
        payload: Any = json.loads(body)
    except json.JSONDecodeError:
        logger.warning(
            "companion_actions_parse_failed body_chars=%s preview=%r",
            len(body),
            body[:120],
        )
        return
    rows: list[Any]
    if isinstance(payload, list):
        rows = list(payload)
    elif isinstance(payload, Mapping):
        inner = payload.get("actions") if "actions" in payload else None
        rows = list(inner) if isinstance(inner, list) else [payload]
    else:
        logger.warning("companion_actions_unsupported_shape kind=%s", type(payload).__name__)
        return
    for raw in rows:
        row = _normalize_action(raw)
        if row is not None:
            parsed.append(row)
        if len(parsed) >= MAX_ACTIONS_PER_TURN:
            break


def parse_actions_tail(reply_text: str) -> tuple[str, list[dict[str, Any]]]:
    """Extract zero-or-more ``<<ACTIONS>>[…]<<END>>`` blocks."""

    if not isinstance(reply_text, str) or not reply_text:
        return reply_text or "", []

    parsed: list[dict[str, Any]] = []
    for m in _ACTIONS_TAIL_RE.finditer(reply_text):
        _ingest_actions_json_body(m.group("body").strip(), parsed)
        if len(parsed) >= MAX_ACTIONS_PER_TURN:
            break

    if len(parsed) < MAX_ACTIONS_PER_TURN:
        for _pat, _match, body in iter_malformed_control_tail_bodies(reply_text):
            before = len(parsed)
            _ingest_actions_json_body(body, parsed)
            if len(parsed) > before:
                break
            if len(parsed) >= MAX_ACTIONS_PER_TURN:
                break

    stripped = _ACTIONS_TAIL_RE.sub("", reply_text)
    stripped = strip_malformed_control_tails(stripped)
    return stripped.strip(), parsed[:MAX_ACTIONS_PER_TURN]


def actions_emit_instruction() -> str:
    """One-paragraph ACTIONS tail tutor + pointer to structured JSON."""

    from api.ewa_platform.companion.prompt_blocks.service import get_prompt_block

    components = ", ".join(sorted(ALLOWED_APP_COMPONENTS))
    tmpl = get_prompt_block("emit.actions_template")
    base = tmpl.replace("{components}", components)
    return (
        f"{base} "
        "The same ``uc=`` token may be copied into ``content_manager_focus_unified_content_id`` when opening "
        "``ContentManagerPro`` if the user asks to focus that row (or use deterministic phrasing supported by the server). "
        "Ordinal phrases such as ``second in your list`` refer to numbered rows ending with ``uc=`` "
        "in **the user's latest** ``listing`` snapshot from ``shell_context`` only — never guess row order "
        "from memory. "
        f"Emit ≤{MAX_ACTIONS_PER_TURN} actions total. Meaning: ``open_app`` opens or focuses,"
        " ``focus_app`` brings newest window forward, ``minimize_app`` minimizes newest window, ``close_app`` closes newest,"
        " ``patch_desktop_config`` updates saved desk theme/visual fields on the server."
        " Tails disappear before users read the message; undo cards exist where the SPA shows them."
    )


__all__: Sequence[str] = (
    "ACTIONS_NS_LOG",
    "ALLOWED_ACTION_TYPES",
    "ALLOWED_APP_COMPONENTS",
    "COMPANION_ACTIONS_EXCLUDED_APP_COMPONENTS",
    "MAX_ACTIONS_PER_TURN",
    "_normalize_action",
    "_opaque_id",
    "normalize_actions_list_from_json",
    "parse_actions_tail",
    "actions_emit_instruction",
)
