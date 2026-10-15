# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Decide whether / when to run an ensemble action pack for a blueprint turn.
# Invariants:
# - research_plan_v1 → after_rp1; code_architecture_audit_v1 → after_caa2;
#   analysis / explicit verify / user-armed web → pre_step; else skip.
# - capabilities.web (request toggle + admin) is in-scope without trigger words.
# - Empty capability snapshot forces skip with no_capabilities (no fake searches).
# Related:
# - documentation/product/DESKTOP-ENSEMBLE-ACTIONS.md
# ---
"""Gate for ensemble mid-turn action execution."""

from __future__ import annotations

import re
from typing import Any

from api.services.desktop_chat_ensemble.actions.types import ActionMode, CapabilitySnapshot

_ANALYSIS_INTENT_RE = re.compile(
    r"(?i)"
    r"(?:\bисследован|"
    r"\bresearch\b|"
    r"проверьте?\s+гипотез|"
    r"проверка\s+гипотез|"
    r"hypothesis\s+check|"
    r"проверьте?\s+на\s+фактах|"
    r"сделайте?\s+анализ|"
    r"проведите?\s+анализ|"
    r"market\s+analysis|"
    r"fact[\s-]?check|"
    r"сверьте?\s+с\s+(?:рынком|данными|источниками))"
)

# Explicit «проверь в сети|доках|файлах» — optional wording; web toggle alone is enough.
_EXPLICIT_VERIFY_RE = re.compile(
    r"(?i)"
    r"(?:"
    r"проверь(?:те)?\s+в\s+(?:сети|интернете|веб(?:е)?|доках|документации|файлах|коде|vault)|"
    r"найди(?:те)?\s+в\s+(?:сети|интернете|веб(?:е)?|доках|документации|файлах|коде)|"
    r"check\s+(?:online|on\s+the\s+web|in\s+(?:docs|files|code))|"
    r"search\s+(?:the\s+)?(?:web|docs|files)"
    r")"
)

_RESEARCH_TEMPLATE_IDS = frozenset({"research_plan_v1"})
_RESEARCH_ARTIFACT_TYPES = frozenset({"research_plan"})
_CAA_TEMPLATE_IDS = frozenset({"code_architecture_audit_v1"})
_CAA_ARTIFACT_TYPES = frozenset({"code_architecture_audit"})


def user_requests_explicit_verify(user_text: str) -> bool:
    """True when the user names web/docs/files as the check surface."""
    return bool(_EXPLICIT_VERIFY_RE.search(user_text or ""))


def resolve_action_mode(
    *,
    template_id: str,
    artifact_type: str,
    user_text: str,
    capabilities: CapabilitySnapshot,
) -> tuple[ActionMode, str | None]:
    """Return (mode, skipped_reason). skipped_reason set only when mode=skip."""
    tid = (template_id or "").strip()
    atype = (artifact_type or "").strip().casefold()
    text = user_text or ""

    wants_research = tid in _RESEARCH_TEMPLATE_IDS or atype in _RESEARCH_ARTIFACT_TYPES
    wants_caa = tid in _CAA_TEMPLATE_IDS or atype in _CAA_ARTIFACT_TYPES
    wants_analysis = bool(_ANALYSIS_INTENT_RE.search(text))
    wants_explicit = user_requests_explicit_verify(text)
    # User armed web search in the UI → packs are in scope; no trigger phrase required.
    wants_web_armed = bool(capabilities.web)

    if not wants_research and not wants_caa and not wants_analysis and not wants_explicit and not wants_web_armed:
        return "skip", "not_in_scope"

    if not capabilities.any_enabled:
        return "skip", "no_capabilities"

    if wants_research:
        return "after_rp1", None
    if wants_caa:
        return "after_caa2", None
    return "pre_step", None


def action_gate_enabled(defaults: dict[str, Any] | None) -> bool:
    """Admin kill-switch; default on for Wave 1."""
    if not defaults:
        return True
    raw = defaults.get("ensemble_actions_enabled")
    if raw is None:
        return True
    if isinstance(raw, bool):
        return raw
    return str(raw).strip().lower() not in {"0", "false", "off", "no"}
