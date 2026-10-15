# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `ewa_platform/companion/turn/system_budget.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Token/character budget enforcer for the **EWA companion** system prompt. The previous chain concatenated
# ground truth, HCM, file bodies, condensed turns, anchor, EWA.md, and a long allow-list — producing 30–35 KB
# prompts that included a marketing-AMKA paragraph and the same user message repeated three times.
# This module:
#   * collects labelled blocks with a priority weight (lower = more important);
#   * enforces a hard ``EWA_COMPANION_SYSTEM_MAX_CHARS`` cap (default **48 KB** — sized for Qwen ``num_ctx=262144``);
#   * preserves the **fixed order** required by the LLM (ground truth → anchor → file body → HCM → condensed);
#   * applies SHA-1 deduplication to "related episodes" so the same phrase is not repeated;
#   * runs a final **persona-boundary scope guard** that strips any line referencing marketing AMKA / cabinet builder.
# Invariants:
# - The result is always within budget; if a single block is itself larger than the cap, it is **truncated** with a tail
#   note ``\n…[truncated for budget]`` so the LLM sees a deterministic suffix.
# - Block ordering is fixed; callers that pass blocks out of order are reordered by ``BlockKind`` priority.
# - The persona-boundary guard never touches the user message — only the *system* prompt builder.
# - ``[STEP] companion_system_budget`` log line includes per-block char counts and final size for observability.
# - Default cap is **48 000 chars**; ``EWA_COMPANION_SYSTEM_MAX_CHARS`` overrides it within ``[2000, 128000]``.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py (call site)
# - api/ewa_platform/companion/memory/retrieval.py (HCM block source)
# - api/ewa_platform/companion/context/anchor.py (anchor block source)
# - api/ewa_platform/docs/EWA.md (persona text — must not leak marketing AMKA content)
# ---
"""Budget-aware system-prompt builder for the EWA companion turn."""

from __future__ import annotations

import hashlib
import logging
import os
import re
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Final

logger = logging.getLogger(__name__)


class BlockKind(IntEnum):
    """Ordered classes of system-prompt blocks. Lower value = inserted first."""

    GROUND_TRUTH = 10
    ANCHOR = 20
    FILE_BODY = 30
    HCM = 40
    CONDENSED = 50
    APPENDIX = 60


@dataclass(frozen=True)
class SystemBlock:
    """One labelled block in the system prompt with priority and dedup hint."""

    kind: BlockKind
    label: str
    body: str
    dedupe_within_label: bool = False


@dataclass
class SystemPromptBudgetResult:
    """Outcome of the budget pass; ``text`` is what gets sent to the LLM."""

    text: str = ""
    used_chars: int = 0
    dropped_blocks: list[str] = field(default_factory=list)
    truncated_blocks: list[str] = field(default_factory=list)


# Qwen-class chat models running on stack2 use ``EWA_COMPANION_CHAT_NUM_CTX=262144`` (~64k tokens of headroom).
# A 48 KB system prompt is ~12k tokens — well within the window and large enough to hold:
#   * persona / character / style sections (~6 KB)
#   * Operator ground truth + anchor + condensed (~5–8 KB)
#   * HCM memory section (~2–4 KB)
#   * Server catalog snapshot (≤6 KB after the noise filter + browse-cap tighten)
#   * Catalogue discuss file body (up to ~24 KB via ``EWA_COMPANION_CATALOG_DISCUSS_MAX_CHARS``)
# Previously the cap was 16 KB which evicted ~half of every turn whenever a file body or large HCM block was injected.
_DEFAULT_MAX_CHARS: Final[int] = 48000
_TRUNCATION_TAIL: Final[str] = "\n…[truncated for budget]"

# Persona-boundary scope guard: lines or sentences that obviously belong to the marketing AMKA contour.
# Removing these prevents EWA from inventing "marketing cabinet" persona names (КОЛА/МЕЛЯ) when the user asks about EW.
_AMKA_MARKETING_PATTERNS = (
    re.compile(r"(?im)^.*\bmarketing[\s_-]?cabinet\b.*$"),
    re.compile(r"(?im)^.*\bmarketing[_\s-]?amka\b.*$"),
    re.compile(r"(?im)^.*кабинет(?:\s+маркетинг(?:а|ового))?.*\bAMKA\b.*$"),
    re.compile(r"(?im)^.*\bMarketingCabinetAmkaView\b.*$"),
    re.compile(r"(?im)^.*\bbuilder\s+маркетингов(?:ого|ой)\s+контура\b.*$"),
)


