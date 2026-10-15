# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `ewa_platform/companion/affective/self_correction.py`; preserves its existing EliteEW API/service responsibilities.
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
# **Self-Correction Loop** for EWA companion (project «Mela's Ascension», Module C2). After the LLM produced
# a reply, before persistence, check the reply against durable memory: first **pinned identity / story rows**
# in ``companion_memory_v1``; optionally (``EWA_COMPANION_SELF_CORRECTION_EPISODES_ENABLED``) a second pass
# treats top **Qdrant episodic** hits mirrored as ephemeral facts via the same regex contradiction engine.
# When contradiction is suspected we append one short clarification footer rather than rewriting the prose.
# Invariants:
# - Optional episodic mirror never calls the chat LLM; it may invoke the **embedding HTTP** endpoint only.
# - **Never** mutates the LLM reply beyond appending one short paragraph; if no contradiction is found the
#   returned text equals the input.
# - Disabled by default. Feature flag: ``EWA_COMPANION_SELF_CORRECTION_ENABLED=true``.
# - Auditing into ``ewa_companion_episodes`` is best-effort and fire-and-forget; failure must not impact
#   the chat turn outcome.
# Related:
# - api/services/chat_memory_service.py (embedding + episodic Qdrant client gate)
# - api/ewa_platform/companion/turn/chat_turn.py (call sites)
# - api/ewa_platform/companion/affective/affective_router.py (sibling cognition module)
# - documentation/product/ewa/EWA-COMPANION-PROFILE-ADR.md
# ---

from __future__ import annotations

import asyncio
import logging
import os
import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

_FOOTER_MARKER: str = "[mela:self-correction]"
_MAX_REPLY_FOR_SCAN: int = 8192
_MAX_FACTS_SCANNED: int = 64
_MIN_IMPORTANCE_FOR_CHECK: int = 6


@dataclass(frozen=True)
class SelfCorrectionOutcome:
    """Result of one self-correction pass over a reply text."""

    reply_text: str
    triggered: bool
    matched_fact_hashes: tuple[str, ...]
    rationale: str

    @property
    def changed(self) -> bool:
        return self.triggered


def self_correction_enabled() -> bool:
    return os.getenv("EWA_COMPANION_SELF_CORRECTION_ENABLED", "false").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


_NEG_TOKENS_RU: tuple[str, ...] = (
    "не ",
    "не,",
    "никогда",
    "нет ",
    "без ",
    "избегаю",
    "не пью",
    "не ем",
    "терпеть не могу",
    "ненавижу",
    "не люблю",
    "не выношу",
)
_NEG_TOKENS_EN: tuple[str, ...] = (
    "don't ",
    "do not ",
    "never ",
    "no ",
    "without ",
    "hate ",
    "dislike ",
    "i can't stand",
    "i avoid",
)

_AFFIRM_TRIGGERS_RU: tuple[str, ...] = (
    "давай",
    "попробуй",
    "обязательно",
    "стоит",
    "советую",
    "рекоменду",
)
_AFFIRM_TRIGGERS_EN: tuple[str, ...] = (
    "let's",
    "you should",
    "try ",
    "i recommend",
    "you can",
)


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


_VERB_PREFIXES_RU: tuple[str, ...] = (
    "пью",
    "ем",
    "ест",
    "люблю",
    "хочу",
    "переношу",
    "выношу",
    "выпью",
    "буду",
    "пробую",
)
_VERB_PREFIXES_EN: tuple[str, ...] = (
    "drink",
    "drink ",
    "eat",
    "take",
    "want",
    "like",
    "use",
)


