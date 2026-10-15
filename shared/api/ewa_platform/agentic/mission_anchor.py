# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Extract immutable mission anchor (identity, objectives, time-box) from strategic /agent prompts.
# Invariants:
# - Extraction is best-effort at session start only; anchor is persisted in goal_json v2.
# Related:
# - api/ewa_platform/agentic/goal_json.py
# - api/ewa_platform/agentic/starter.py
# ---

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

_IDENTITY_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?im)знакомимся\s+я\s*[—\-]\s*([A-Za-zА-Яа-яЁё][\w\-]*)"),
    re.compile(r"(?im)меня\s+зовут\s+([A-Za-zА-Яа-яЁё][\w\-]*)"),
    re.compile(r"(?im)^я[,\s]+([A-Za-zА-Яа-яЁё][\w\-]*)[,\s]"),
)
_TIME_BOX_RE = re.compile(r"(?i)(?:в течение\s+)?(\d+)\s*ч(?:ас(?:а|ов)?)?\b")
_OBJECTIVE_LINE_RE = re.compile(
    r"(?im)^\s*(?:"
    r"\d+[\).]"
    r"|\d+\)"
    r"|[АБВГДЕВРСТ][\).]"
    r"|-\s*\d+[\-.]"
    r")\s+(.+)$",
)
_RESULT_SECTION_RE = re.compile(r"(?im)результат\s*:\s*(.+?)(?:\n\n|\Z)", re.DOTALL)
_CONSTRAINT_RE = re.compile(r"(?im)^\s*(?:важно|ограничен|не\s+забыв|constraint)\s*[:\-]\s*(.+)$")
_MAX_OBJECTIVES = 12
_MAX_OBJECTIVE_CHARS = 500


@dataclass(frozen=True, slots=True)
class MissionAnchor:
    display_name: str
    objectives: tuple[str, ...]
    time_box: str | None
    constraints: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "display_name": self.display_name,
            "objectives": list(self.objectives),
            "time_box": self.time_box,
            "constraints": list(self.constraints),
            "immutable": True,
        }


def _strip_agent_prefix(user_line: str) -> str:
    line = str(user_line or "").strip()
    lower = line.lower()
    if lower.startswith("/agent "):
        return line[7:].strip()
    if lower.startswith("agentic:"):
        return line[8:].strip()
    return line


def strip_intake_goal_text(user_line: str) -> str:
    return _strip_agent_prefix(user_line)


def _extract_display_name(text: str) -> str:
    for pattern in _IDENTITY_PATTERNS:
        match = pattern.search(text)
        if match:
            name = str(match.group(1) or "").strip()
            if name and len(name) <= 64:
                return name[:64]
    return ""


def _extract_time_box(text: str) -> str | None:
    match = _TIME_BOX_RE.search(text)
    if not match:
        return None
    hours = str(match.group(1) or "").strip()
    if not hours:
        return None
    return f"{hours} ч"


def _normalize_objective(raw: str) -> str | None:
    cleaned = re.sub(r"\s+", " ", str(raw or "").strip(" .;,"))
    if len(cleaned) < 8:
        return None
    return cleaned[:_MAX_OBJECTIVE_CHARS]


def _extract_objectives(text: str) -> tuple[str, ...]:
    seen: set[str] = set()
    objectives: list[str] = []

    def _add(candidate: str) -> None:
        norm = _normalize_objective(candidate)
        if not norm:
            return
        key = norm.lower()
        if key in seen:
            return
        seen.add(key)
        objectives.append(norm)

    result_match = _RESULT_SECTION_RE.search(text)
    if result_match:
        block = str(result_match.group(1) or "")
        for part in re.split(r"(?<=\))\s*,\s*|\s{2,}", block):
            chunk = re.sub(r"^\s*\d+[\).]\s*", "", part.strip())
            _add(chunk)

    for line in text.splitlines():
        match = _OBJECTIVE_LINE_RE.match(line.strip())
        if match:
            _add(str(match.group(1) or ""))

    return tuple(objectives[:_MAX_OBJECTIVES])


def _extract_constraints(text: str) -> tuple[str, ...]:
    out: list[str] = []
    for line in text.splitlines():
        match = _CONSTRAINT_RE.match(line.strip())
        if match:
            norm = _normalize_objective(str(match.group(1) or ""))
            if norm:
                out.append(norm)
    if "критическое мышление студентов" in text.lower():
        out.append("Сохранять фокус на критическом мышлении студентов (цель ВУЗа).")
    return tuple(list(dict.fromkeys(out))[:6])


def extract_mission_anchor(user_line: str) -> MissionAnchor:
    """Best-effort structured anchor from a strategic work-session prompt."""

    text = _strip_agent_prefix(user_line)
    return MissionAnchor(
        display_name=_extract_display_name(text),
        objectives=_extract_objectives(text),
        time_box=_extract_time_box(text),
        constraints=_extract_constraints(text),
    )


def format_mission_anchor_for_think(anchor: Mapping[str, Any] | MissionAnchor) -> str:
    """Render anchor block for Think prompt injection."""

    data = anchor.to_dict() if isinstance(anchor, MissionAnchor) else dict(anchor)

    lines = ["Mission anchor (immutable):"]
    name = str(data.get("display_name") or "").strip()
    if name:
        lines.append(f"- Identity: {name}")
    time_box = str(data.get("time_box") or "").strip()
    if time_box:
        lines.append(f"- Time box: {time_box}")

    objectives = data.get("objectives")
    if isinstance(objectives, list) and objectives:
        lines.append("- Objectives:")
        for idx, item in enumerate(objectives[:_MAX_OBJECTIVES], start=1):
            text = str(item or "").strip()
            if text:
                lines.append(f"  {idx}. {text}")

    constraints = data.get("constraints")
    if isinstance(constraints, list) and constraints:
        lines.append("- Constraints:")
        for item in constraints:
            text = str(item or "").strip()
            if text:
                lines.append(f"  - {text}")

    if len(lines) == 1:
        lines.append("- (no structured anchor extracted — use Goal text)")
    return "\n".join(lines)


__all__ = (
    "MissionAnchor",
    "extract_mission_anchor",
    "format_mission_anchor_for_think",
    "strip_intake_goal_text",
)
