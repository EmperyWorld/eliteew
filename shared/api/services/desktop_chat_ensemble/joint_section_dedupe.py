# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Deterministic joint-markdown hygiene: strip history-preamble echoes and drop
# near-duplicate top-level ``##`` sections before polish/finalizer persist.
# Invariants:
# - Prefer keep-first when two section bodies overlap heavily (token Jaccard-like).
# - Never invent content; only delete/strip.
# Related:
# - api/services/desktop_chat_ensemble/archive/legacy_freeform/stream_turn.py
# - api/services/desktop_chat_ensemble/archive/legacy_freeform/joint_polish.py
# - api/services/desktop_chat_ensemble/blueprint/artifact_finalizer.py
# ---
"""Deterministic dedupe / preamble strip for ensemble joint markdown."""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

_HEADING_RE = re.compile(r"(?m)^(#{2})\s+(.+?)\s*$")
_WORD_RE = re.compile(r"[A-Za-zА-Яа-яЁё0-9_]{3,}")
_STOP_WORDS = frozenset(
    {
        "the",
        "and",
        "for",
        "with",
        "that",
        "this",
        "from",
        "или",
        "для",
        "при",
        "как",
        "что",
        "это",
        "все",
        "его",
        "ее",
        "они",
        "модуль",
        "инструмент",
        "сервис",
    }
)

# History shaping + model echo: "Совместный ответ участников [A, B]: ## …"
# Optional markdown bold/italic around the label (same class as «Реплика участника» echo).
_JOINT_PREAMBLE_RE = re.compile(
    r"(?is)(?:^|\n)\s*\*{0,2}\s*Совместный\s+ответ\s+участников\s*\[[^\]]*\]\s*:\s*\*{0,2}\s*",
)
_TEAM_FORMED_LEAD_RE = re.compile(
    r"(?im)^\s*\*{0,2}\s*Команда\s+сформировала\s+расширенный\s+перечень[^\n]*\*{0,2}\s*\n+",
)


def strip_joint_history_preamble(text: str) -> str:
    """Remove joint history-echo prefixes that leak into section bodies."""
    raw = text or ""
    if not raw.strip():
        return raw
    out = _JOINT_PREAMBLE_RE.sub("\n", raw)
    out = _TEAM_FORMED_LEAD_RE.sub("", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def _meaningful_tokens(text: str) -> set[str]:
    return {token.casefold() for token in _WORD_RE.findall(text) if token.casefold() not in _STOP_WORDS}


def _overlap_ratio(left: set[str], right: set[str]) -> float:
    if len(left) < 18 or len(right) < 18:
        return 0.0
    return len(left.intersection(right)) / max(1, min(len(left), len(right)))


def _split_top_level_h2(markdown: str) -> list[tuple[str, str, str]]:
    """Return list of (full_block_including_heading, heading, body)."""
    text = (markdown or "").strip()
    if not text:
        return []
    matches = list(_HEADING_RE.finditer(text))
    if not matches:
        return [("", "", text)]
    blocks: list[tuple[str, str, str]] = []
    # Leading prose before first ##
    if matches[0].start() > 0:
        lead = text[: matches[0].start()].strip()
        if lead:
            blocks.append((lead, "", lead))
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        chunk = text[match.start() : end].strip()
        heading = match.group(2).strip()
        body = text[match.end() : end].strip()
        blocks.append((chunk, heading, body))
    return blocks


def outline_joint_section_body(body: str, *, max_bullets: int = 8, max_line: int = 140) -> str:
    """Compress a section body to outline bullets for peer inject (not full text)."""
    cleaned = strip_joint_history_preamble(body or "")
    bullets: list[str] = []
    for line in cleaned.splitlines():
        s = line.strip()
        if not s or s.startswith("```"):
            continue
        if s.startswith("#"):
            # nested heading → short marker only
            title = s.lstrip("#").strip()
            if title:
                bullets.append(f"- (раздел) {title[:max_line]}")
            continue
        if re.match(r"^(\d+[.)]\s+|[-*•]\s+)", s):
            item = re.sub(r"^(\d+[.)]\s+|[-*•]\s+)", "", s).strip()
            if item:
                bullets.append(f"- {item[:max_line]}")
        if len(bullets) >= max_bullets:
            break
    if not bullets:
        # Fallback: first non-empty lines
        for line in cleaned.splitlines():
            s = line.strip()
            if len(s) < 8:
                continue
            bullets.append(f"- {s[:max_line]}")
            if len(bullets) >= max_bullets:
                break
    if not bullets:
        return "- (секция без извлекаемого оглавления)"
    return "\n".join(bullets)


def dedupe_joint_markdown(markdown: str, *, overlap_threshold: float = 0.65) -> tuple[str, list[str]]:
    """
    Drop later top-level ``##`` sections whose bodies heavily overlap earlier ones.
    Also strip joint history preamble from each body.
    Returns (cleaned_markdown, action_notes).
    """
    raw = (markdown or "").strip()
    if not raw:
        return raw, []

    notes: list[str] = []
    stripped_whole = strip_joint_history_preamble(raw)
    if stripped_whole != raw.strip():
        notes.append("stripped_joint_preamble")
        raw = stripped_whole

    blocks = _split_top_level_h2(raw)
    if len(blocks) <= 1:
        return raw, notes

    kept: list[tuple[str, str, str]] = []
    kept_tokens: list[set[str]] = []
    for chunk, heading, body in blocks:
        body_clean = strip_joint_history_preamble(body)
        if body_clean != body:
            notes.append("stripped_section_preamble")
            body = body_clean
            chunk = f"## {heading}\n\n{body}" if heading else body

        tokens = _meaningful_tokens(body)
        drop = False
        if heading and len(body) >= 180 and len(tokens) >= 18:
            for earlier_tokens in kept_tokens:
                if _overlap_ratio(tokens, earlier_tokens) >= overlap_threshold:
                    drop = True
                    notes.append(f"dropped_duplicate_section:{heading[:80]}")
                    break
        if drop:
            continue
        kept.append((chunk if heading else body, heading, body))
        kept_tokens.append(tokens)

    if not kept:
        return raw, notes

    # Re-join with --- between ## sections (skip empty heading lead as plain)
    parts: list[str] = []
    for _chunk, heading, body in kept:
        if heading:
            parts.append(f"## {heading}\n\n{body}".strip())
        else:
            parts.append(body.strip())
    out = "\n\n---\n\n".join(p for p in parts if p)
    out = re.sub(r"\n{3,}", "\n\n", out).strip()
    if notes:
        logger.info(
            "[STEP] ensemble_joint_dedupe actions=%s pre_chars=%s post_chars=%s",
            notes,
            len(markdown),
            len(out),
        )
    return out, notes


def has_duplicate_section_violations(violations: list[str] | tuple[str, ...]) -> bool:
    return any(
        str(v).startswith("duplicate_sections:") or str(v).startswith("duplicate_paragraph:") for v in violations
    )