def _extract_negated_topics(fact_content: str) -> list[str]:
    """If the fact looks like «не пью кофе» / «I don't drink coffee», return candidate topic tokens.

    The pure-regex approach yields a small list of likely topics: each is later matched against the
    reply window for a positive-suggestion overlap.
    """

    norm = _normalize(fact_content)
    if not norm:
        return []
    topics: list[str] = []
    for needle in (*_NEG_TOKENS_RU, *_NEG_TOKENS_EN):
        idx = norm.find(needle)
        if idx == -1:
            continue
        tail = norm[idx + len(needle) :].strip(" ,.!?-—:;")
        if not tail:
            continue
        clause = re.split(r"[,.!?;:]", tail, maxsplit=1)[0].strip()
        clause = re.sub(r"^(very\s+|much\s+|особенно\s+|вовсе\s+)", "", clause)
        clause = clause.split(" но ")[0].split(" but ")[0].strip()
        if not clause:
            continue
        if 2 <= len(clause) <= 120 and clause not in topics:
            topics.append(clause)
        tokens = [tok for tok in re.split(r"\s+", clause) if tok]
        if tokens and tokens[0] in (*_VERB_PREFIXES_RU, *_VERB_PREFIXES_EN):
            tokens = tokens[1:]
        for token in tokens:
            token = token.strip(" .,!?;:-—()[]\"'")
            if 3 <= len(token) <= 60 and token not in topics:
                topics.append(token)
    return topics


def _reply_makes_positive_suggestion_about(reply_norm: str, topic: str) -> bool:
    topic_norm = topic.strip().lower()
    if not topic_norm or topic_norm not in reply_norm:
        return False
    pos = reply_norm.find(topic_norm)
    window_start = max(0, pos - 80)
    window = reply_norm[window_start : pos + len(topic_norm) + 40]
    return any(trig in window for trig in (*_AFFIRM_TRIGGERS_RU, *_AFFIRM_TRIGGERS_EN))


def _candidate_facts(memory_rows: Iterable[Mapping[str, Any]]) -> list[Mapping[str, Any]]:
    out: list[Mapping[str, Any]] = []
    for row in memory_rows:
        if not isinstance(row, Mapping):
            continue
        try:
            importance = int(row.get("importance", 0) or 0)
        except (TypeError, ValueError):  # fmt: skip
            importance = 0
        if importance < _MIN_IMPORTANCE_FOR_CHECK:
            continue
        kind = str(row.get("kind") or "").strip().lower()
        if kind and kind not in {
            "identity",
            "preference",
            "task_preference",
            "catalog_preference",
            "relationship",
            "story",
            "correction",
        }:
            continue
        out.append(row)
        if len(out) >= _MAX_FACTS_SCANNED:
            break
    return out


def review_reply_against_identity(
    *,
    reply_text: str,
    memory_rows: Iterable[Mapping[str, Any]] | None,
) -> SelfCorrectionOutcome:
    """Deterministic, no-LLM check: does ``reply_text`` contradict pinned identity facts?"""

    text = (reply_text or "")[:_MAX_REPLY_FOR_SCAN]
    if not text.strip():
        return SelfCorrectionOutcome(
            reply_text=reply_text or "",
            triggered=False,
            matched_fact_hashes=(),
            rationale="empty_reply",
        )
    if memory_rows is None:
        return SelfCorrectionOutcome(
            reply_text=reply_text,
            triggered=False,
            matched_fact_hashes=(),
            rationale="no_memory",
        )

    reply_norm = _normalize(text)
    matches: list[tuple[str, str]] = []
    for row in _candidate_facts(memory_rows):
        content = str(row.get("content") or row.get("body") or "").strip()
        if not content:
            continue
        topics = _extract_negated_topics(content)
        if not topics:
            continue
        for topic in topics:
            if _reply_makes_positive_suggestion_about(reply_norm, topic):
                content_hash = str(row.get("content_hash") or "")
                matches.append((content_hash, topic))
                break

    if not matches:
        return SelfCorrectionOutcome(
            reply_text=reply_text,
            triggered=False,
            matched_fact_hashes=(),
            rationale="no_contradiction",
        )

    topics = ", ".join(sorted({topic for _, topic in matches}))
    footer = (
        f"\n\n{_FOOTER_MARKER} Подожди, ты говорила, что **{topics}** — точно подходит? Если я ошиблась, поправь меня."
    )
    new_reply = reply_text.rstrip() + footer
    fact_hashes = tuple(sorted({h for h, _ in matches if h}))

    return SelfCorrectionOutcome(
        reply_text=new_reply,
        triggered=True,
        matched_fact_hashes=fact_hashes,
        rationale=f"contradiction_on:{topics}",
    )


