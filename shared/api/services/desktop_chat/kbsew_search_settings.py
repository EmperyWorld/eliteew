# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve KBSEW knowledge-base search toggles from desktop_ai_chat_config.defaults
# and optional per-chat settings (kbsew_search_settings JSONB block).
# Invariants:
# - When enabled is false, callers must omit knowledge_base_search from LLM tools.
# - barrel_id must be in allowed_barrels before search executes.
# - retrieval_mode is dense|hybrid (default dense); invalid values coerce to dense.
# Related:
# - api/services/desktop_chat/tools/knowledge_base_search_tool.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

KBSEW_AGENT_SURFACES: tuple[str, ...] = ("desktop", "ewa", "marketing", "imperorg", "ugs")

KBSEW_CHUNKS_PER_BARREL_MIN = 1
KBSEW_CHUNKS_PER_BARREL_MAX = 20
KBSEW_CHUNKS_PER_BARREL_DEFAULT = 5
KBSEW_RERANK_FETCH_MULTIPLIER = 4

KbsewRetrievalMode = Literal["dense", "hybrid"]
KBSEW_RETRIEVAL_MODE_DEFAULT: KbsewRetrievalMode = "dense"


def normalize_kbsew_retrieval_mode(raw: Any):
    if raw is None:
        return KBSEW_RETRIEVAL_MODE_DEFAULT
    text = str(raw).strip().lower()
    if text in {"dense", "hybrid"}:
        return text  # type: ignore[return-value]
    return KBSEW_RETRIEVAL_MODE_DEFAULT


_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _normalize_agent_flag(raw: Any, *, fallback: bool = False) -> bool:
    if isinstance(raw, bool):
        return raw
    if raw is None:
        return fallback
    text = str(raw).strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return fallback


def clamp_kbsew_chunks_per_barrel(raw: Any) -> int:
    if raw is None:
        return KBSEW_CHUNKS_PER_BARREL_DEFAULT
    try:
        value = int(raw)
    except TypeError, ValueError:
        return KBSEW_CHUNKS_PER_BARREL_DEFAULT
    return max(KBSEW_CHUNKS_PER_BARREL_MIN, min(KBSEW_CHUNKS_PER_BARREL_MAX, value))


def kbsew_vector_fetch_limit(settings: KbsewSearchSettings) -> int:
    """How many vector hits to request before optional rerank trimming."""
    take = settings.chunks_per_barrel
    if settings.rerank_enabled:
        return min(take * KBSEW_RERANK_FETCH_MULTIPLIER, KBSEW_CHUNKS_PER_BARREL_MAX)
    return take


class KbsewSearchSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")

    enabled: bool = False
    allowed_barrels: list[str] = Field(default_factory=list)
    agents: dict[str, bool] = Field(default_factory=dict)
    chunks_per_barrel: int = KBSEW_CHUNKS_PER_BARREL_DEFAULT
    rerank_enabled: bool = False
    retrieval_mode: KbsewRetrievalMode = KBSEW_RETRIEVAL_MODE_DEFAULT

    @field_validator("chunks_per_barrel", mode="before")
    @classmethod
    def _clamp_chunks_per_barrel(cls, value: Any) -> int:
        return clamp_kbsew_chunks_per_barrel(value)

    @field_validator("rerank_enabled", mode="before")
    @classmethod
    def _normalize_rerank_enabled(cls, value: Any) -> bool:
        return _normalize_agent_flag(value, fallback=False)

    @field_validator("retrieval_mode", mode="before")
    @classmethod
    def _normalize_retrieval_mode(cls, value: Any):
        return normalize_kbsew_retrieval_mode(value)

    @field_validator("agents", mode="before")
    @classmethod
    def _normalize_agents_raw(cls, value: Any) -> dict[str, bool]:
        base = {surface: False for surface in KBSEW_AGENT_SURFACES}
        if not isinstance(value, Mapping):
            return base
        for surface in KBSEW_AGENT_SURFACES:
            if surface in value:
                base[surface] = _normalize_agent_flag(value.get(surface), fallback=base[surface])
        return base

    @model_validator(mode="after")
    def _coalesce_legacy_desktop(self) -> KbsewSearchSettings:
        if self.enabled and not any(self.agents.values()):
            self.agents["desktop"] = True
        return self

    @field_validator("allowed_barrels", mode="before")
    @classmethod
    def _normalize_barrels(cls, value: Any) -> list[str]:
        if value is None:
            return []
        if not isinstance(value, list):
            raise ValueError("allowed_barrels must be a list of UUID strings")
        out: list[str] = []
        seen: set[str] = set()
        for item in value:
            normalized = normalize_barrel_uuid(str(item))
            if normalized and normalized not in seen:
                seen.add(normalized)
                out.append(normalized)
        return out


