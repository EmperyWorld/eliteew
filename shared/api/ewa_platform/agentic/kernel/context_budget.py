# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Section-aware UTF-8 budget trim for Think prompts — Goal and Active task tree are immutable.
# Invariants:
# - Trim order: checkpoints → steering → plan_summary; never Goal, Hot memory,
#   Companion grounding, or Active task tree.
# Related:
# - api/ewa_platform/agentic/kernel/prompt_builder.py
# ---

from __future__ import annotations

from typing import TypedDict

from api.ewa_platform.agentic.config import agentic_think_context_max_utf8
from api.ewa_platform.agentic.kernel.prompt_builder import (
    FormattedThinkPrompt,
    ThinkPromptSections,
    parse_user_blob_sections,
)

_TRUNCATION_MARKER = "\n[... section truncated for token budget ...]\n"
_SECTION_CHECKPOINTS = "checkpoints"
_SECTION_STEERING = "steering"
_SECTION_PLAN_SUMMARY = "plan_summary"
_SECTION_LEGACY_USER = "legacy_user_blob"
_PRESERVED: tuple[str, ...] = (
    "session_status",
    "mission_anchor",
    "goal",
    "companion_grounding",
    "hot_memory",
    "active_task_tree",
)


class TrimSectionsMeta(TypedDict):
    truncated: bool
    sections_trimmed: list[str]
    preserved: list[str]
    protected_only: bool
    user_utf8: int


class TrimMessagesMeta(TypedDict):
    truncated: bool
    original_utf8: int
    final_utf8: int
    sections_trimmed: list[str]
    preserved: list[str]
    protected_only: bool
    user_utf8: int


def _utf8_len(text: str) -> int:
    return len(text.encode("utf-8"))


def _truncate_utf8(text: str, max_bytes: int) -> str:
    if max_bytes <= 0:
        return ""
    if _utf8_len(text) <= max_bytes:
        return text
    encoded = text.encode("utf-8")[:max_bytes]
    return encoded.decode("utf-8", errors="ignore")


def _protected_sections(sections: ThinkPromptSections) -> ThinkPromptSections:
    return ThinkPromptSections(
        session_status=sections.session_status,
        goal=sections.goal,
        mission_anchor=sections.mission_anchor,
        companion_grounding=sections.companion_grounding,
        active_task_tree=sections.active_task_tree,
        hot_memory=sections.hot_memory,
        plan_summary=None,
        checkpoints=None,
        steering_blocks=[],
    )


