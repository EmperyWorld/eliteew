# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `ewa_platform/companion/memory/hcm_store.py`; preserves its existing EliteEW API/service responsibilities.
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
# Helpers for the **`companion_memory_v1`** sub-namespace inside ``learned_preferences``: durable facts the
# companion has learned about the user. Includes a tolerant ``<<MEMORY>>{…}<<END>>`` tail parser (and malformed ``<>[…]<``)
# self-mark memories without polluting the user-visible transcript, deterministic capture of short explicit user lines
# (e.g. «запомни …», introductions), plus a top-N selector that goes into every turn's system prompt. **Hostile Arlika v1**
# uses a separate emit instruction and skips explicit user remember lines in ``chat_turn``; **``arlika_v2``** follows the normal instruction.
# **Canonical path:** ``api.ewa_platform.companion.memory.hcm_store``; package ``api.ewa_platform.companion.memory`` re-exports this module.
# Invariants:
# - Pure helpers — no asyncio / DB I/O. Persistence belongs to ``companion_asyncpg.companion_profile_patch``.
# - Parser MUST NEVER raise on bad LLM output: malformed tails are dropped silently with a single WARN log.
# - Memory entries are deduplicated by trimmed content hash so duplicates cannot accumulate.
# - **Storage / compose** upper bound: ``MEMORY_PROMPT_BUDGET_CHARS`` (256k-class). **LLM injection** is further capped by
#   ``memory_llm_inject_max_chars()`` (env ``EWA_COMPANION_MEMORY_LLM_INJECT_MAX_CHARS``) so stack2 llama-server KV checkpoints
#   stay within typical VRAM; default **28k** chars pairs with ``chat_turn`` LLM history slice + ``num_ctx`` defaults.
#   ``clamp_companion_memory_prompt_block`` applies after catalogue discuss merge in ``chat_turn``.
# - Rows carrying idle-revert amnesia (source ``arlika_idle_amnesia`` or SPA sentinel content) expand to bracketed LLM
#   guidance in ``memory_prompt_section`` so the model never treats ``__ewa_idle_amnesia__`` as a user-visible memory line.
# - ``COMPANION_MEMORY_DISPLAY_MAX_LINES`` caps the server-built «Помнит о вас» strip; SPA should use the same number.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py (calls ``parse_memory_tail`` + ``memory_prompt_section``)
# - api/ewa_platform/companion/memory/retrieval.py (HCM composer)
# - api/ewa_platform/companion/context/noise.py (idle token collapse in prompt block)
# ---
"""EWA companion durable memory: parse, store, retrieve top-N for the prompt."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any

from api.ewa_platform.companion.context.noise import collapse_idle_observation_tokens
from api.ewa_platform.companion.ux.control_tails import (
    iter_malformed_control_tail_bodies,
    strip_malformed_control_tails,
)

logger = logging.getLogger(__name__)

MEMORY_NS: str = "companion_memory_v1"

# Visible strip placeholder for idle-revert amnesia; SPA maps to i18n (see ``companionLearnedUi``).
COMPANION_MEMORY_IDLE_AMNESIA_DISPLAY_SENTINEL: str = "__ewa_idle_amnesia__"

ALLOWED_TYPES: tuple[str, ...] = ("fact", "preference", "story")
ALLOWED_KINDS: tuple[str, ...] = (
    "identity",
    "preference",
    "task_preference",
    "catalog_preference",
    "relationship",
    "story",
    "correction",
    "fact",
)
ALLOWED_SOURCES: tuple[str, ...] = (
    "user_explicit",
    "system_inferred",
    "catalog_preferences",
    "evolution_summary",
    "llm",
    "arlika_idle_amnesia",
    "arlika_v2_dual_mode",
    "character_turn",
)
DEFAULT_TYPE: str = "fact"

MAX_CONTENT_CHARS: int = 4096
MAX_STORED_MEMORIES: int = 5000
MAX_PROMPT_MEMORIES: int = 128

# Server + SPA «Помнит о вас» strip: max lines in ``companion_memory_display_lines`` / ``EwaCompanionChatPanel`` (keep in sync).
COMPANION_MEMORY_DISPLAY_MAX_LINES: int = 32

MEMORY_PROMPT_BUDGET_CHARS: int = 262_144
# Default LLM-facing cap for the memory **block** (chars). Phase 3 redesign: lean inject under
# interactive ``n_ctx_slot`` (~40k); **8k** default (was 28k). Raise via env on large GPUs only.
_MEMORY_LLM_INJECT_DEFAULT: int = 8_000

RECENCY_HALFLIFE_DAYS: float = 14.0


def memory_llm_inject_max_chars() -> int:
    """Max characters for the memory section actually pasted into the chat LLM (HCM + discuss merge).

    Bounded by ``MEMORY_PROMPT_BUDGET_CHARS``; lower floor **256** chars so env stays meaningful in tests and tiny caps.
    Env: ``EWA_COMPANION_MEMORY_LLM_INJECT_MAX_CHARS`` (decimal int).
    """

    raw = os.getenv("EWA_COMPANION_MEMORY_LLM_INJECT_MAX_CHARS", str(_MEMORY_LLM_INJECT_DEFAULT)).strip()
    try:
        v = int(raw or str(_MEMORY_LLM_INJECT_DEFAULT))
    except ValueError:
        v = _MEMORY_LLM_INJECT_DEFAULT
    return max(256, min(v, MEMORY_PROMPT_BUDGET_CHARS))


def merge_memory_prompt_layers_for_llm(*sections: str) -> str:
    """Join non-empty HCM memory fragments and trim to ``memory_llm_inject_max_chars()``."""

    merged = "\n\n".join(s.strip() for s in sections if (s or "").strip())
    cap = memory_llm_inject_max_chars()
    if len(merged) > cap:
        return merged[: cap - 1] + "…"
    return merged


def clamp_companion_memory_prompt_block(text: str | None) -> str | None:
    """Clamp composed memory / catalogue-discuss material before ``_build_system_prompt``."""

    if text is None:
        return None
    t = str(text).strip()
    if not t:
        return ""
    cap = memory_llm_inject_max_chars()
    if len(t) <= cap:
        return t
    logger.info("[STEP] companion_memory_prompt_clamped chars=%s cap=%s", len(t), cap)
    return t[: cap - 1] + "…"


_MEMORY_TAIL_RE = re.compile(r"<<MEMORY>>(?P<body>.+?)<<END>>", re.DOTALL | re.IGNORECASE)

_REMEMBER_LINE_RU = re.compile(r"(?is)^\s*запомни(?:\s+пожалуйста)?[,:]?\s*(?:что\s+)?(.{2,400})\s*$")
_REMEMBER_LINE_EN = re.compile(r"(?is)^\s*remember(?:\s+that)?[,:]?\s*(.{2,400})\s*$")
_NOTE_THAT_EN = re.compile(r"(?is)^\s*note\s+to\s+self[,:]?\s*(.{2,400})\s*$")
_NAME_RU = re.compile(r"(?is)(?:меня\s+зовут|моё\s+имя|моя\s+кличка)\s*[,:]?\s*(.{2,120}?)(?:\s*[.!,?]|$)")
_NAME_EN = re.compile(r"(?is)\bmy\s+name\s+is\s+(.{2,120}?)(?:\s*[.!,?]|$)")
_CALLME_RU = re.compile(r"(?is)(?:называй\s+меня|обращайся\s+ко\s+мне)\s*[,:]?\s*(.{2,120}?)(?:\s*[.!,?]|$)")

_USER_INTRO_RE = re.compile(
    r"(?i)(?:"
    r"меня\s+зовут|"
    r"я\s+[-—]?\s*[a-zа-яё0-9_@&]+|"
    r"my\s+name\s+is|"
    r"call\s+me|"
    r"this\s+is\s+(?:me\s+)?"
    r")",
)
_ASSISTANT_NAME_QUESTION_RE = re.compile(
    r"(?i)(?:"
    r"(?:тебя|вас|твоё\s+имя)\s+(?:как\s+)?(?:зовут|величать|называ(?:ть|ешь)?)|"
    r"как\s+(?:тебя|вас|твоё\s+имя)|"
    r"what(?:'s|\s+is)\s+your\s+name"
    r")",
)
_LLM_INTRO_CLAIM_RE = re.compile(
    r"(?i)(?:"
    r"пользователь\s+(?:представился|назвался|сказал,\s*что\s+(?:его|её|ее)\s+зовут)|"
    r"user\s+(?:introduced|said\s+(?:their|his|her)\s+name\s+is)"
    r")",
)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _now_dt() -> datetime:
    return datetime.now(UTC)


def _content_hash(text: str) -> str:
    return hashlib.sha1(text.strip().lower().encode("utf-8")).hexdigest()[:16]


def is_plausible_companion_memory(content: str, *, user_line: str = "", kind: str = "") -> bool:
    """Reject LLM memory rows that confuse a question to the companion with user identity."""

    text = (content or "").strip()
    if len(text) < 2:
        return False
    kind_l = (kind or "").strip().lower()
    user = (user_line or "").strip()
    user_low = user.lower()
    text_low = text.lower()

    if "?" in text:
        return False
    if _ASSISTANT_NAME_QUESTION_RE.search(text):
        return False

    if kind_l in ("identity", "fact") and _ASSISTANT_NAME_QUESTION_RE.search(user):
        for frag in ("тебя как", "вас как", "как зовут", "как величать", "your name"):
            if frag in text_low and frag in user_low:
                return False
        if text_low.startswith("имя пользователя:") and _ASSISTANT_NAME_QUESTION_RE.search(text):
            return False

    return not (_LLM_INTRO_CLAIM_RE.search(text) and not _USER_INTRO_RE.search(user))


def _clamp_unit(value: Any, default: float) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):  # fmt: skip
        return default
    if v < 0.0:
        return 0.0
    if v > 1.0:
        return 1.0
    return v


def _normalize_entry(raw: Any) -> dict[str, Any] | None:
    """Coerce a single memory entry into the canonical shape; ``None`` if unsalvageable."""

    if not isinstance(raw, Mapping):
        return None
    content = str(raw.get("content", "")).strip()
    if not content:
        return None
    if len(content) > MAX_CONTENT_CHARS:
        content = content[: MAX_CONTENT_CHARS - 1].rstrip() + "…"
    raw_type = str(raw.get("type", "")).strip().lower()
    mtype = raw_type if raw_type in ALLOWED_TYPES else DEFAULT_TYPE
    raw_kind = str(raw.get("kind", "") or raw.get("category", "") or raw_type).strip().lower()
    kind = raw_kind if raw_kind in ALLOWED_KINDS else mtype
    raw_source = str(raw.get("source", "")).strip().lower()
    source = raw_source if raw_source in ALLOWED_SOURCES else "llm"
    importance = _clamp_unit(raw.get("importance"), 0.5)
    confidence = _clamp_unit(raw.get("confidence"), 0.75)
    valence = _clamp_unit(raw.get("valence"), 0.5)
    since_ts = str(raw.get("since_ts") or "").strip() or _now_iso()
    last_used_ts = str(raw.get("last_used_ts") or "").strip() or since_ts
    return {
        "type": mtype,
        "kind": kind,
        "content": content,
        "importance": importance,
        "confidence": confidence,
        "source": source,
        "valence": valence,
        "since_ts": since_ts,
        "last_used_ts": last_used_ts,
        "content_hash": _content_hash(content),
    }


def normalize_memory_list(raw: Any) -> list[dict[str, Any]]:
    """Coerce any stored ``companion_memory_v1`` payload into a list of canonical rows."""

    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw:
        row = _normalize_entry(item)
        if row is None:
            continue
        if row["content_hash"] in seen:
            continue
        seen.add(row["content_hash"])
        out.append(row)
    return out[-MAX_STORED_MEMORIES:]


def get_memory(profile: Mapping[str, Any] | None) -> list[dict[str, Any]]:
    """Read normalized memory list from a profile mapping."""

    if not isinstance(profile, Mapping):
        return []
    lp = profile.get("learned_preferences")
    if not isinstance(lp, Mapping):
        return []
    return normalize_memory_list(lp.get(MEMORY_NS))


def _payload_rows(payload: Any) -> list[Any]:
    if isinstance(payload, list):
        return list(payload)
    if isinstance(payload, Mapping):
        inner = payload.get("memories") if "memories" in payload else None
        return list(inner) if isinstance(inner, list) else [payload]
    return []


def _body_is_action_only(rows: list[Any]) -> bool:
    from api.ewa_platform.companion.actions.allowlist import ALLOWED_ACTION_TYPES

    typed: list[str] = []
    for raw in rows:
        if isinstance(raw, Mapping):
            typed.append(str(raw.get("type", "")).strip().lower())
    non_empty = [t for t in typed if t]
    if not non_empty:
        return False
    return all(t in ALLOWED_ACTION_TYPES for t in non_empty)


def _ingest_memory_json_body(body: str, parsed_entries: list[dict[str, Any]]) -> None:
    if not body:
        return
    try:
        payload: Any = json.loads(body)
    except json.JSONDecodeError:
        logger.warning(
            "companion_chat_memory_parse_failed body_chars=%s preview=%r",
            len(body),
            body[:120],
        )
        return
    rows = _payload_rows(payload)
    if _body_is_action_only(rows):
        return
    for raw in rows:
        row = _normalize_entry(raw)
        if row is not None:
            parsed_entries.append(row)


def parse_memory_tail(reply_text: str) -> tuple[str, list[dict[str, Any]]]:
    """Extract zero-or-more `<<MEMORY>>{...}<<END>>` blocks from a model reply.

    Returns ``(stripped_reply, new_entries)``. ``new_entries`` is already normalized; duplicates against the
    existing store should be filtered by the caller via ``merge_memory_entries``. The user-visible reply is
    returned with all memory tail markers (and any whitespace around them) removed.
    """

    if not isinstance(reply_text, str) or not reply_text:
        return reply_text or "", []

    parsed_entries: list[dict[str, Any]] = []
    for m in _MEMORY_TAIL_RE.finditer(reply_text):
        _ingest_memory_json_body(m.group("body").strip(), parsed_entries)

    for _pat, _match, body in iter_malformed_control_tail_bodies(reply_text):
        _ingest_memory_json_body(body, parsed_entries)

    stripped = _MEMORY_TAIL_RE.sub("", reply_text)
    stripped = strip_malformed_control_tails(stripped)
    return stripped.strip(), parsed_entries


def parse_explicit_memory_intent(user_line: str) -> list[dict[str, Any]]:
    """Extract structured memory rows from explicit user wording without waiting for an LLM ``<<MEMORY>>`` tail."""

    raw = (user_line or "").strip()
    if not raw:
        return []

    def _push(
        out: list[dict[str, Any]],
        text: str,
        *,
        kind: str = "preference",
        importance: float = 0.88,
    ) -> None:
        blob = str(text or "").strip()
        if len(blob) < 2:
            return
        row = _normalize_entry(
            {
                "type": "preference" if kind == "preference" else "fact",
                "kind": kind,
                "content": blob[:MAX_CONTENT_CHARS],
                "importance": importance,
                "confidence": 0.95,
                "source": "user_explicit",
                "valence": 0.55,
            }
        )
        if row is not None:
            out.append(row)

    out: list[dict[str, Any]] = []
    m_line = _REMEMBER_LINE_RU.match(raw)
    if m_line:
        _push(out, m_line.group(1).strip(" \t\r\n«»\"'.,:;!—"), kind="preference")
        return out
    m_line = _REMEMBER_LINE_EN.match(raw) or _NOTE_THAT_EN.match(raw)
    if m_line:
        _push(out, m_line.group(1).strip(" \t\r\n\"'.,:;!—"), kind="preference")
        return out

    m_name = _NAME_RU.search(raw)
    if m_name:
        name = m_name.group(1).strip(" \t\r\n«»\"'.,:;!?")
        if len(name) >= 2:
            _push(out, f"Имя пользователя: {name}", kind="identity", importance=0.92)

    m_name_en = _NAME_EN.search(raw)
    if m_name_en:
        name = m_name_en.group(1).strip(" \t\r\n\"'.,:;!?")
        if len(name) >= 2:
            _push(out, f"User's name: {name}", kind="identity", importance=0.92)

    m_call = _CALLME_RU.search(raw)
    if m_call:
        nick = m_call.group(1).strip(" \t\r\n«»\"'.,:;!?")
        if len(nick) >= 2:
            _push(out, f"Просит называть себя: {nick}", kind="preference", importance=0.86)

    return out


def merge_memory_entries(
    current: Sequence[Mapping[str, Any]] | None,
    new_entries: Sequence[Mapping[str, Any]],
    *,
    user_line: str = "",
) -> tuple[list[dict[str, Any]], int]:
    """Append new entries to the current list, dedup by content hash, refresh ``last_used_ts``.

    Returns ``(merged_list, added_count)`` — duplicates count as 0 (their ``last_used_ts`` is bumped instead).
    """

    base = normalize_memory_list(list(current or []))
    by_hash: dict[str, dict[str, Any]] = {row["content_hash"]: dict(row) for row in base}
    order: list[str] = [row["content_hash"] for row in base]
    added = 0
    now = _now_iso()
    for raw in new_entries:
        row = _normalize_entry(raw)
        if row is None:
            continue
        if user_line and not is_plausible_companion_memory(
            str(row.get("content") or ""),
            user_line=user_line,
            kind=str(row.get("kind") or ""),
        ):
            continue
        h = row["content_hash"]
        if h in by_hash:
            by_hash[h]["last_used_ts"] = now
            # Bump importance toward the higher of the two without exceeding 1.0.
            by_hash[h]["importance"] = max(
                _clamp_unit(by_hash[h].get("importance"), 0.5),
                _clamp_unit(row.get("importance"), 0.5),
            )
            continue
        by_hash[h] = row
        order.append(h)
        added += 1
    merged = [by_hash[h] for h in order][-MAX_STORED_MEMORIES:]
    return merged, added


def _recency_score(last_used_ts: str) -> float:
    """0..1 decay score: just-touched → ~1, very old → ~0. Tolerant to malformed timestamps."""

    if not last_used_ts:
        return 0.5
    try:
        ts = datetime.fromisoformat(last_used_ts.replace("Z", "+00:00"))
    except ValueError:
        return 0.5
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    age_days = max(0.0, (_now_dt() - ts).total_seconds() / 86400.0)
    if RECENCY_HALFLIFE_DAYS <= 0.0:
        return 0.5
    # Exponential decay with the configured half-life.
    score = 0.5 ** (age_days / RECENCY_HALFLIFE_DAYS)
    return _clamp_unit(score, 0.5)


def select_top_memories(
    memories: Sequence[Mapping[str, Any]] | None,
    *,
    limit: int = MAX_PROMPT_MEMORIES,
) -> list[dict[str, Any]]:
    """Pick the ``limit`` most relevant memories by ``importance * 0.7 + recency * 0.3``."""

    rows = normalize_memory_list(list(memories or []))
    scored: list[tuple[float, dict[str, Any]]] = []
    for row in rows:
        score = _clamp_unit(row.get("importance"), 0.5) * 0.7 + _recency_score(str(row.get("last_used_ts", ""))) * 0.3
        scored.append((score, row))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [row for _, row in scored[:limit]]


def _memory_content_for_llm_prompt(row: Mapping[str, Any]) -> str:
    """Text shown to the **LLM** in the memory block — not the SPA strip (SPA may use ``__ewa_idle_amnesia__`` sentinel)."""

    src = str(row.get("source") or "").strip().lower()
    raw = str(row.get("content") or "").strip()
    if raw == COMPANION_MEMORY_IDLE_AMNESIA_DISPLAY_SENTINEL or src == "arlika_idle_amnesia":
        return (
            "[idle revert] Personal durable memories about the user were cleared after the Arlika idle-time revert. "
            "In your **visible** reply, say honestly in the user's language that you no longer retain those earlier "
            "personal facts and offer to relearn what matters — do **not** quote ``__ewa_*__`` tokens, debug strings, "
            "or paste this bracketed note verbatim."
        )
    return raw


def memory_prompt_section(memories: Sequence[Mapping[str, Any]] | None) -> str:
    """Render the top-N memories as a compact bullet list for the system prompt; empty string when none."""

    top = select_top_memories(memories)
    if not top:
        return ""
    lines = ["What you remember about us (compact, top by importance/recency):"]
    for row in top:
        kind = str(row.get("kind") or row.get("type") or DEFAULT_TYPE).strip()
        text = _memory_content_for_llm_prompt(row)
        if not text:
            continue
        lines.append(f"- [{kind}] {text}")
    if len(lines) <= 1:
        return ""
    blob = "\n".join(lines)
    blob = collapse_idle_observation_tokens(blob)
    cap = memory_llm_inject_max_chars()
    if len(blob) > cap:
        blob = blob[: cap - 1] + "…"
    return blob


def _catalog_preference_lines(prefs: Any) -> list[str]:
    exclude_content = [str(x).strip().lower() for x in getattr(prefs, "exclude_content_types", []) if str(x).strip()]
    exclude_mime = [str(x).strip().lower() for x in getattr(prefs, "exclude_mime_groups", []) if str(x).strip()]
    exclude_ext = [str(x).strip().lower() for x in getattr(prefs, "extension_exclude", []) if str(x).strip()]
    lines: list[str] = []
    if "audio" in set(exclude_content) or "audio" in set(exclude_mime):
        lines.append("Предпочитает видеть списки документов и файлов без аудио.")
    if exclude_ext:
        lines.append(
            "Предпочитает исключать из списков файлов расширения: " + ", ".join(sorted(set(exclude_ext))) + "."
        )
    return lines


def sync_catalog_preferences_memory(
    current: Sequence[Mapping[str, Any]] | None,
    prefs: Any,
) -> list[dict[str, Any]]:
    """Mirror structured catalogue preferences into durable visible memory rows."""

    base = [
        row
        for row in normalize_memory_list(list(current or []))
        if row.get("kind") != "catalog_preference" and row.get("source") != "catalog_preferences"
    ]
    derived = [
        {
            "type": "preference",
            "kind": "catalog_preference",
            "content": line,
            "importance": 0.86,
            "confidence": 0.98,
            "source": "catalog_preferences",
            "valence": 0.62,
        }
        for line in _catalog_preference_lines(prefs)
    ]
    merged, _added = merge_memory_entries(base, derived)
    return merged


def delete_memory_by_content_hash(
    existing: list[dict[str, Any]],
    content_hash: str,
) -> tuple[list[dict[str, Any]], bool]:
    """Remove one normalized ``companion_memory_v1`` row by ``content_hash`` (user forget)."""

    target = (content_hash or "").strip().lower()
    if not target:
        return existing, False
    kept = [row for row in existing if str(row.get("content_hash") or "").strip().lower() != target]
    return kept, len(kept) < len(existing)


def companion_memory_display_lines(
    learned_preferences: Mapping[str, Any] | None,
    *,
    max_lines: int | None = None,
) -> list[str]:
    """Server-derived visible memory strip lines for the frontend (default length ``COMPANION_MEMORY_DISPLAY_MAX_LINES``).

    Rows with ``source=arlika_idle_amnesia`` emit ``COMPANION_MEMORY_IDLE_AMNESIA_DISPLAY_SENTINEL`` for SPA i18n.
    """

    cap = COMPANION_MEMORY_DISPLAY_MAX_LINES if max_lines is None else max(0, int(max_lines))
    learned = dict(learned_preferences or {}) if isinstance(learned_preferences, Mapping) else {}
    rows: list[tuple[float, str]] = []
    for row in normalize_memory_list(learned.get(MEMORY_NS)):
        content = str(row.get("content") or "").strip()
        src = str(row.get("source") or "").strip().lower()
        display_line = COMPANION_MEMORY_IDLE_AMNESIA_DISPLAY_SENTINEL if src == "arlika_idle_amnesia" else content
        if not display_line:
            continue
        imp = _clamp_unit(row.get("importance"), 0.5)
        rec = _recency_score(str(row.get("last_used_ts") or row.get("since_ts") or ""))
        bonus = 0.06 if src == "user_explicit" else 0.0
        score = imp * 0.58 + rec * 0.36 + bonus
        rows.append((score, display_line))

    prefs_raw = learned.get("ewa_runtime_catalog_preferences_v1")
    if isinstance(prefs_raw, Mapping):

        class _Prefs:
            exclude_content_types = list(prefs_raw.get("exclude_content_types") or [])
            exclude_mime_groups = list(prefs_raw.get("exclude_mime_groups") or [])
            extension_exclude = list(prefs_raw.get("extension_exclude") or [])

        for line in _catalog_preference_lines(_Prefs()):
            rows.append((0.88, line))

    seen: set[str] = set()
    out: list[str] = []
    for _score, line in sorted(rows, key=lambda item: item[0], reverse=True):
        key = line.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(line)
        if len(out) >= cap:
            break
    return out


def memory_emit_instruction() -> str:
    """One-paragraph instruction that teaches the LLM the optional ``<<MEMORY>>...<<END>>`` tail format."""

    from api.ewa_platform.companion.prompt_blocks.service import get_prompt_block

    return get_prompt_block("emit.memory")


def memory_emit_instruction_arlika() -> str:
    """Memory policy when persona is Arlika — user cannot command remembers; bias to negative durable notes."""

    from api.ewa_platform.companion.prompt_blocks.service import get_prompt_block

    return get_prompt_block("emit.memory_arlika")


def merge_into_learned_preferences(
    learned: Mapping[str, Any] | None,
    memory_list: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """Top-level merge for the chat turn / evolution tick: writes the memory namespace as an array."""

    out: dict[str, Any] = dict(learned) if isinstance(learned, Mapping) else {}
    out[MEMORY_NS] = [dict(row) for row in memory_list]
    return out


__all__: Sequence[str] = (
    "COMPANION_MEMORY_DISPLAY_MAX_LINES",
    "COMPANION_MEMORY_IDLE_AMNESIA_DISPLAY_SENTINEL",
    "MEMORY_NS",
    "MEMORY_PROMPT_BUDGET_CHARS",
    "MAX_CONTENT_CHARS",
    "MAX_STORED_MEMORIES",
    "MAX_PROMPT_MEMORIES",
    "clamp_companion_memory_prompt_block",
    "memory_llm_inject_max_chars",
    "merge_memory_prompt_layers_for_llm",
    "normalize_memory_list",
    "get_memory",
    "parse_memory_tail",
    "parse_explicit_memory_intent",
    "is_plausible_companion_memory",
    "merge_memory_entries",
    "delete_memory_by_content_hash",
    "sync_catalog_preferences_memory",
    "companion_memory_display_lines",
    "select_top_memories",
    "memory_prompt_section",
    "memory_emit_instruction",
    "memory_emit_instruction_arlika",
    "merge_into_learned_preferences",
)