def normalize_barrel_uuid(raw: str) -> str | None:
    candidate = (raw or "").strip().lower()
    if not candidate:
        return None
    try:
        parsed = UUID(candidate)
    except ValueError:
        return None
    normalized = str(parsed)
    if not _UUID_RE.match(normalized):
        return None
    return normalized


def normalize_kbsew_search_settings(raw: Mapping[str, Any] | None) -> KbsewSearchSettings:
    if raw is None:
        return KbsewSearchSettings()
    if not isinstance(raw, Mapping):
        raise ValueError("kbsew_search_settings must be an object")
    return KbsewSearchSettings.model_validate(dict(raw))


def _apply_amka_kbsew_marketing_bridge(
    settings: KbsewSearchSettings,
    chat_settings: Mapping[str, Any] | None,
) -> KbsewSearchSettings:
    """AMKA ephemeral chats use surface ``marketing``; mirror desktop KBSEW when marketing toggle is off."""

    cs = dict(chat_settings or {})
    if not (cs.get("amka_ephemeral") or cs.get("amka_run_id")):
        return settings
    if not settings.enabled or not settings.allowed_barrels:
        return settings
    agents = dict(settings.agents)
    if agents.get("marketing"):
        return settings
    if agents.get("desktop") or not any(agents.values()):
        agents["marketing"] = True
        return settings.model_copy(update={"agents": agents, "enabled": True})
    return settings


def resolve_kbsew_search_settings(
    defaults: Mapping[str, Any] | None,
    chat_settings: Mapping[str, Any] | None = None,
) -> KbsewSearchSettings:
    base_raw = dict(defaults or {}).get("kbsew_search_settings")
    base = normalize_kbsew_search_settings(base_raw if isinstance(base_raw, Mapping) else None)

    # Legacy toggle (pre-kbsew_search_settings): do not break existing prod configs.
    if dict(defaults or {}).get("tools_knowledge_base_search_enabled") is True:
        agents = dict(base.agents)
        if not agents.get("desktop"):
            agents["desktop"] = True
            base = base.model_copy(update={"enabled": True, "agents": agents})
        elif not base.enabled:
            base = base.model_copy(update={"enabled": True})

    overlay_raw = dict(chat_settings or {}).get("kbsew_search_settings")
    if not isinstance(overlay_raw, Mapping):
        return _apply_amka_kbsew_marketing_bridge(base, chat_settings)

    merged: dict[str, Any] = base.model_dump()
    if "enabled" in overlay_raw:
        merged["enabled"] = bool(overlay_raw.get("enabled"))
    if "allowed_barrels" in overlay_raw:
        merged["allowed_barrels"] = overlay_raw.get("allowed_barrels")
    if isinstance(overlay_raw.get("agents"), Mapping):
        merged_agents = dict(merged.get("agents") or {})
        for surface in KBSEW_AGENT_SURFACES:
            if surface in overlay_raw["agents"]:
                merged_agents[surface] = _normalize_agent_flag(
                    overlay_raw["agents"].get(surface),
                    fallback=bool(merged_agents.get(surface, False)),
                )
        merged["agents"] = merged_agents
    if "chunks_per_barrel" in overlay_raw:
        merged["chunks_per_barrel"] = overlay_raw.get("chunks_per_barrel")
    if "rerank_enabled" in overlay_raw:
        merged["rerank_enabled"] = overlay_raw.get("rerank_enabled")
    if "retrieval_mode" in overlay_raw:
        merged["retrieval_mode"] = overlay_raw.get("retrieval_mode")
    resolved = normalize_kbsew_search_settings(merged)
    return _apply_amka_kbsew_marketing_bridge(resolved, chat_settings)


def is_agent_kbsew_enabled(settings: KbsewSearchSettings, agent_id: str) -> bool:
    surface = (agent_id or "").strip().lower()
    if surface not in KBSEW_AGENT_SURFACES:
        return False
    if settings.agents.get(surface):
        return True
    # Marketing cabinet (AMKA/IMC/chat) shares desktop KBSEW when only desktop is toggled on.
    return surface == "marketing" and bool(settings.agents.get("desktop"))


def kbsew_tool_visible_for_agent(settings: KbsewSearchSettings, agent_id: str) -> bool:
    return is_agent_kbsew_enabled(settings, agent_id) and bool(settings.allowed_barrels)


def kbsew_tool_visible(settings: KbsewSearchSettings) -> bool:
    return kbsew_tool_visible_for_agent(settings, "desktop")


def is_barrel_allowed(barrel_id: str, settings: KbsewSearchSettings) -> bool:
    normalized = normalize_barrel_uuid(barrel_id)
    if not normalized:
        return False
    return normalized in set(settings.allowed_barrels)


def merge_kbsew_defaults_for_chat(
    defaults: Mapping[str, Any],
    chat_settings: Mapping[str, Any] | None,
) -> dict[str, Any]:
    merged = dict(defaults)
    resolved = resolve_kbsew_search_settings(defaults, chat_settings)
    merged["kbsew_search_settings"] = resolved.model_dump()
    return merged
