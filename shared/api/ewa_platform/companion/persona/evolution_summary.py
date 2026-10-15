# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Real **LLM-driven companion evolution**: read the recent transcript, ask the local HTTP LLM to suggest a
# bounded character/mood/memory drift, sanitize and persist via ``companion_profile_patch``. Replaces the previous
# placeholder where ``ewa_companion_evolution_tick`` only merged scalar ``learned_preferences`` deltas from the caller.
# Invariants:
# - Trait drift per tick is clamped to ``MAX_TRAIT_DRIFT_PER_PATCH`` (see ``character.apply_drift_patch``).
# - LLM output is parsed defensively (fences, loose key colons, ``extract_llm_json_payload``); failures → no-op audit.
# - Adds a single ``growth_log`` entry per accepted summary so per-user evolution stays auditable in the profile.
# - Never logs raw transcript content; structured fields use counts and short hashes only.
# Related:
# - api/ewa_platform/companion/persona/character.py
# - api/ewa_platform/companion/persona/evolution_chat_trigger.py
# - api/ewa_platform/companion/memory/hcm_store.py
# - api/ewa_platform/companion/persona/evolution_tick.py
# - api/ewa_platform/companion/turn/chat_turn.py (transcript subtree shared via ``desktop_friend_chat_v1``)
# **Canonical path:** ``api.ewa_platform.companion.persona.evolution_summary``; shim ``companion.evolution_summary``.
# ---
"""LLM-driven companion evolution summary tick."""

from __future__ import annotations

import json
import logging
import os
import re
from collections.abc import Mapping, Sequence
from typing import Any

import asyncpg
import httpx

from api.core.unified_config import unified_settings
from api.ewa_platform.companion.memory import (
    MAX_CONTENT_CHARS,
    MEMORY_NS,
    get_memory,
    merge_memory_entries,
)
from api.ewa_platform.companion.persona.character import (
    CHARACTER_NS,
    apply_drift_patch,
    get_character,
)
from api.ewa_platform.companion.persona.evolution_chat_trigger import (
    EVOLUTION_CHAT_NS,
    get_evolution_chat_state,
)
from api.ewa_platform.persistence_pg.companion_asyncpg import (
    companion_audit_only,
    companion_profile_fetch,
    companion_profile_patch,
)
from api.utils.llm_json_extract import extract_llm_json_payload
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)

CHAT_NS_FOR_SUMMARY: str = "desktop_friend_chat_v1"

MAX_TRANSCRIPT_TURNS_FOR_SUMMARY: int = 30
MAX_GROWTH_SUMMARY_CHARS: int = 240
MAX_NEW_BELIEFS_PER_TICK: int = 2
MAX_NEW_PRIDE_PER_TICK: int = 2
MAX_NEW_MEMORIES_PER_TICK: int = 3

_DEFAULT_MODEL_FALLBACK = "mistral"


def _env_truthy(raw: str | None) -> bool:
    if raw is None:
        return False
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def _resolved_runtime() -> tuple[str, str, int, float]:
    """Pick base URL / model / num_predict / timeout for the summary call."""

    base = unified_settings.llama_url.strip().rstrip("/")
    model = (
        os.getenv("EWA_COMPANION_EVOLUTION_MODEL", "").strip()
        or os.getenv("EWA_COMPANION_CHAT_MODEL", "").strip()
        or os.getenv("EWA_ORCH_LLM_MODEL", "").strip()
        or unified_settings.default_ai_model
        or _DEFAULT_MODEL_FALLBACK
    ).strip()
    try:
        num_predict = int(os.getenv("EWA_COMPANION_EVOLUTION_NUM_PREDICT", "1024").strip() or "1024")
    except ValueError:
        num_predict = 1024
    num_predict = max(256, min(num_predict, 4096))
    try:
        timeout_sec = float(os.getenv("EWA_COMPANION_EVOLUTION_TIMEOUT_SEC", "120").strip() or "120")
    except ValueError:
        timeout_sec = 120.0
    timeout_sec = max(20.0, min(timeout_sec, 600.0))
    return base, model, num_predict, timeout_sec


