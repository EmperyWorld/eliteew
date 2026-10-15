# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Typed handoff from a Team blueprint (interview prep / research plan card)
# into Discussion preset ``interview``.
# Invariants:
# - Discussion still never auto-starts from /stream; the human clicks «Пройти интервью».
# - Topic/goal/roster/guide come from metadata.interview_handoff or markdown sections.
# - Roster prefers the prep card panel; never invent heroes outside known ids.
# Related:
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# ---
"""Extract interview room topic/goal/panel from a blueprint artifact."""

from __future__ import annotations

import re
from typing import Any, TypedDict

from api.services.desktop_chat_ensemble.heroes import HERO_SHORT_LABEL

HANDOFF_PRESET_ID = "interview"
TOPIC_MAX = 4000
GOAL_MAX = 4000
GUIDE_MAX = 8000
ROLE_MAX = 240
ROSTER_MAX = 4

_HEADING_ALIASES = {
    "тема интервью": "topic",
    "цель интервью": "goal",
    "interview topic": "topic",
    "interview goal": "goal",
    "гайд для панели": "panel_guide",
    "panel guide": "panel_guide",
    "гайд интервью": "panel_guide",
    "панель интервью": "panel",
    "состав панели": "panel",
    "interview panel": "panel",
}

_SECTION_RE = re.compile(
    r"(?ims)^#{2,3}\s*(тема интервью|цель интервью|interview topic|interview goal|"
    r"гайд для панели|panel guide|гайд интервью|панель интервью|состав панели|interview panel)"
    r"\s*\n+(.*?)(?=^#{2,3}\s|\Z)"
)

_BOLD_LABEL_RE = re.compile(
    r"(?ims)^\*\*(Тема|Цель|Interview topic|Interview goal):\*\*\s*(.*?)(?=^\*\*(?:Тема|Цель|Interview topic|Interview goal):\*\*|^#{2,3}\s|\Z)"
)
_BOLD_KEY = {
    "тема": "topic",
    "цель": "goal",
    "interview topic": "topic",
    "interview goal": "goal",
}

_HERO_TICK_RE = re.compile(r"`([a-z][a-z0-9_]{2,40})`")
_LABEL_TO_ID = {label.casefold(): hid for hid, label in HERO_SHORT_LABEL.items()}


class InterviewHandoff(TypedDict):
    topic: str
    goal: str
    preset_id: str
    roster: list[str]
    panel_guide: str
    panel_roles: dict[str, str]


def _clip(text: str, limit: int) -> str:
    cleaned = " ".join((text or "").split()).strip()
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[:limit].rstrip()


def _normalize_roster(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        hero = str(item or "").strip()
        if not hero or hero in seen or hero not in HERO_SHORT_LABEL:
            continue
        seen.add(hero)
        out.append(hero)
        if len(out) >= ROSTER_MAX:
            break
    return out


def _normalize_roles(raw: Any) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, str] = {}
    for key, value in raw.items():
        hero = str(key or "").strip()
        if hero not in HERO_SHORT_LABEL:
            continue
        role = _clip(str(value or ""), ROLE_MAX)
        if role:
            out[hero] = role
    return out


def _parse_panel_block(body: str) -> tuple[list[str], dict[str, str]]:
    roster: list[str] = []
    roles: dict[str, str] = {}
    seen: set[str] = set()
    for line in (body or "").splitlines():
        raw = line.strip().lstrip("-*•").strip()
        if not raw:
            continue
        hero: str | None = None
        tick = _HERO_TICK_RE.search(raw)
        if tick and tick.group(1) in HERO_SHORT_LABEL:
            hero = tick.group(1)
        else:
            lowered = raw.casefold()
            for label, hid in _LABEL_TO_ID.items():
                if label and label in lowered:
                    hero = hid
                    break
        if hero is None or hero in seen:
            continue
        seen.add(hero)
        roster.append(hero)
        role_part = raw
        if tick:
            role_part = raw[tick.end() :]
        role_part = role_part.lstrip(" —–-:|").strip()
        # Drop leading display name leftovers before the role dash.
        if "—" in role_part:
            role_part = role_part.split("—", 1)[-1].strip()
        elif "–" in role_part:
            role_part = role_part.split("–", 1)[-1].strip()
        role = _clip(role_part, ROLE_MAX)
        if role and role.casefold() != HERO_SHORT_LABEL.get(hero, "").casefold():
            roles[hero] = role
        if len(roster) >= ROSTER_MAX:
            break
    return roster, roles