def get_system_max_chars() -> int:
    """Return the configured per-turn system-prompt character cap (env-overridable)."""
    raw = os.getenv("EWA_COMPANION_SYSTEM_MAX_CHARS")
    if raw is None:
        return _DEFAULT_MAX_CHARS
    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError):  # fmt: skip
        return _DEFAULT_MAX_CHARS
    return max(2000, min(value, 128000))


def _sha1_of(s: str) -> str:
    """Stable SHA-1 hex digest used for "related episodes" content dedup."""
    return hashlib.sha1(s.strip().encode("utf-8")).hexdigest()  # noqa: S324 — non-security identity key


def deduplicate_related_episodes(lines: list[str]) -> list[str]:
    """Stable dedup of related-episode bullets by SHA-1 of their normalized content."""

    seen: set[str] = set()
    out: list[str] = []
    for raw in lines:
        body = (raw or "").strip()
        if not body:
            continue
        digest = _sha1_of(body)
        if digest in seen:
            continue
        seen.add(digest)
        out.append(raw)
    return out


def apply_persona_boundary_scope_guard(text: str) -> str:
    """Strip any line that references marketing-cabinet AMKA so the EWA persona does not leak.

    The user's EW desktop companion (sometimes called «спутник») is **not** the marketing cabinet AMKA; the LLM
    confused the two when the system prompt accidentally included paragraphs from the marketing handbook.
    """

    if not text:
        return text
    cleaned = text
    for pattern in _AMKA_MARKETING_PATTERNS:
        cleaned = pattern.sub("", cleaned)
    # Collapse 3+ blank lines created by removed paragraphs.
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _truncate_to_fit(body: str, available: int) -> str:
    """Return ``body`` shortened to ``available`` chars with a clear tail marker."""

    if available <= 0:
        return ""
    if len(body) <= available:
        return body
    cut = max(0, available - len(_TRUNCATION_TAIL))
    return body[:cut] + _TRUNCATION_TAIL


def assemble_system_prompt(
    blocks: list[SystemBlock],
    *,
    max_chars: int | None = None,
    persona_guard: bool = True,
) -> SystemPromptBudgetResult:
    """Compose the system prompt by priority, with budget enforcement and persona scope guard."""

    cap = max_chars if max_chars is not None else get_system_max_chars()
    ordered = sorted(blocks, key=lambda b: (int(b.kind), b.label))
    used = 0
    parts: list[str] = []
    dropped: list[str] = []
    truncated: list[str] = []

    for block in ordered:
        body = block.body or ""
        if persona_guard:
            body = apply_persona_boundary_scope_guard(body)
        body = body.strip()
        if not body:
            dropped.append(block.label)
            continue
        # +2 for the "\n\n" separator (skipped on first block; we charge it uniformly for budget accounting)
        sep_cost = 2 if parts else 0
        remaining = cap - used - sep_cost
        if remaining <= 0:
            dropped.append(block.label)
            continue
        fitted = _truncate_to_fit(body, remaining)
        if fitted != body:
            truncated.append(block.label)
        used += len(fitted) + sep_cost
        parts.append(fitted)

    text = "\n\n".join(parts).strip()
    used = len(text)
    logger.info(
        "[STEP] companion_system_budget cap=%s used=%s blocks=%s dropped=%s truncated=%s",
        cap,
        used,
        len(parts),
        ",".join(dropped) or "-",
        ",".join(truncated) or "-",
    )
    return SystemPromptBudgetResult(text=text, used_chars=used, dropped_blocks=dropped, truncated_blocks=truncated)


__all__ = (
    "BlockKind",
    "SystemBlock",
    "SystemPromptBudgetResult",
    "apply_persona_boundary_scope_guard",
    "assemble_system_prompt",
    "deduplicate_related_episodes",
    "get_system_max_chars",
)