def _read_transcript_tail(profile: Mapping[str, Any], limit_turns: int) -> list[dict[str, str]]:
    """Pull the last ``limit_turns`` user/assistant turns from the chat namespace, role+content only."""

    lp = profile.get("learned_preferences")
    if not isinstance(lp, Mapping):
        return []
    chat = lp.get(CHAT_NS_FOR_SUMMARY)
    if not isinstance(chat, Mapping):
        return []
    msgs_raw = chat.get("messages")
    if not isinstance(msgs_raw, list):
        return []
    out: list[dict[str, str]] = []
    for item in msgs_raw[-(limit_turns * 2) :]:
        if not isinstance(item, Mapping):
            continue
        role = item.get("role")
        content = item.get("content")
        if role not in ("user", "assistant") or not isinstance(content, str):
            continue
        out.append({"role": role, "content": content[:2000]})
    return out[-(limit_turns * 2) :]


def _format_transcript_for_prompt(turns: Sequence[Mapping[str, str]]) -> str:
    if not turns:
        return "(no transcript yet)"
    lines: list[str] = []
    for t in turns:
        role = t.get("role", "user")
        speaker = "User" if role == "user" else "Companion"
        content = (t.get("content") or "").strip()
        if not content:
            continue
        lines.append(f"{speaker}: {content}")
    return "\n".join(lines)[:6000] or "(no transcript yet)"


def _summary_system_prompt() -> str:
    from api.ewa_platform.companion.prompt_blocks.service import get_prompt_block

    return get_prompt_block("workflow.evolution_summary")


def _build_user_prompt(
    *,
    transcript_text: str,
    character_block: Mapping[str, Any],
    memory_block: Sequence[Mapping[str, Any]],
    seed_persona_id: str,
) -> str:
    char_json = json.dumps(dict(character_block), ensure_ascii=False)[:1500]
    mem_json = json.dumps(list(memory_block), ensure_ascii=False)[:1500]
    return (
        f"seed_persona_id: {seed_persona_id}\n\n"
        f"Current character block (JSON, truncated):\n{char_json}\n\n"
        f"Current memories (JSON, truncated):\n{mem_json}\n\n"
        f"Recent transcript (most recent last, truncated):\n{transcript_text}\n\n"
        "Now emit your strict JSON object."
    )


def _coerce_string_list(raw: Any, *, limit: int) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        text = item.strip()
        if not text:
            continue
        out.append(text[:MAX_CONTENT_CHARS])
        if len(out) >= limit:
            break
    return out


def _coerce_memory_list(raw: Any, *, limit: int) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    rows: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, Mapping):
            continue
        content = str(item.get("content", "")).strip()
        if not content:
            continue
        rows.append(
            {
                "type": str(item.get("type", "fact")).strip().lower() or "fact",
                "content": content[:MAX_CONTENT_CHARS],
                "importance": item.get("importance", 0.5),
            }
        )
        if len(rows) >= limit:
            break
    return rows


def _coerce_trait_targets(raw: Any) -> dict[str, float]:
    if not isinstance(raw, Mapping):
        return {}
    out: dict[str, float] = {}
    for key in ("warmth", "directness", "curiosity", "patience"):
        if key in raw:
            try:
                out[key] = float(raw[key])
            except (TypeError, ValueError):  # fmt: skip
                continue
    return out


def _coerce_mood(raw: Any) -> dict[str, float]:
    if not isinstance(raw, Mapping):
        return {}
    out: dict[str, float] = {}
    for key in ("valence", "energy", "tension", "confidence"):
        if key in raw:
            try:
                out[key] = float(raw[key])
            except (TypeError, ValueError):  # fmt: skip
                continue
    return out


def _repair_malformed_json_key_colons(raw: str) -> str:
    """Fix common LLM typo: ``"confidence: 0.8`` → ``"confidence": 0.8``."""

    return re.sub(r'"([A-Za-z_][A-Za-z0-9_]*):\s*', r'"\1": ', raw or "")