def _from_metadata(metadata: dict[str, Any] | None) -> InterviewHandoff | None:
    raw = (metadata or {}).get("interview_handoff")
    if not isinstance(raw, dict):
        return None
    topic = _clip(str(raw.get("topic") or ""), TOPIC_MAX)
    goal = _clip(str(raw.get("goal") or ""), GOAL_MAX)
    if not topic:
        return None
    return {
        "topic": topic,
        "goal": goal,
        "preset_id": HANDOFF_PRESET_ID,
        "roster": _normalize_roster(raw.get("roster")),
        "panel_guide": _clip(str(raw.get("panel_guide") or ""), GUIDE_MAX),
        "panel_roles": _normalize_roles(raw.get("panel_roles")),
    }


def enrich_handoff_roster_from_contributors(
    handoff: InterviewHandoff,
    contributors: Any,
) -> InterviewHandoff:
    """Fill empty roster from blueprint contributor hero ids."""
    if handoff.get("roster"):
        return handoff
    filled = _normalize_roster(contributors)
    if not filled:
        return handoff
    enriched: InterviewHandoff = {**handoff, "roster": filled}
    return enriched


def extract_interview_handoff(
    markdown: str | None,
    metadata: dict[str, Any] | None = None,
) -> InterviewHandoff | None:
    """Return topic/goal/panel when the artifact is an interview room card."""
    from_meta = _from_metadata(metadata)
    if from_meta is not None:
        # Metadata topic wins; still allow markdown to fill missing guide/roster.
        body = markdown or ""
        if (not from_meta["roster"] or not from_meta["panel_guide"]) and body.strip():
            md_hit = extract_interview_handoff(body, None)
            if md_hit is not None:
                if not from_meta["roster"] and md_hit["roster"]:
                    merged_roster: InterviewHandoff = {
                        **from_meta,
                        "roster": md_hit["roster"],
                    }
                    from_meta = merged_roster
                    if not from_meta["panel_roles"] and md_hit["panel_roles"]:
                        merged_roles: InterviewHandoff = {
                            **from_meta,
                            "panel_roles": md_hit["panel_roles"],
                        }
                        from_meta = merged_roles
                if not from_meta["panel_guide"] and md_hit["panel_guide"]:
                    merged_guide: InterviewHandoff = {
                        **from_meta,
                        "panel_guide": md_hit["panel_guide"],
                    }
                    from_meta = merged_guide
        return from_meta

    body = markdown or ""
    found: dict[str, str] = {}
    panel_body = ""
    for match in _SECTION_RE.finditer(body):
        key = _HEADING_ALIASES.get(match.group(1).strip().casefold())
        if key is None:
            continue
        if key == "panel":
            if not panel_body:
                panel_body = match.group(2) or ""
            continue
        if key in found:
            continue
        limit = GUIDE_MAX if key == "panel_guide" else (TOPIC_MAX if key == "topic" else GOAL_MAX)
        clipped = _clip(match.group(2), limit)
        if clipped:
            found[key] = clipped
    if "topic" not in found:
        for match in _BOLD_LABEL_RE.finditer(body):
            key = _BOLD_KEY.get(match.group(1).strip().casefold())
            if key is None or key in found:
                continue
            clipped = _clip(match.group(2), TOPIC_MAX if key == "topic" else GOAL_MAX)
            if clipped:
                found[key] = clipped
        if "topic" not in found or "goal" not in found:
            return None
    topic = found.get("topic") or ""
    if not topic:
        return None
    roster, roles = _parse_panel_block(panel_body) if panel_body else ([], {})
    return {
        "topic": topic,
        "goal": found.get("goal") or "",
        "preset_id": HANDOFF_PRESET_ID,
        "roster": roster,
        "panel_guide": found.get("panel_guide") or "",
        "panel_roles": roles,
    }
