# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave F3: decide council closing (ok|supplement) and assemble the Document-tab
# draft from persisted speaker_reply turns (transcript SoT), not race stitch alone.
# Invariants:
# - Closing is deterministic (no LLM); micro-replies deferred — notes only on supplement.
# - Empty transcript speaker replies fall back to caller-provided stitch markdown.
# Related:
# - archive/legacy_freeform/council_transcript.py
# - archive/legacy_freeform/stream_turn.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md (Council Protocol F3)
# ---
"""Council closing decision + transcript→document assembly."""

from __future__ import annotations

import re
from typing import Literal

from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_transcript import (
    CouncilTranscriptAccumulator,
    CouncilTurn,
)
from api.services.desktop_chat_ensemble.heroes import HERO_SHORT_LABEL
from api.services.desktop_chat_ensemble.joint_section_dedupe import dedupe_joint_markdown
from api.services.desktop_chat_ensemble.speaker_output import sanitize_speaker_reply_body

CouncilClosingDecision = Literal["ok", "supplement"]

_HEADING_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
_MIN_SPEAKER_CHARS = 80
_MIN_ASSEMBLE_PLAIN_CHARS = 8


def _document_section_substantive(text: str) -> bool:
    plain = re.sub(r"^#{1,6}\s+.+$", "", text or "", flags=re.MULTILINE).strip()
    return len(plain) >= _MIN_ASSEMBLE_PLAIN_CHARS


def _speaker_document_body(turn: CouncilTurn) -> str:
    doc = (turn.document_text or "").strip()
    if doc:
        return doc
    return (turn.text or "").strip()


def _speaker_turns(acc: CouncilTranscriptAccumulator) -> list[CouncilTurn]:
    return [t for t in acc.turns if t.kind == "speaker_reply" and _speaker_document_body(t)]


def _heading_titles(text: str) -> list[str]:
    return [m.group(1).strip() for m in _HEADING_RE.finditer(text or "") if m.group(1).strip()]


def decide_council_closing(
    acc: CouncilTranscriptAccumulator,
    *,
    expected_speakers: list[str] | None = None,
) -> tuple[CouncilClosingDecision, str, str | None]:
    """
    Return (decision, closing_turn_text, notes).

    ``ok`` — roster covered with non-trivial replies and no duplicate section titles.
    ``supplement`` — gaps / thin replies / duplicate zones (notes explain; no micro-LLM in F3).
    """
    speakers = list(expected_speakers or acc.roster)
    replies = _speaker_turns(acc)
    replied_ids = {t.hero_id for t in replies if t.hero_id}
    missing = [h for h in speakers if h not in replied_ids]
    thin = [t.hero_id or t.label or "?" for t in replies if len(_speaker_document_body(t)) < _MIN_SPEAKER_CHARS]
    titles: list[str] = []
    for t in replies:
        titles.extend(_heading_titles(_speaker_document_body(t)))
    # Normalize for dupe check
    norm = [" ".join(x.casefold().split()) for x in titles if x]
    dupes = sorted({t for t in norm if norm.count(t) > 1})

    reasons: list[str] = []
    if missing:
        labels = ", ".join(HERO_SHORT_LABEL.get(h, h) for h in missing)
        reasons.append(f"не высказались: {labels}")
    if thin:
        labels = ", ".join(HERO_SHORT_LABEL.get(h, h) if h in HERO_SHORT_LABEL else h for h in thin)
        reasons.append(f"слишком короткие реплики: {labels}")
    if dupes:
        reasons.append(f"повторяющиеся зоны: {', '.join(dupes[:4])}")

    mode_label = "дискуссия" if acc.mode == "discussion" else "совместный документ"
    if reasons:
        notes = "; ".join(reasons)
        text = (
            f"Закрытие совещания ({mode_label}): нужны уточнения.\n"
            f"Причины: {notes}.\n"
            "Документ собран из протокола с пометкой на доработку; "
            "повторный круг микро-реплик в этой волне не запускается."
        )
        return "supplement", text.strip(), notes

    text = (
        f"Закрытие совещания ({mode_label}): кворум собран, зоны без явных дублей.\n"
        "Финальный документ — санитаризация протокола реплик участников."
    )
    return "ok", text.strip(), None


def assemble_markdown_from_council_transcript(
    acc: CouncilTranscriptAccumulator,
) -> str:
    """Join speaker_reply turns into Document-tab draft (transcript SoT)."""
    parts: list[str] = []
    for turn in _speaker_turns(acc):
        body = sanitize_speaker_reply_body(_speaker_document_body(turn))
        if body and _document_section_substantive(body):
            parts.append(body.strip())
    raw = "\n\n---\n\n".join(parts).strip()
    if not raw:
        return raw
    cleaned, _notes = dedupe_joint_markdown(raw)
    cleaned = re.sub(r"(?:\n\s*---\s*){2,}", "\n\n---\n\n", cleaned).strip()
    return cleaned


def required_sections_from_council_transcript(
    acc: CouncilTranscriptAccumulator,
    *,
    fallback_titles: list[str] | None = None,
) -> list[str]:
    titles: list[str] = []
    seen: set[str] = set()
    for turn in _speaker_turns(acc):
        for title in _heading_titles(_speaker_document_body(turn)):
            key = " ".join(title.casefold().split())
            if key and key not in seen:
                seen.add(key)
                titles.append(title)
    if titles:
        return titles
    return [t for t in (fallback_titles or []) if (t or "").strip()]


def apply_council_closing(
    acc: CouncilTranscriptAccumulator,
    *,
    expected_speakers: list[str] | None = None,
) -> tuple[CouncilTurn, CouncilClosingDecision]:
    """Append closing turn + set closing metadata. Returns (turn, decision)."""
    decision, text, notes = decide_council_closing(acc, expected_speakers=expected_speakers)
    turn = acc.append_closing(text, decision=decision, notes=notes)
    return turn, decision