def trim_prompt_sections(
    sections: ThinkPromptSections,
    *,
    max_user_utf8: int,
) -> tuple[ThinkPromptSections, TrimSectionsMeta]:
    """Trim trimmable sections while preserving Goal and Active task tree."""

    protected = _protected_sections(sections)
    protected_len = _utf8_len(protected.to_user_blob())
    sections_trimmed: list[str] = []

    if protected_len >= max_user_utf8:
        return protected, TrimSectionsMeta(
            truncated=True,
            sections_trimmed=[_SECTION_CHECKPOINTS, _SECTION_STEERING, _SECTION_PLAN_SUMMARY],
            preserved=list(_PRESERVED),
            protected_only=True,
            user_utf8=protected_len,
        )

    plan_summary = sections.plan_summary
    checkpoints = sections.checkpoints
    steering = list(sections.steering_blocks)

    def _current_sections() -> ThinkPromptSections:
        return ThinkPromptSections(
            session_status=sections.session_status,
            goal=sections.goal,
            mission_anchor=sections.mission_anchor,
            companion_grounding=sections.companion_grounding,
            active_task_tree=sections.active_task_tree,
            plan_summary=plan_summary,
            hot_memory=sections.hot_memory,
            checkpoints=checkpoints,
            steering_blocks=steering,
        )

    def _current_len() -> int:
        return _utf8_len(_current_sections().to_user_blob())

    while _current_len() > max_user_utf8:
        progressed = False
        if checkpoints and checkpoints.strip():
            lines = checkpoints.splitlines()
            checkpoints = None if len(lines) <= 1 else "\n".join(lines[1:])
            if _SECTION_CHECKPOINTS not in sections_trimmed:
                sections_trimmed.append(_SECTION_CHECKPOINTS)
            progressed = True
        elif steering:
            steering.pop(0)
            if _SECTION_STEERING not in sections_trimmed:
                sections_trimmed.append(_SECTION_STEERING)
            progressed = True
        elif plan_summary and plan_summary.strip():
            plan_summary = plan_summary[: len(plan_summary) * 2 // 3] if _utf8_len(plan_summary) > 128 else None
            if _SECTION_PLAN_SUMMARY not in sections_trimmed:
                sections_trimmed.append(_SECTION_PLAN_SUMMARY)
            progressed = True
        if not progressed:
            break

    out = _current_sections()
    final_len = _utf8_len(out.to_user_blob())
    return out, TrimSectionsMeta(
        truncated=bool(sections_trimmed) or final_len > max_user_utf8,
        sections_trimmed=sections_trimmed,
        preserved=list(_PRESERVED),
        protected_only=False,
        user_utf8=final_len,
    )


def trim_formatted_prompt(
    prompt: FormattedThinkPrompt,
    *,
    max_utf8: int | None = None,
) -> tuple[FormattedThinkPrompt, TrimMessagesMeta]:
    """Trim a FormattedThinkPrompt to total UTF-8 budget."""

    cap = max_utf8 if max_utf8 is not None else agentic_think_context_max_utf8()
    original = prompt.total_utf8_len()
    if original <= cap:
        return prompt, TrimMessagesMeta(
            truncated=False,
            original_utf8=original,
            final_utf8=original,
            sections_trimmed=[],
            preserved=list(_PRESERVED),
            protected_only=False,
            user_utf8=prompt.user_utf8_len(),
        )

    system_text = prompt.system
    system_len = _utf8_len(system_text)
    sys_budget = min(system_len, cap // 3)
    user_budget = max(512, cap - sys_budget)

    if system_len > sys_budget:
        system_text = _truncate_utf8(system_text, sys_budget)

    trimmed_sections, section_meta = trim_prompt_sections(
        prompt.sections,
        max_user_utf8=user_budget,
    )
    out = FormattedThinkPrompt(system=system_text, sections=trimmed_sections)
    final = out.total_utf8_len()
    return out, TrimMessagesMeta(
        truncated=True,
        original_utf8=original,
        final_utf8=final,
        sections_trimmed=section_meta["sections_trimmed"],
        preserved=section_meta["preserved"],
        protected_only=section_meta["protected_only"],
        user_utf8=section_meta["user_utf8"],
    )


def trim_think_messages_to_budget(
    messages: list[dict[str, str]],
    *,
    max_utf8: int | None = None,
) -> tuple[list[dict[str, str]], TrimMessagesMeta]:
    """Return trimmed messages + meta. Uses section-aware trim when markers are present."""

    cap = max_utf8 if max_utf8 is not None else agentic_think_context_max_utf8()
    if not messages:
        return messages, TrimMessagesMeta(
            truncated=False,
            original_utf8=0,
            final_utf8=0,
            sections_trimmed=[],
            preserved=list(_PRESERVED),
            protected_only=False,
            user_utf8=0,
        )

    system_msg = messages[0] if messages[0].get("role") == "system" else {"role": "system", "content": ""}
    user_msg = messages[-1] if messages[-1].get("role") == "user" else {"role": "user", "content": ""}
    system_text = str(system_msg.get("content") or "")
    user_text = str(user_msg.get("content") or "")
    original = _utf8_len(system_text) + _utf8_len(user_text)

    if original <= cap:
        return messages, TrimMessagesMeta(
            truncated=False,
            original_utf8=original,
            final_utf8=original,
            sections_trimmed=[],
            preserved=list(_PRESERVED),
            protected_only=False,
            user_utf8=_utf8_len(user_text),
        )

    parsed = parse_user_blob_sections(user_text)
    if parsed is not None:
        prompt = FormattedThinkPrompt(system=system_text, sections=parsed)
        trimmed, meta = trim_formatted_prompt(prompt, max_utf8=cap)
        return trimmed.to_messages(), meta

    sys_budget = min(_utf8_len(system_text), cap // 3)
    user_budget = max(512, cap - sys_budget)
    if _utf8_len(system_text) > sys_budget:
        system_text = _truncate_utf8(system_text, sys_budget)
    if _utf8_len(user_text) > user_budget:
        marker = "\n\n[... context truncated for token budget ...]\n\n"
        head = user_text[: user_budget // 2]
        tail = user_text[-(user_budget // 3) :]
        combined = head + marker + tail
        while _utf8_len(combined) > user_budget and len(combined) > 64:
            combined = combined[: len(combined) * 2 // 3]
        user_text = combined

    out = [
        {"role": "system", "content": system_text},
        {"role": "user", "content": user_text},
    ]
    final = _utf8_len(system_text) + _utf8_len(user_text)
    return out, TrimMessagesMeta(
        truncated=True,
        original_utf8=original,
        final_utf8=final,
        sections_trimmed=[_SECTION_LEGACY_USER],
        preserved=[],
        protected_only=False,
        user_utf8=_utf8_len(user_text),
    )


def estimate_messages_utf8(messages: list[dict[str, str]]) -> int:
    total = 0
    for msg in messages:
        total += _utf8_len(str(msg.get("content") or ""))
    return total
