# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave F1–F3: accumulate and serialize the ensemble council mini-chat transcript
# for SSE live append and assistant message metadata persistence.
# Invariants:
# - version=1 shape is stable for FE Process tab (Wave F2).
# - Turns are append-only; closing is set once via append_closing (Wave F3).
# Related:
# - archive/legacy_freeform/stream_turn.py
# - archive/legacy_freeform/council_finalize.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md (Council Protocol)
# ---
"""Council transcript accumulator (persist + SSE)."""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

from api.services.desktop_chat_ensemble.archive.legacy_freeform.council_brief import CouncilMode
from api.services.desktop_chat_ensemble.heroes import HERO_SHORT_LABEL
from api.services.desktop_chat_ensemble.speaker_output import sanitize_speaker_reply_body

CouncilTurnKind = Literal["orchestrator_brief", "speaker_reply", "closing"]
CouncilClosingDecision = Literal["ok", "supplement"]

COUNCIL_TRANSCRIPT_VERSION = 1


@dataclass(slots=True)
class CouncilTurn:
    kind: CouncilTurnKind
    text: str
    at_ms: int
    hero_id: str | None = None
    label: str | None = None
    index: int | None = None
    document_text: str | None = None

    def to_dict(self) -> dict[str, Any]:
        raw = asdict(self)
        return {k: v for k, v in raw.items() if v is not None}


@dataclass
class CouncilTranscriptAccumulator:
    mode: CouncilMode
    roster: list[str] = field(default_factory=list)
    turns: list[CouncilTurn] = field(default_factory=list)
    version: int = COUNCIL_TRANSCRIPT_VERSION
    closing: dict[str, Any] | None = None
    _t0: float = field(default_factory=time.monotonic, repr=False)

    def _elapsed_ms(self) -> int:
        return int((time.monotonic() - self._t0) * 1000)

    def append_orchestrator_brief(self, text: str, *, index: int | None = None) -> CouncilTurn:
        turn = CouncilTurn(
            kind="orchestrator_brief",
            text=(text or "").strip(),
            at_ms=self._elapsed_ms(),
            index=index,
            label="Оркестратор",
        )
        if turn.text:
            self.turns.append(turn)
        return turn

    def append_speaker_reply(
        self,
        *,
        hero_id: str,
        text: str,
        index: int,
        title: str | None = None,
        document_text: str | None = None,
    ) -> CouncilTurn:
        label = HERO_SHORT_LABEL.get(hero_id, hero_id)
        process_body = sanitize_speaker_reply_body(text, canonical_title=title)
        doc_body = (document_text or "").strip()
        if doc_body:
            doc_body = sanitize_speaker_reply_body(doc_body, canonical_title=title)
        elif title and title.strip():
            doc_body = f"## {title.strip()}\n\n{process_body}".strip() if process_body else f"## {title.strip()}"
        turn = CouncilTurn(
            kind="speaker_reply",
            text=process_body,
            at_ms=self._elapsed_ms(),
            hero_id=hero_id,
            label=label,
            index=index,
            document_text=doc_body or None,
        )
        if turn.text:
            self.turns.append(turn)
        return turn

    def append_closing(
        self,
        text: str,
        *,
        decision: CouncilClosingDecision,
        notes: str | None = None,
    ) -> CouncilTurn:
        """Wave F3: one closing turn + structured closing metadata."""
        body = (text or "").strip()
        turn = CouncilTurn(
            kind="closing",
            text=body,
            at_ms=self._elapsed_ms(),
            label="Итог",
        )
        if body:
            self.turns.append(turn)
        payload: dict[str, Any] = {"decision": decision}
        if notes and notes.strip():
            payload["notes"] = notes.strip()
        self.closing = payload
        return turn

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "mode": self.mode,
            "roster": list(self.roster),
            "turns": [t.to_dict() for t in self.turns],
            "closing": self.closing,
        }

    def sse_council_turn_event(self, turn: CouncilTurn) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "event": "council_turn",
            "turn": turn.to_dict(),
            "transcript_version": self.version,
            "mode": self.mode,
            "turns_count": len(self.turns),
        }
        if self.closing is not None:
            payload["closing"] = self.closing
        if self.roster:
            payload["roster"] = list(self.roster)
        return payload


def opening_orchestrator_brief_text(
    *,
    reason: str,
    huddle_lines: list[str],
    speakers: list[str],
    mode: CouncilMode,
) -> str:
    """Human-readable opening council brief from the one-shot plan."""
    lines: list[str] = []
    mode_label = "дискуссия" if mode == "discussion" else "совместный документ"
    lines.append(f"Режим: {mode_label}.")
    if reason.strip():
        lines.append(reason.strip())
    roster_lbl = ", ".join(HERO_SHORT_LABEL.get(h, h) for h in speakers)
    if roster_lbl:
        lines.append(f"Порядок высказываний: {roster_lbl}.")
    for ln in huddle_lines:
        s = (ln or "").strip()
        if s:
            lines.append(s)
    return "\n".join(lines).strip()