def _parse_summary_json(reply: str) -> dict[str, Any] | None:
    """Defensive JSON extraction: fences, CoT prefixes, loose key colons, balanced ``{...}``."""

    if not reply:
        return None

    candidates: list[str] = []
    seen: set[str] = set()
    for variant in (reply, _repair_malformed_json_key_colons(reply)):
        text = variant.strip()
        if text and text not in seen:
            candidates.append(text)
            seen.add(text)

    for candidate in candidates:
        try:
            parsed = extract_llm_json_payload(candidate)
        except ValueError:
            parsed = None
        if isinstance(parsed, Mapping):
            return dict(parsed)

    # Legacy fallback: first balanced ``{...}`` substring without fence helper.
    start = reply.find("{")
    if start == -1:
        return None
    depth = 0
    for idx in range(start, len(reply)):
        ch = reply[idx]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                snippet = _repair_malformed_json_key_colons(reply[start : idx + 1])
                try:
                    parsed = json.loads(snippet)
                except json.JSONDecodeError:
                    return None
                if isinstance(parsed, Mapping):
                    return dict(parsed)
                return None
    return None


async def _request_summary(
    *,
    transcript_text: str,
    character_block: Mapping[str, Any],
    memory_block: Sequence[Mapping[str, Any]],
    seed_persona_id: str,
) -> dict[str, Any] | None:
    base, model, num_predict, timeout_sec = _resolved_runtime()
    timeout = httpx.Timeout(timeout_sec)
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": _summary_system_prompt()},
        {
            "role": "user",
            "content": _build_user_prompt(
                transcript_text=transcript_text,
                character_block=character_block,
                memory_block=memory_block,
                seed_persona_id=seed_persona_id,
            ),
        },
    ]
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            out = await httpx_compat_chat_completion_json(
                client,
                base,
                model=model,
                messages=messages,
                options={
                    "temperature": 0.25,
                    "num_predict": num_predict,
                    "openai_sidecar_merge_reasoning": True,
                },
                response_format={"type": "json_object"},
                chat_template_kwargs={"enable_thinking": False},
                extra_params={"reasoning_format": "none"},
                timeout=timeout,
            )
    except (TimeoutError, httpx.HTTPError, OSError, ValueError, TypeError) as exc:
        logger.warning("companion_evolution_summary_http_failure err=%s", exc)
        return None

    reply = str(out.get("response", "") or "").strip()
    return _parse_summary_json(reply)


