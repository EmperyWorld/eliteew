# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Sanitize model control leakage (channel/thought tags) from user-visible agentic text
# and derive short mission/act summaries that are not research_plan scaffolds.
# Invariants:
# - Apply at tool/act write boundaries so journals and replies never store raw channel markup.
# - call_expert_chat act.reply must not surface raw ``## Фокус`` blueprint dumps as the mission answer.
# Related:
# - api/ewa_platform/agentic/jobs/step_executor.py
# - api/ewa_platform/companion/orchestration/tools/handlers_llm_utils.py
# - api/ewa_platform/agentic/adapters/task_run_mirror.py
# ---

from __future__ import annotations

import re

# Harmony / channel control tags seen from chat-template leakage into tool replies.
_CHANNEL_TAG_RE = re.compile(
    r"<\|/?\s*channel[^|>]*\|?>|"
    r"</?channel\|?>|"
    r"<channel\|?>",
    re.IGNORECASE,
)
_ORPHAN_THOUGHT_LINE_RE = re.compile(r"(?im)^\s*thought\s*$")
_MULTI_SPACE_RE = re.compile(r"[ \t]{2,}")
_MULTI_NL_RE = re.compile(r"\n{3,}")

# research_plan_v1 / ensemble blueprint openings that are not user-facing mission answers.
_SCAFFOLD_HEAD_MARKERS: tuple[str, ...] = (
    "## фокус",
    "# фокус",
    "**контекст решения**",
    "контекст решения",
    "research questions",
    "исследовательские вопросы",
    "гипотезы и сигналы",
    "**гипотеза 1**",
    "hypothesis 1",
)

# Methodology sections often titled «## Результат» — still scaffold, not laconic act summaries.
_METHODOLOGY_MARKERS: tuple[str, ...] = (
    "план анализа",
    "методика",
    "методология",
    "матрица доказательств",
    "evidence table",
    "insight brief",
    "артефакты (deliverables)",
    "deliverables",
    "частотный анализ",
    "frequency analysis",
)

# Do NOT match bare «Результат» — research_plan uses it as a methodology umbrella heading.
_FINDINGS_HEADING_RE = re.compile(
    r"(?im)^#{1,6}\s*(выводы|рекомендац\w*|топ[-\s]?3|findings|recommendations|"
    r"conclusion|итог\w*|сегмент\w*)\b"
)

_LACONIC_EXPERT_FALLBACK_RU = (
    "Экспертное исследование завершено. Полный материал передан в следующий шаг подготовки документа."
)


def sanitize_agentic_visible_text(text: str, *, max_chars: int | None = None) -> str:
    """Strip channel/thought control markup; keep readable prose for journals and tool replies."""

    out = str(text or "")
    if not out:
        return ""
    out = _CHANNEL_TAG_RE.sub(" ", out)
    out = _ORPHAN_THOUGHT_LINE_RE.sub("", out)
    out = _MULTI_SPACE_RE.sub(" ", out)
    out = _MULTI_NL_RE.sub("\n\n", out)
    out = out.strip()
    if max_chars is not None and max_chars > 0 and len(out) > max_chars:
        return out[: max_chars - 1].rstrip() + "…"
    return out


def looks_like_research_methodology(text: str) -> bool:
    """True when text is a research_plan methodology dump (often under «## Результат»)."""

    head = sanitize_agentic_visible_text(text)[:900].lower()
    if not head:
        return False
    if any(marker in head for marker in _METHODOLOGY_MARKERS):
        return True
    # Heading-only «## Результат» followed by plan/methods language.
    return bool(
        re.search(r"(?im)^#{1,6}\s*результат\w*\b", head)
        and ("анализ" in head or "метод" in head or "hypothesis" in head or "гипотез" in head)
    )


def looks_like_research_plan_scaffold(text: str) -> bool:
    """True when text opens like an ensemble research_plan blueprint, not a deliverable."""

    head = sanitize_agentic_visible_text(text)[:500].lower()
    if not head:
        return False
    if any(marker in head for marker in _SCAFFOLD_HEAD_MARKERS):
        return True
    return looks_like_research_methodology(text)


def _extract_findings_after_scaffold(text: str) -> str:
    match = _FINDINGS_HEADING_RE.search(text)
    if not match:
        return ""
    return text[match.start() :].strip()


def laconic_agentic_act_summary(text: str, *, max_chars: int = 220) -> str:
    """One-line journal summary — never a multi-heading methodology dump."""

    cleaned = sanitize_agentic_visible_text(text)
    if not cleaned:
        return ""
    if looks_like_research_plan_scaffold(cleaned) or looks_like_research_methodology(cleaned):
        return _LACONIC_EXPERT_FALLBACK_RU
    # Prefer first non-heading prose line.
    for line in cleaned.splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#"):
            continue
        plain = re.sub(r"[*_`]+", "", raw).strip()
        if plain:
            if len(plain) <= max_chars:
                return plain
            return plain[: max_chars - 1].rstrip() + "…"
    if len(cleaned) <= max_chars:
        return cleaned
    return cleaned[: max_chars - 1].rstrip() + "…"


def user_facing_expert_chat_reply(output_text: str, *, max_chars: int = 4000) -> str:
    """Act/journal reply for call_expert_chat — full blueprint stays in tool data.output_text."""

    text = sanitize_agentic_visible_text(output_text)
    if not text:
        return "Экспертное исследование завершено."
    if looks_like_research_plan_scaffold(text) or looks_like_research_methodology(text):
        findings = sanitize_agentic_visible_text(_extract_findings_after_scaffold(text))
        if (
            findings
            and not looks_like_research_plan_scaffold(findings)
            and not looks_like_research_methodology(findings)
        ):
            # Journal / ops need laconic lines; keep a short findings tease only.
            journal_cap = min(max_chars, 360)
            if len(findings) <= journal_cap:
                return findings
            return findings[: journal_cap - 1].rstrip() + "…"
        return _LACONIC_EXPERT_FALLBACK_RU
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1].rstrip() + "…"


__all__ = (
    "laconic_agentic_act_summary",
    "looks_like_research_methodology",
    "looks_like_research_plan_scaffold",
    "sanitize_agentic_visible_text",
    "user_facing_expert_chat_reply",
)
