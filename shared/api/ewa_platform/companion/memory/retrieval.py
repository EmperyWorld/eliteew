# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Compose the **memory section** of the EWA companion system prompt from hierarchical layers (HCM):
#   L0 — **Story** anchors (kind ``story``) under a pinned ``### Story / Кто мы друг другу`` heading;
#   L1 — pinned identity / preference facts (non-story top-N from ``companion_memory_v1``);
#   L2 — **Atoms** (optional graph mid-layer from ``ewa_atom`` when enabled);
#   L3 — episodic semantic recall from Qdrant;
#   L4 — Postgres **recency** fallback when vector returns empty.
# **Canonical path:** ``api.ewa_platform.companion.memory.retrieval``; stable alias ``api.ewa_platform.companion.memory.retrieval`` (shim).
# Invariants:
# - Wall budget ``EWA_COMPANION_RETRIEVAL_BUDGET_MS`` (UnifiedConfig; default ~4.5s, max 30s) bounds embed+Qdrant+rerank;
# - Episodic rerank timeout capped by remaining budget and ``EWA_COMPANION_EPISODIC_RERANK_TIMEOUT_SEC`` (default 8s).
# - **Retrieval router** (``EWA_COMPANION_RETRIEVAL_ROUTER_ENABLED``): Context anchor keyword overlap can
#   **short-circuit** deep episodic vector pull when coverage looks sufficient (telemetry records the decision).
# - ``EWA_COMPANION_ANCHOR_SHORT_CIRCUIT_SCORE``: catalog/PG uses **0–100**; runtime overlap is **[0,1]**.
#   Values ``>1`` normalize as percent (``/100``), then clamp to ``[0, 0.95]`` — never treat ``85`` as ``0.95``.
# - Returns a string ready for embedding in the prompt; on **any** error gracefully degrades to the legacy
#   deterministic top-N (``memory_prompt_section(get_memory(profile))``) — never raises into chat_turn.
# - The composed block is trimmed to ``memory_llm_inject_max_chars()`` from ``memory.hcm_store`` (KV-safe default; env override).
# - Episodic hits are **deduplicated** against identity facts by lowercase body comparison so we don't repeat
#   the same line twice in the prompt.
# - Optional **intent-aware ordering**: when ``EWA_COMPANION_EPISODIC_INTENT_PRIORITIZE`` is on and the caller
#   passes ``intent_plan`` (confidence ≥ planner floor), vector hits whose ``intent_hint`` matches the plan’s
#   intent are listed first (legacy points without ``intent_hint`` keep their relative tail order after matches).
# - Always filters episodic results by ``principal_id`` at the Qdrant layer; callers cannot leak across users.
# Related:
# - api/ewa_platform/companion/memory/hcm_store.py (legacy top-N + budget constants)
# - api/ewa_platform/companion/episodic/writer.py (writer)
# - api/ewa_platform/persistence_vector/companion_qdrant.py
# - api/services/chat_memory_service.py (companion episodic Qdrant + embeddings)
# - api/ewa_platform/companion/context/anchor.py (anchor overlap for router)
# - api/ewa_platform/atoms/classifier.py (atom layer flag)
# - documentation/product/ewa/EWA-COMPANION-HCM-MEMORY.md
# - documentation/product/ewa/EWA-COMPANION-MEMORY-EFFECTIVENESS-PLAN.md
# ---
"""Hierarchical Context Management (HCM) memory composer for EWA companion."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import asyncpg

from api.ewa_platform.companion.affective.persona_style import get_persona_style, rank_episodic_hits
from api.ewa_platform.companion.context.anchor import (
    anchor_dict_from_profile,
    anchor_keyword_overlap_score,
    normalize_context_anchor_v1,
)
from api.ewa_platform.companion.episodic.body_sanitize import (
    sanitize_companion_episode_body_for_storage,
)
from api.ewa_platform.companion.memory.hcm_store import (
    get_memory,
    memory_prompt_section,
    merge_memory_prompt_layers_for_llm,
    select_top_memories,
)
from api.ewa_platform.companion.orchestration.tool_result_utils import as_mapping_dict
from api.ewa_platform.companion.sidecar.intent_planner import companion_intent_planner_min_confidence
from api.ewa_platform.persistence_pg.episodes_asyncpg import episodes_recent_for_principal
from api.ewa_platform.persistence_vector.companion_qdrant import (
    CompanionEpisodicHit,
    search_companion_episodic,
)

logger = logging.getLogger(__name__)

_EWA_HCM_ENV_FLAG = "EWA_COMPANION_HCM_RETRIEVAL_ENABLED"


def hcm_retrieval_enabled() -> bool:
    """When ``0`` the composer short-circuits to legacy top-N (safe rollback)."""

    raw = os.getenv(_EWA_HCM_ENV_FLAG, "1").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _episodic_intent_prioritize_enabled() -> bool:
    raw = os.getenv("EWA_COMPANION_EPISODIC_INTENT_PRIORITIZE", "1").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _prioritize_episodic_hits_for_intent(
    hits: list[CompanionEpisodicHit],
    intent: str | None,
) -> list[CompanionEpisodicHit]:
    """Stable reorder: matching ``intent_hint`` first when enabled — legacy points without hint keep tail order."""

    if not hits or not intent or not str(intent).strip():
        return hits
    if not _episodic_intent_prioritize_enabled():
        return hits
    needle = str(intent).strip()
    with_hint: list[CompanionEpisodicHit] = []
    rest: list[CompanionEpisodicHit] = []
    for h in hits:
        if (h.intent_hint or "").strip() == needle:
            with_hint.append(h)
        else:
            rest.append(h)
    return with_hint + rest


def _episodic_session_topic_prioritize_enabled() -> bool:
    raw = os.getenv("EWA_COMPANION_EPISODIC_SESSION_TOPIC_PRIORITIZE", "1").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _prioritize_episodic_hits_for_session_topic(
    hits: list[CompanionEpisodicHit],
    topic: str | None,
) -> list[CompanionEpisodicHit]:
    if not hits or not topic or len(str(topic).strip()) < 4:
        return hits
    if not _episodic_session_topic_prioritize_enabled():
        return hits
    needle = str(topic).strip().lower()
    with_t: list[CompanionEpisodicHit] = []
    rest: list[CompanionEpisodicHit] = []
    for h in hits:
        st = (h.session_topic or "").strip().lower()
        if st and (needle in st or st in needle):
            with_t.append(h)
        else:
            rest.append(h)
    return with_t + rest


def _retrieval_router_enabled() -> bool:
    raw = os.getenv("EWA_COMPANION_RETRIEVAL_ROUTER_ENABLED", "1").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _retrieval_budget_ms() -> int:
    """Read from EWA platform settings (``os.getenv`` shim), not frozen ``unified_settings``."""

    raw = os.getenv("EWA_COMPANION_RETRIEVAL_BUDGET_MS", "4500").strip() or "4500"
    try:
        v = int(raw)
    except ValueError:
        v = 4500
    return max(50, min(v, 30000))


def _companion_episodic_rerank_enabled() -> bool:
    raw = os.getenv("EWA_COMPANION_EPISODIC_RERANK_ENABLED", "1").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _companion_episodic_rerank_max_docs() -> int:
    raw = os.getenv("EWA_COMPANION_EPISODIC_RERANK_MAX_DOCS", "8").strip() or "8"
    try:
        v = int(raw)
    except ValueError:
        v = 8
    return max(2, min(v, 24))


def _companion_episodic_rerank_max_chars_per_doc() -> int:
    raw = os.getenv("EWA_COMPANION_EPISODIC_RERANK_MAX_CHARS_PER_DOC", "512").strip() or "512"
    try:
        v = int(raw)
    except ValueError:
        v = 512
    return max(128, min(v, 4000))


def _companion_episodic_rerank_timeout_sec() -> float:
    """Upper bound for episodic rerank HTTP wait (llama-server /v1/rerank on GPU stack2)."""

    raw = os.getenv("EWA_COMPANION_EPISODIC_RERANK_TIMEOUT_SEC", "8").strip() or "8"
    try:
        v = float(raw)
    except ValueError:
        v = 8.0
    return max(0.5, min(v, 60.0))


async def _rerank_episodic_hits(
    query: str,
    hits: list[CompanionEpisodicHit],
    *,
    top_k: int,
    timeout_sec: float = 2.0,
) -> list[CompanionEpisodicHit]:
    """Optional cross-encoder rerank via ``RAG_RERANK_BASE_URL`` (llama-server /v1/rerank on LAN .141)."""

    if not _companion_episodic_rerank_enabled() or len(hits) < 2:
        return hits
    from api.services.rerank_client import (
        _truncate_for_rerank,
        rerank_by_index,
    )

    max_docs = _companion_episodic_rerank_max_docs()
    max_chars = _companion_episodic_rerank_max_chars_per_doc()
    pool = hits[: min(len(hits), max_docs)]
    docs = [_truncate_for_rerank((h.body or "").strip(), max_chars) for h in pool]
    if not any(docs):
        return hits
    ranked = await rerank_by_index(query, docs, timeout=timeout_sec)
    if ranked is None:
        return hits
    ordered: list[CompanionEpisodicHit] = []
    seen: set[int] = set()
    for idx, _score in sorted(ranked, key=lambda pair: pair[1], reverse=True):
        if 0 <= idx < len(pool) and idx not in seen:
            seen.add(idx)
            ordered.append(pool[idx])
    for i, hit in enumerate(pool):
        if i not in seen:
            ordered.append(hit)
    return ordered[: max(1, int(top_k))]


def _normalize_anchor_short_circuit_score(raw: str | float | int | None) -> float:
    """Map catalog/PG score to overlap-space threshold in ``[0, 0.95]``.

    Catalog stores **0–100** (e.g. ``85``). Keyword overlap is **[0, 1]**.
    Values in ``(0, 1]`` stay fractions; values ``>1`` are treated as percent (``/100``).
    """
    text = "0.45" if raw is None else str(raw).strip() or "0.45"
    try:
        v = float(text)
    except ValueError:
        v = 0.45
    if v > 1.0:
        v = v / 100.0
    return max(0.0, min(v, 0.95))


def _anchor_short_circuit_threshold() -> float:
    raw = os.getenv("EWA_COMPANION_ANCHOR_SHORT_CIRCUIT_SCORE", "0.45")
    return _normalize_anchor_short_circuit_score(raw)


def _atom_importance_floor() -> float:
    raw = os.getenv("EWA_ATOM_IMPORTANCE_FLOOR", "0.0").strip() or "0.0"
    try:
        v = float(raw)
    except ValueError:
        v = 0.0
    return max(0.0, min(v, 1.0))


def _atom_drop_stale_enabled() -> bool:
    raw = os.getenv("EWA_ATOM_RETRIEVAL_DROP_STALE", "1").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _atom_expired(atom: Any) -> bool:
    exp = getattr(atom, "expires_at", None)
    if exp is None:
        return False
    now = datetime.now(UTC)
    if getattr(exp, "tzinfo", None) is None:
        exp = exp.replace(tzinfo=UTC)
    try:
        return exp < now
    except TypeError:
        return False


def _atom_payload_snippet(atom: Any) -> str:
    pl = getattr(atom, "payload", "")
    if isinstance(pl, str):
        return pl.strip()
    try:
        return json.dumps(pl, ensure_ascii=False)
    except TypeError:
        return str(pl)


async def _atom_lines_for_prompt_layer(
    pool: asyncpg.Pool | None,
    *,
    principal_id: str,
    task_hint: str | None,
    existing_keys: set[str],
    limit: int,
) -> list[str]:
    try:
        from api.ewa_platform.atoms.classifier import atom_layer_enabled
    except ImportError:
        return []
    if pool is None or not principal_id or not atom_layer_enabled():
        return []
    try:
        from api.ewa_platform.persistence_pg.atoms_asyncpg import atoms_fetch_recent
    except ImportError:
        return []
    try:
        atoms = await atoms_fetch_recent(pool, principal_id=principal_id, limit=max(8, min(limit * 4, 96)))
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_atoms_fetch_failed principal=%s err=%s", principal_id, exc)
        return []
    lines: list[str] = []
    floor = _atom_importance_floor()
    th = (task_hint or "").strip().lower()
    drop_stale = _atom_drop_stale_enabled()
    for a in atoms:
        if _atom_expired(a) and drop_stale:
            continue
        try:
            imp = float(getattr(a, "importance", 0.5))
        except (TypeError, ValueError):  # fmt: skip
            imp = 0.5
        if imp < floor:
            continue
        atask = str(getattr(a, "task_id", "") or "").strip().lower()
        if th and atask and atask not in th and th not in atask:
            prio = int(getattr(a, "priority", 50) or 50)
            if prio < 70:
                continue
        body = sanitize_companion_episode_body_for_storage(_atom_payload_snippet(a)[:520])
        if not body:
            continue
        kind = str(getattr(a, "particle_kind", "atom") or "atom")
        key = _normalize_for_dedup(body)
        if not key or key in existing_keys:
            continue
        existing_keys.add(key)
        lines.append(f"- [atom/{kind}] {body}")
        if len(lines) >= limit:
            break
    return lines


@dataclass(slots=True)
class MemoryWindow:
    """Result of ``compose_memory_window`` — what the prompt builder pastes into the system message."""

    prompt_section: str
    used_layers: list[str] = field(default_factory=list)
    episodic_hits: int = 0
    fallback_used: bool = False
    layer_telemetry: dict[str, Any] = field(default_factory=dict)
    deep_short_circuited: bool = False


def _normalize_for_dedup(text: str) -> str:
    return " ".join(text.lower().split()).strip()


def _format_block(identity_lines: list[str], episodic_lines: list[str]) -> str:
    """Render the memory block in the same compact shape ``memory_prompt_section`` already produces.

    Applies a SHA-1 dedup on ``episodic_lines`` so the same "related episode" phrase is not repeated several
    times in the system prompt — observed regression in stack2 LLM dumps where «Привет как твои дела?» appeared
    five times consecutively.
    """

    from api.ewa_platform.companion.turn.system_budget import deduplicate_related_episodes  # noqa: PLC0415

    deduped_episodic = deduplicate_related_episodes(list(episodic_lines or []))
    lines: list[str] = []
    if identity_lines or deduped_episodic:
        lines.append("What you remember about us (compact, identity facts + related episodes):")
    for line in identity_lines:
        if line:
            lines.append(line)
    if identity_lines and deduped_episodic:
        lines.append("- — related episodes —")
    for line in deduped_episodic:
        if line:
            lines.append(line)
    if not lines:
        return ""
    return "\n".join(lines)


def _merge_prompt_sections(*sections: str) -> str:
    """Join non-empty fragments and apply the LLM memory-block char cap."""

    return merge_memory_prompt_layers_for_llm(*sections)


def _row_is_story(row: Mapping[str, Any]) -> bool:
    k = str(row.get("kind") or "").strip().lower()
    t = str(row.get("type") or "").strip().lower()
    return k == "story" or t == "story"


def _story_anchor_lines(profile: Mapping[str, Any]) -> tuple[str, set[str]]:
    """Pinned relational anchors (``kind=story``) plus dedup keys for lower layers."""

    mem = get_memory(profile)
    story_rows = [dict(r) for r in mem if isinstance(r, Mapping) and _row_is_story(r)]
    top = select_top_memories(story_rows, limit=32)
    lines: list[str] = []
    keys: set[str] = set()
    for row in top:
        body = str(row.get("content") or "").strip()
        if not body:
            continue
        key = _normalize_for_dedup(body)
        if not key or key in keys:
            continue
        keys.add(key)
        lines.append(f"- [story] {body}")
    if not lines:
        return "", keys
    return "### Story / Кто мы друг другу\n" + "\n".join(lines), keys


def _identity_lines_from_profile(profile: Mapping[str, Any]) -> tuple[list[str], set[str]]:
    """Top-N identity / preference rows — **excluding** story anchors (those use the pinned story heading)."""

    mem = get_memory(profile)
    non_story = [dict(r) for r in mem if isinstance(r, Mapping) and not _row_is_story(r)]
    top = select_top_memories(non_story)
    lines: list[str] = []
    dedup_keys: set[str] = set()
    for row in top:
        body = str(row.get("content") or "").strip()
        if not body:
            continue
        kind = str(row.get("kind") or row.get("type") or "fact").strip()
        key = _normalize_for_dedup(body)
        if not key or key in dedup_keys:
            continue
        dedup_keys.add(key)
        lines.append(f"- [{kind}] {body}")
    return lines, dedup_keys


def _episodic_lines_from_hits(
    hits: list[CompanionEpisodicHit],
    *,
    existing_keys: set[str],
    limit: int,
) -> list[str]:
    lines: list[str] = []
    for hit in hits:
        if len(lines) >= limit:
            break
        body = sanitize_companion_episode_body_for_storage((hit.body or "").strip())
        if not body:
            continue
        key = _normalize_for_dedup(body)
        if not key or key in existing_keys:
            continue
        existing_keys.add(key)
        tag = f"episode/{hit.kind}" if hit.kind else "episode"
        lines.append(f"- [{tag}] {body}")
    return lines


async def _embed_query(text: str) -> tuple[list[float], int | None]:
    """Embed the query line; returns ``([], None)`` on any error. Throttled via stack2 semaphore."""

    try:
        from api.services.chat_memory_service import EMBEDDING_DIMENSION, _get_embedding
    except ImportError:
        return ([], None)
    from api.ewa_platform.companion.sidecar.stack2_semaphore import embed_slot  # noqa: PLC0415

    try:
        async with embed_slot(reason="hcm_query"):
            vec = await _get_embedding(text)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_episodic_query_embed_failed err=%s", exc)
        return ([], None)
    if not isinstance(vec, list) or not vec:
        return ([], None)
    return (list(vec), int(EMBEDDING_DIMENSION))


async def _qdrant_client() -> Any | None:
    try:
        from api.services.chat_memory_service import _get_qdrant_client_companion_episodic
    except ImportError:
        return None
    try:
        return await _get_qdrant_client_companion_episodic()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_episodic_qdrant_client_failed err=%s", exc)
        return None


async def compose_memory_window(
    *,
    profile: Mapping[str, Any],
    principal_id: str,
    current_user_text: str,
    persona: str,
    pool: asyncpg.Pool | None = None,
    episodic_top_k: int = 8,
    intent_plan: Any | None = None,
) -> MemoryWindow:
    """Build a single memory block for the system prompt.

    Layered strategy:
      0. Story anchors (pinned heading) when ``kind=story`` rows exist (up to 32 lines).
      1. Identity top-N (**excluding** story rows already rendered above); scoring cap ``MAX_PROMPT_MEMORIES`` (default 128).
      2. If retrieval enabled and budget allows → embed+Qdrant vector recall (``episodic_top_k`` default **8**, inject-path hard cap **12**).
      3. Postgres recency fallback when vector returns empty.
      4. Compose with LLM char cap via ``memory_llm_inject_max_chars()`` (default **8000** unless env overrides).

    When ``intent_plan`` is set and confidence ≥ ``companion_intent_planner_min_confidence``, episodic vector hits
    (and Postgres fallback rows) are optionally reordered so ``intent_hint`` / ``session_topic`` matches surface first
    (see ``EWA_COMPANION_EPISODIC_INTENT_PRIORITIZE`` / ``EWA_COMPANION_EPISODIC_SESSION_TOPIC_PRIORITIZE``).
    """

    # Phase 3 inject-path hard cap: never pull more than 12 episodic lines into the LLM window.
    episodic_top_k = max(1, min(int(episodic_top_k), 12))

    mem_all = get_memory(profile)
    legacy_section = memory_prompt_section(mem_all)
    if not hcm_retrieval_enabled():
        story_sec_early, _story_k = _story_anchor_lines(profile)
        early = _merge_prompt_sections(story_sec_early, legacy_section) if story_sec_early.strip() else legacy_section
        layers_early = ["identity_legacy_story"] if story_sec_early.strip() else ["identity_legacy"]
        return MemoryWindow(
            prompt_section=early, used_layers=layers_early, layer_telemetry={"path": "legacy_hcm_disabled"}
        )

    try:
        story_section, story_dedupe = _story_anchor_lines(profile)
        identity_lines, dedup_keys = _identity_lines_from_profile(profile)
        dedup_keys |= story_dedupe

        used: list[str] = []
        if story_section.strip():
            used.append("story_anchor")
        if identity_lines:
            used.append("identity")

        episodic_lines: list[str] = []
        hits: list[CompanionEpisodicHit] = []
        query = (current_user_text or "").strip()
        budget_ms = _retrieval_budget_ms()

        intent_f: str | None = None
        topic_f: str | None = None
        if intent_plan is not None:
            try:
                conf = float(getattr(intent_plan, "confidence", 0.0) or 0.0)
            except (TypeError, ValueError):  # fmt: skip
                conf = 0.0
            if conf >= companion_intent_planner_min_confidence():
                it = str(getattr(intent_plan, "intent", "") or "").strip()
                if it and it != "chat_only":
                    intent_f = it
                su_en = str(getattr(intent_plan, "understood_summary_en", "") or "").strip()
                su_ru = str(getattr(intent_plan, "understood_summary_ru", "") or "").strip()
                pick = su_en or su_ru
                if len(pick) >= 4:
                    topic_f = pick[:256]

        layer_telemetry: dict[str, Any] = {"retrieval_router": _retrieval_router_enabled()}
        anchor_blob = anchor_dict_from_profile(profile)
        anchor_model = normalize_context_anchor_v1(dict(anchor_blob)) if anchor_blob else None
        anchor_overlap = anchor_keyword_overlap_score(query, anchor_model)
        layer_telemetry["anchor_overlap_score"] = round(float(anchor_overlap), 4)
        skip_deep = bool(
            _retrieval_router_enabled()
            and anchor_model is not None
            and bool(query)
            and anchor_overlap >= _anchor_short_circuit_threshold(),
        )
        layer_telemetry["deep_short_circuit"] = skip_deep

        task_tag = (intent_f or topic_f or "")[:256] or None
        atom_lines = await _atom_lines_for_prompt_layer(
            pool,
            principal_id=principal_id,
            task_hint=task_tag,
            existing_keys=dedup_keys,
            limit=max(2, min(int(episodic_top_k), 12)),
        )
        if atom_lines:
            used.append("atoms_mid")
        layer_telemetry["atom_lines"] = len(atom_lines)
        related_lines: list[str] = list(atom_lines)

        recent_tasks_section = ""
        if pool is not None and principal_id:
            try:
                from api.ewa_platform.companion.episodic.task_outcome import TASK_OUTCOME_KIND

                task_rows = await episodes_recent_for_principal(
                    pool,
                    principal_id=principal_id,
                    limit=5,
                    kinds=[TASK_OUTCOME_KIND],
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("[STEP] companion_task_outcome_recent_failed err=%s", exc)
                task_rows = []
            task_lines: list[str] = []
            for row in task_rows:
                body = str(row.get("body") or "").strip()
                if not body:
                    continue
                key = _normalize_for_dedup(body)
                if not key or key in dedup_keys:
                    continue
                dedup_keys.add(key)
                # One compact bullet; keep first line of multi-line body.
                first = body.split("\n", 1)[0].strip()
                task_lines.append(f"- [task] {first[:400]}")
            if task_lines:
                used.append("task_outcome_recent")
                recent_tasks_section = "### Recent tasks / Недавние задачи\n" + "\n".join(task_lines)
            layer_telemetry["task_outcome_recent"] = len(task_lines)

        vec_started = time.monotonic()
        if query and principal_id and not skip_deep:

            async def _vector_pull() -> list[CompanionEpisodicHit]:
                vec, dim = await _embed_query(query)
                if not vec or dim is None:
                    return []
                client = await _qdrant_client()
                if client is None:
                    return []
                return await search_companion_episodic(
                    client,
                    dim=dim,
                    principal_id=principal_id,
                    query_vector=vec,
                    top_k=max(1, min(int(episodic_top_k), 12)),
                )

            try:
                hits = await asyncio.wait_for(
                    _vector_pull(),
                    timeout=max(0.05, budget_ms / 1000.0),
                )
            except TimeoutError:
                logger.info(
                    "[STEP] retrieval_latency_budget_exceeded principal=%s budget_ms=%s",
                    principal_id,
                    budget_ms,
                )
                hits = []
        else:
            hits = []

        vec_ms = (time.monotonic() - vec_started) * 1000.0
        layer_telemetry["embed_qdrant_ms"] = round(vec_ms, 2)
        layer_telemetry["episodic_rerank"] = _companion_episodic_rerank_enabled()
        logger.info(
            "[STEP] retrieval_latency_ms principal=%s embed_qdrant_ms=%.1f vector_hits=%s budget_ms=%s short_circuit=%s",
            principal_id,
            vec_ms,
            len(hits),
            budget_ms,
            skip_deep,
        )

        if hits and not skip_deep:
            hits = _prioritize_episodic_hits_for_intent(hits, intent_f)
            hits = _prioritize_episodic_hits_for_session_topic(hits, topic_f)
            remaining_sec = max(0.05, (budget_ms - vec_ms) / 1000.0)
            hits = await _rerank_episodic_hits(
                query,
                hits,
                top_k=max(1, int(episodic_top_k)),
                timeout_sec=min(remaining_sec, _companion_episodic_rerank_timeout_sec()),
            )
            persona_style = get_persona_style(persona)
            ranked_hits = rank_episodic_hits(
                hits,
                persona_style=persona_style,
                top_k=max(1, int(episodic_top_k)),
            )
            episodic_lines = _episodic_lines_from_hits(
                ranked_hits,
                existing_keys=dedup_keys,
                limit=max(1, int(episodic_top_k)),
            )
            if episodic_lines:
                used.append("episodic_vector")

        related_lines.extend(episodic_lines)

        fallback_used = False
        if (not episodic_lines) and (not skip_deep) and pool is not None and principal_id:
            try:
                recent = await episodes_recent_for_principal(
                    pool,
                    principal_id=principal_id,
                    limit=max(1, int(episodic_top_k)),
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("[STEP] companion_episodic_recent_failed err=%s", exc)
                recent = []
            if recent:
                shaped = []
                for r in recent:
                    ex = as_mapping_dict(r.get("extra"))
                    exd = dict(ex)
                    shaped.append(
                        CompanionEpisodicHit(
                            episode_id=str(r.get("id") or ""),
                            body=str(r.get("body") or ""),
                            kind=str(r.get("kind") or "turn_user"),
                            source=str(r.get("source") or "chat_turn"),
                            persona=str(r.get("persona") or "parent"),
                            importance=float(r.get("importance") or 0.5),
                            valence=float(r.get("valence") or 0.5),
                            score=0.0,
                            created_at_iso=str(r.get("created_at") or ""),
                            turn_id=str(r.get("turn_id")) if r.get("turn_id") else None,
                            extra=exd,
                            intent_hint=str(exd.get("intent_hint") or "").strip()[:128],
                            session_topic=str(exd.get("session_topic") or "").strip()[:256],
                            correlation_id=str(exd.get("correlation_id") or "").strip()[:128],
                        ),
                    )
                shaped_hits = _prioritize_episodic_hits_for_intent(
                    _prioritize_episodic_hits_for_session_topic(shaped, topic_f),
                    intent_f,
                )
                fb_lines = _episodic_lines_from_hits(
                    shaped_hits,
                    existing_keys=dedup_keys,
                    limit=max(1, int(episodic_top_k)),
                )
                if fb_lines:
                    used.append("episodic_recency_fallback")
                    fallback_used = True
                    related_lines.extend(fb_lines)

        layer_telemetry["related_chars_est"] = sum(len(x) for x in related_lines)
        ep_only_hits = len([ln for ln in related_lines if "[episode/" in ln or ln.startswith("- [episode")])
        ident_ep_block = _format_block(identity_lines, related_lines)
        merged = _merge_prompt_sections(story_section, recent_tasks_section, ident_ep_block)
        if not merged.strip():
            return MemoryWindow(
                prompt_section=legacy_section,
                used_layers=["identity_legacy"],
                episodic_hits=0,
                fallback_used=False,
                layer_telemetry=layer_telemetry,
            )
        return MemoryWindow(
            prompt_section=merged,
            used_layers=used,
            episodic_hits=ep_only_hits,
            fallback_used=fallback_used,
            layer_telemetry=layer_telemetry,
            deep_short_circuited=skip_deep,
        )
    except Exception as exc:  # noqa: BLE001 — any composer crash must NOT break chat.
        logger.warning("[STEP] companion_memory_compose_window_failed err=%s", exc)
        return MemoryWindow(
            prompt_section=legacy_section,
            used_layers=["identity_legacy"],
            episodic_hits=0,
            fallback_used=True,
            layer_telemetry={"error": str(exc)[:200]},
        )


__all__ = [
    "MemoryWindow",
    "compose_memory_window",
    "hcm_retrieval_enabled",
]