async def companion_evolution_llm_summary_execute(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    tick_reason: str = "llm_summary",
) -> dict[str, Any]:
    """Run a real LLM evolution summary for the principal and persist a bounded drift.

    Returns ``{"applied": bool, "skipped": bool, "reason": str, "companion_revision": int|None, ...}``. Never raises
    on LLM / parsing failures: those degrade to a no-op audit row.
    """

    pid = principal_id.strip()
    if not pid:
        return {"applied": False, "skipped": True, "reason": "empty_principal_id"}

    if not _env_truthy(os.getenv("EWA_COMPANION_EVOLUTION_USE_LLM", "1")):
        return {"applied": False, "skipped": True, "reason": "llm_summary_disabled"}

    profile = await companion_profile_fetch(pool, principal_id=pid)
    if profile is None:
        return {"applied": False, "skipped": True, "reason": "no_companion_profile"}

    transcript = _read_transcript_tail(profile, MAX_TRANSCRIPT_TURNS_FOR_SUMMARY)
    if len(transcript) < 4:
        # Need at least a couple of turns either way to summarize honestly; otherwise just heartbeat audit.
        await companion_audit_only(
            pool,
            principal_id=pid,
            action="evolution_tick_llm_summary",
            detail={"applied": False, "reason": "transcript_too_short", "turns": len(transcript)},
        )
        return {
            "applied": False,
            "skipped": False,
            "reason": "transcript_too_short",
            "turns": len(transcript),
            "audited": True,
        }

    transcript_text = _format_transcript_for_prompt(transcript)
    character_block = get_character(profile)
    memory_block = get_memory(profile)
    seed_persona_id = str(profile.get("seed_persona_id") or "parent").strip().lower()

    summary = await _request_summary(
        transcript_text=transcript_text,
        character_block=character_block,
        memory_block=memory_block,
        seed_persona_id=seed_persona_id,
    )

    if summary is None:
        await companion_audit_only(
            pool,
            principal_id=pid,
            action="evolution_tick_llm_summary",
            detail={"applied": False, "reason": "llm_no_valid_json"},
        )
        return {
            "applied": False,
            "skipped": False,
            "reason": "llm_no_valid_json",
            "audited": True,
        }

    trait_targets = _coerce_trait_targets(summary.get("trait_targets"))
    mood = _coerce_mood(summary.get("mood"))
    new_beliefs = _coerce_string_list(summary.get("new_beliefs"), limit=MAX_NEW_BELIEFS_PER_TICK)
    new_pride = _coerce_string_list(summary.get("new_pride"), limit=MAX_NEW_PRIDE_PER_TICK)
    new_memories = _coerce_memory_list(summary.get("new_memories"), limit=MAX_NEW_MEMORIES_PER_TICK)
    growth_summary = str(summary.get("growth_summary") or "").strip()[:MAX_GROWTH_SUMMARY_CHARS]

    nothing_changed = (
        not trait_targets and not mood and not new_beliefs and not new_pride and not new_memories and not growth_summary
    )
    if nothing_changed:
        await companion_audit_only(
            pool,
            principal_id=pid,
            action="evolution_tick_llm_summary",
            detail={"applied": False, "reason": "no_drift_suggested"},
        )
        return {
            "applied": False,
            "skipped": False,
            "reason": "no_drift_suggested",
            "audited": True,
        }

    revision = int(profile.get("companion_revision") or 0)
    next_character = apply_drift_patch(
        character_block,
        trait_targets=trait_targets or None,
        mood=mood or None,
        add_beliefs=new_beliefs,
        add_pride=new_pride,
        growth_event=tick_reason or "llm_summary",
        growth_summary=growth_summary or None,
        revision_for_belief=revision,
    )
    next_memory, memories_added = merge_memory_entries(memory_block, new_memories)

    lp_raw = profile.get("learned_preferences")
    lp_next: dict[str, Any] = dict(lp_raw) if isinstance(lp_raw, Mapping) else {}
    lp_next[CHARACTER_NS] = next_character
    if memories_added > 0 or new_memories:
        lp_next[MEMORY_NS] = next_memory
    evo_st = get_evolution_chat_state(lp_next)
    try:
        evo_epoch = int(evo_st.get("epoch") or 0)
    except (TypeError, ValueError):  # fmt: skip
        evo_epoch = 0
    if evo_epoch > 0:
        evo_st["last_completed_epoch"] = evo_epoch
        lp_next[EVOLUTION_CHAT_NS] = evo_st

    detail = {
        "applied": True,
        "tick_reason": tick_reason or "llm_summary",
        "memories_added": memories_added,
        "beliefs_added": len(new_beliefs),
        "pride_added": len(new_pride),
        "trait_targets": trait_targets,
        "mood": mood,
        "growth_summary": growth_summary,
    }

    patched = await companion_profile_patch(
        pool,
        principal_id=pid,
        learned_preferences=lp_next,
        expect_revision=revision,
        audit_action="evolution_tick_llm_summary",
        audit_detail_override=detail,
    )
    if patched is None:
        # Conflict against a concurrent chat turn — skip gracefully; the next tick re-reads the latest state.
        await companion_audit_only(
            pool,
            principal_id=pid,
            action="evolution_tick_llm_summary",
            detail={"applied": False, "reason": "merge_conflict"},
        )
        return {
            "applied": False,
            "skipped": False,
            "reason": "merge_conflict",
            "audited": True,
        }

    return {
        "applied": True,
        "skipped": False,
        "reason": "ok",
        "companion_revision": int(patched["companion_revision"]),
        "memories_added": memories_added,
        "beliefs_added": len(new_beliefs),
        "pride_added": len(new_pride),
    }


__all__ = (
    "companion_evolution_llm_summary_execute",
    "MAX_TRANSCRIPT_TURNS_FOR_SUMMARY",
    "MAX_NEW_BELIEFS_PER_TICK",
    "MAX_NEW_PRIDE_PER_TICK",
    "MAX_NEW_MEMORIES_PER_TICK",
)