def schedule_self_correction_audit(
    pool: Any,
    *,
    principal_id: str,
    persona: str,
    body: str,
) -> None:
    """Fire-and-forget Postgres write for audit. Best-effort, no impact on chat outcome."""

    try:
        from api.ewa_platform.persistence_pg import episodes_asyncpg

        async def _do() -> None:
            try:
                await episodes_asyncpg.episode_insert(
                    pool,
                    principal_id=principal_id,
                    turn_id=None,
                    kind="self_correction",
                    source="self_correction_loop",
                    persona=persona,
                    importance=3,
                    valence=0,
                    body=body[:2000],
                )
            except Exception as exc:
                logger.warning("self_correction_audit_failed err=%s", exc)

        asyncio.create_task(_do())
    except Exception as exc:
        logger.warning("self_correction_audit_skipped err=%s", exc)


def episodic_self_correction_retrieval_enabled() -> bool:
    """Second deterministic pass grounded in episodic Qdrant hits (embedding HTTP allowed, no chat LLM)."""

    return os.getenv("EWA_COMPANION_SELF_CORRECTION_EPISODES_ENABLED", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


async def augment_reply_with_episodic_self_correction(
    reply_text: str,
    *,
    principal_id: str,
    pool: Any,
) -> tuple[str, bool]:
    """If enabled, run the same deterministic contradiction heuristic against ephemeral episodic hits.

    Returns ``(possibly_augmented_reply, triggered)``. On any infra error returns ``(reply_text, False)``.
    """

    base = reply_text if isinstance(reply_text, str) else ""
    pid = str(principal_id or "").strip()
    if not episodic_self_correction_retrieval_enabled() or pool is None or not pid or not base.strip():
        return base, False
    excerpt = base.strip()[:520]
    try:
        from api.ewa_platform.persistence_vector.companion_qdrant import search_companion_episodic
        from api.services.chat_memory_service import (
            EMBEDDING_DIMENSION,
            _get_embedding,
            _get_qdrant_client_companion_episodic,
        )
    except ImportError:
        return base, False
    from api.ewa_platform.companion.sidecar.stack2_semaphore import embed_slot  # noqa: PLC0415

    try:
        async with embed_slot(reason="self_correction"):
            vec = await _get_embedding(excerpt)
        if not isinstance(vec, list) or not vec:
            return base, False
        dim = int(EMBEDDING_DIMENSION)
        client = await _get_qdrant_client_companion_episodic()
        if client is None:
            return base, False
        hits = await search_companion_episodic(
            client,
            dim=dim,
            principal_id=pid,
            query_vector=list(vec),
            top_k=5,
            min_importance=None,
        )
        if not hits:
            return base, False
        pseudo_rows: list[dict[str, Any]] = []
        for h in hits[:5]:
            body = (str(h.body or "")).strip()
            if not body:
                continue
            pseudo_rows.append(
                {
                    "kind": "identity",
                    "type": "fact",
                    "importance": 9,
                    "confidence": 0.9,
                    "content": body,
                    "content_hash": f"episodic_mirror:{str(h.episode_id or '').strip()}",
                    "source": "episodic_self_correction_mirror",
                }
            )
        if not pseudo_rows:
            return base, False
        echo = review_reply_against_identity(reply_text=base, memory_rows=pseudo_rows)
        if not echo.triggered:
            return base, False
        logger.info("[STEP] companion_self_correction_episodes rationale=%s", echo.rationale)
        return echo.reply_text, True
    except Exception as exc:  # noqa: BLE001 — best-effort; never breaks chat_turn.
        logger.warning("[STEP] companion_self_correction_episodes_failed err=%s", exc)
        return base, False
