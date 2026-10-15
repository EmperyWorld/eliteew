# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Shared **context hygiene** for companion prompts and episodic ingestion: strip telemetry-shaped lines,
# analyst/meta preambles, and noisy draft frames before text reaches the main LLM or ``ewa_companion_episodes``.
# Invariants:
# - Pure string transforms — never raises; empty in → empty out.
# - Keeps behavior best-effort (heuristics); callers still run length caps elsewhere.
# - Visible reply path strips Gemma 4 / llama-server ``<|channel>thought`` / ``<channel|>`` via
#   ``strip_llm_channel_markup`` (same helper as workflows / Product Assistant).
# Related:
# - api/ewa_platform/companion/episodic/body_sanitize.py
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/utils/llm_json_extract.py
# - documentation/product/ewa/EWA-COMPANION-VISIBLE-REPLY-FORMATTING.md
# **Canonical path:** ``api.ewa_platform.companion.context.noise``; shim ``companion_context_noise``.
# ---
"""Noise removal for companion context blocks and episodic bodies."""

from __future__ import annotations

import json
import re
from collections.abc import Mapping
from re import Pattern
from typing import Any, Final

# Reuse telemetry heuristics (import would cycle); duplicate minimal patterns via shared callers — instead import function:
from api.ewa_platform.companion.episodic.body_sanitize import (
    sanitize_companion_episode_body_for_storage,
)
from api.ewa_platform.companion.ux.control_tails import strip_malformed_control_tails
from api.utils.llm_json_extract import strip_llm_channel_markup, strip_llm_thinking_prefix

_META_LINE_START_RE: Final[Pattern[str]] = re.compile(
    r"(?i)^\s*(?:"
    r"пользователь\s+(?:хочет|просит|спрашивает|пишет)|"
    r"user\s+(?:wants|asks|says|writes|message)|"
    r"the\s+user\s+(?:wants|asks)|"
    r"сообщение\s+пользователя|"
    r"^input\s*:|^output\s*:|^draft\s*:"
    r")[\s\:]*",
)

_THEATRICAL_BURST_RE: Final[Pattern[str]] = re.compile(
    r"(?m)^\s*(?:[—\-•]\s*)?(?:ты\s+—|я\s+—|мы\s+—).+$",
)


def strip_meta_preamble_lines(text: str, *, max_strip_paragraphs: int = 2) -> str:
    """Drop leading paragraphs that read like third-person analyst voice."""

    raw = (text or "").strip()
    if not raw:
        return ""
    paras = [p.strip() for p in re.split(r"\n{2,}", raw) if p.strip()]
    if not paras:
        return raw
    drop = 0
    for p in paras[:max_strip_paragraphs]:
        if _META_LINE_START_RE.search(p) or p.lower().startswith(("user message:", "message:")):
            drop += 1
            continue
        if re.match(r"(?i)^\**(?:analysis|thought)\**:", p):
            drop += 1
            continue
        break
    if drop == 0:
        return raw
    kept = paras[drop:]
    return "\n\n".join(kept).strip()


def strip_draft_service_frames(text: str) -> str:
    """Remove common «Draft / Input / Output» scaffolding lines."""

    lines_out: list[str] = []
    for line in (text or "").splitlines():
        low = line.strip().lower()
        if low.startswith(
            ("draft:", "input:", "output:", "### draft", "## draft", "--- input", "--- output"),
        ):
            continue
        lines_out.append(line)
    return "\n".join(lines_out).strip()


def dedupe_meaningful_lines(text: str, *, max_lines: int = 96) -> str:
    """Remove exact duplicate non-empty lines (case-folded) while preserving order."""

    seen: set[str] = set()
    out: list[str] = []
    for line in (text or "").splitlines():
        key = " ".join(line.lower().split())
        if not key:
            out.append(line)
            continue
        if key in seen:
            continue
        seen.add(key)
        out.append(line)
    joined = "\n".join(out).strip()
    if len(joined.splitlines()) > max_lines:
        joined = "\n".join(joined.splitlines()[:max_lines]).rstrip() + "\n…"
    return joined


def sanitize_context_block_for_llm(
    text: str,
    *,
    max_chars: int = 24_000,
    apply_episode_sanitizer: bool = True,
) -> str:
    """Full pipeline for condensed / anchor fragments before system prompt."""

    t = (text or "").strip()
    if not t:
        return ""
    t = strip_draft_service_frames(t)
    t = strip_meta_preamble_lines(t)
    t = dedupe_meaningful_lines(t)
    if apply_episode_sanitizer:
        t = sanitize_companion_episode_body_for_storage(t, max_chars=max_chars)
    elif len(t) > max_chars:
        t = t[: max_chars - 1].rstrip() + "…"
    return t.strip()


def anti_meta_visible_reply(reply: str) -> str:
    """Strip leading meta lines from user-visible assistant text."""

    r = strip_meta_preamble_lines(reply or "", max_strip_paragraphs=3)
    r = strip_draft_service_frames(r)
    return r.strip()


def squash_theatrical_refrain_block(reply: str, *, max_paragraphs_kept: int = 5) -> str:
    """When the model stacks many «Ты — / Я —» lines, keep head + tail and collapse middle."""

    t = (reply or "").strip()
    if not t:
        return ""
    paras = [p.strip() for p in re.split(r"\n{2,}", t) if p.strip()]
    if len(paras) <= max_paragraphs_kept:
        theatrical = sum(1 for p in paras if _THEATRICAL_BURST_RE.search(p))
        if theatrical < 4:
            return t
    kept: list[str] = []
    theatrical_run = 0
    for p in paras:
        is_th = bool(_THEATRICAL_BURST_RE.search(p))
        if is_th:
            theatrical_run += 1
            if theatrical_run <= 2:
                kept.append(p)
            elif theatrical_run == 3:
                kept.append("…")
            continue
        theatrical_run = 0
        kept.append(p)
    return "\n\n".join(kept).strip()


def collapse_idle_observation_tokens(text: str) -> str:
    """Collapse long runs of ``observation:idle`` (rollup / memory snippets)."""

    s = (text or "").strip()
    if "observation:idle" not in s.lower():
        return s
    pat = re.compile(r"(?:\s*observation:idle\s*){3,}", re.IGNORECASE)
    return pat.sub(" observation:idle ×… ", s).strip()


def noise_risk_flags(
    *,
    condensed: str,
    anchor_snippet: str,
    memory_section: str,
    system_prompt_sample: str,
) -> dict[str, bool]:
    """Cheap heuristic flags for diagnostics (``/context-anchor/diagnose``)."""

    blob = "\n".join(x for x in (condensed, anchor_snippet, memory_section, system_prompt_sample) if x)
    low = blob.lower()
    noise_risk = any(
        k in low
        for k in (
            "prompt_save",
            "n_ctx_slot",
            "llama-server",
            "srv ",
            "ggml_",
            "dump_state",
        )
    )
    drift_risk = low.count("observation:idle") > 6 or theatrical_risk_score(blob) > 0.35
    bloat_risk = len(blob) > 45_000
    action_risk = ("пользователь просит" in low or "the user wants" in low) and "<<" not in blob
    return {
        "noise_risk": noise_risk,
        "drift_risk": drift_risk,
        "prompt_bloat_risk": bloat_risk,
        "action_execution_risk": action_risk,
    }


def theatrical_risk_score(text: str) -> float:
    """0..1 crude score from stacked anaphora lines."""

    lines = [ln for ln in (text or "").splitlines() if ln.strip()]
    if not lines:
        return 0.0
    hits = sum(1 for ln in lines if _THEATRICAL_BURST_RE.search(ln))
    return min(1.0, hits / max(6, len(lines) // 3))


def trim_condensed_against_anchor(condensed: str, anchor_markdown: str) -> str:
    """If a condensed paragraph duplicates an anchor bullet line, drop the paragraph (anti-duplication)."""

    c = (condensed or "").strip()
    a = (anchor_markdown or "").strip()
    if not c or not a:
        return c
    anchor_keys: set[str] = set()
    for ln in a.splitlines():
        t = ln.strip().lstrip("-*•").strip()
        if len(t) < 12:
            continue
        anchor_keys.add(" ".join(t.lower().split()))
    paras = [p.strip() for p in re.split(r"\n{2,}", c) if p.strip()]
    kept: list[str] = []
    for p in paras:
        pk = " ".join(p.lower().split())
        if pk in anchor_keys:
            continue
        kept.append(p)
    return "\n\n".join(kept).strip()


_BRANCHES_SKIP_ACTION_NUDGE: frozenset[str] = frozenset(
    {
        "plan_v1",
        "plan_v1_unavailable",
        "plan_task_complete_v1",
        "calendar_v1",
        "workflow",
        "workflow_reflect_week",
        "resume_pending_task",
        "resume_completed_music_generation",
        "resume_completed_presentation",
    }
)

_DEFERRED_MUSIC_STARTED_CLAIM_LINE_RE = re.compile(
    r"(?im)^.*(?:"
    r"(?:генерац\w*|песн\w*|тр[еэ]к\w*|музык\w*|music|song|track).{0,80}"
    r"(?:уже|запущен\w*|запустил\w*|в\s+процессе|already|started|running|in\s+progress)"
    r"|"
    r"(?:уже|запущен\w*|запустил\w*|в\s+процессе|already|started|running|in\s+progress).{0,80}"
    r"(?:генерац\w*|песн\w*|тр[еэ]к\w*|музык\w*|music|song|track)"
    r").*$"
)


def _append_tail_once(reply: str, tail: str) -> str:
    """Append a guidance tail once while preserving existing visible text."""

    body = (reply or "").strip()
    if not tail:
        return body
    if tail in body:
        return body
    return f"{body}\n\n{tail}".strip() if body else tail


def _enforce_file_study_music_truth(
    reply: str,
    *,
    user_line: str,
    deferred_music_generation: bool,
) -> str:
    """Strip false 'already started' claims for ``file_study_compose`` replies."""

    cleaned = _DEFERRED_MUSIC_STARTED_CLAIM_LINE_RE.sub("", reply or "").strip()
    looks_ru = bool(re.search(r"[А-Яа-яЁё]", user_line or ""))
    if deferred_music_generation:
        tail = (
            "Важно: генерация песни ещё не запущена — она в очереди следующего шага. Напиши «продолжай/запускай», и я запущу её."
            if looks_ru
            else "Important: song generation has not started yet — it is queued as the next step. Say 'continue/go on' and I will start it."
        )
        return _append_tail_once(cleaned, tail)
    tail = (
        "Важно: генерация песни ещё не запущена. В этом шаге я делаю анализ и текст; для запуска генерации напиши отдельной командой."
        if looks_ru
        else "Important: song generation has not started yet. This step only handles analysis and lyrics; send a separate command to start generation."
    )
    return _append_tail_once(cleaned, tail)


_MEMORY_BLOCK_RE: Final[Pattern[str]] = re.compile(r"<<MEMORY>>.*?<<END>>", re.DOTALL | re.IGNORECASE)
_ACTIONS_BLOCK_RE: Final[Pattern[str]] = re.compile(r"<<ACTIONS>>.*?<<END>>", re.DOTALL | re.IGNORECASE)
_INTERNAL_KIND_LINE_RE: Final[Pattern[str]] = re.compile(
    r"(?im)^\s*\[?(?:identity|fact|episode(?:/[^\]]*)?|relationship|preference|story|correction)\]?\s+.*$",
)
_INTERNAL_KIND_INLINE_RE: Final[Pattern[str]] = re.compile(
    r"\[(?:identity|fact|episode(?:/[^\]]*)?)\]\s*",
    re.IGNORECASE,
)


def _unwrap_visible_reply_json_envelope(text: str) -> str:
    trimmed = (text or "").strip()
    if not trimmed.startswith("{"):
        return trimmed
    if trimmed.endswith("}"):
        try:
            parsed: Any = json.loads(trimmed)
        except json.JSONDecodeError:
            from api.ewa_platform.companion.ux.reply_extract import (
                _loose_extract_visible_reply_from_envelope,
            )

            loose = _loose_extract_visible_reply_from_envelope(trimmed)
            return loose if loose is not None else trimmed
        if isinstance(parsed, dict) and isinstance(parsed.get("visible_reply"), str):
            return str(parsed.get("visible_reply") or "").strip()
    from api.ewa_platform.companion.ux.reply_extract import (
        _loose_extract_visible_reply_from_envelope,
    )

    loose = _loose_extract_visible_reply_from_envelope(trimmed)
    return loose if loose is not None else trimmed


def strip_internal_companion_markup(reply: str) -> str:
    """Remove HCM bracket tags, memory/action tails, Gemma channel tokens, and JSON envelopes from user-visible text."""

    t = strip_llm_thinking_prefix(strip_llm_channel_markup(reply or ""))
    t = _unwrap_visible_reply_json_envelope(t)
    t = strip_llm_thinking_prefix(strip_llm_channel_markup(t))
    t = _MEMORY_BLOCK_RE.sub("", t)
    t = _ACTIONS_BLOCK_RE.sub("", t)
    t = strip_malformed_control_tails(t)
    lines: list[str] = []
    for line in t.splitlines():
        if _INTERNAL_KIND_LINE_RE.match(line):
            continue
        cleaned = _INTERNAL_KIND_INLINE_RE.sub("", line)
        if cleaned.strip():
            lines.append(cleaned.rstrip())
    t = "\n".join(lines).strip()
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def apply_companion_visible_reply_guards(
    reply: str,
    *,
    user_line: str,
    intent_plan: Any | None,
    actions: list[dict[str, Any]] | None,
    trivial_user_message: bool = False,
    effective_branch: str | None = None,
    deferred_music_generation: bool = False,
    orchestration_outcome: str | None = None,
    task_run: Mapping[str, Any] | None = None,
    turn_plan_next_tool: str | None = None,
) -> str:
    """Post-process visible assistant text: anti-meta, optional theatre squash, action-intent nudge."""

    from api.ewa_platform.companion.context.truth_guard_registry import (
        TruthGuardContext,
        apply_truth_guards,
        task_run_status_from_mapping,
    )

    r = strip_internal_companion_markup(reply)
    r = anti_meta_visible_reply(r)
    if trivial_user_message:
        r = squash_theatrical_refrain_block(r)
    branch = (effective_branch or "").strip()
    if branch == "file_study_compose" and (
        deferred_music_generation or bool(_DEFERRED_MUSIC_STARTED_CLAIM_LINE_RE.search(r))
    ):
        r = _enforce_file_study_music_truth(
            r,
            user_line=user_line,
            deferred_music_generation=deferred_music_generation,
        )
    r = apply_truth_guards(
        r,
        TruthGuardContext(
            user_line=user_line,
            effective_branch=branch,
            deferred_music_generation=deferred_music_generation,
            orchestration_outcome=orchestration_outcome,
            actions=actions,
            task_run_status=task_run_status_from_mapping(task_run) if task_run else None,
            turn_plan_next_tool=turn_plan_next_tool,
        ),
    )[0]
    if branch in _BRANCHES_SKIP_ACTION_NUDGE or branch.startswith("workflow"):
        return r
    if intent_plan is None:
        return r
    try:
        conf = float(getattr(intent_plan, "confidence", 0.0) or 0.0)
    except (TypeError, ValueError):  # fmt: skip
        conf = 0.0
    intent = str(getattr(intent_plan, "intent", "") or "").strip()
    if not intent or intent == "chat_only" or conf < 0.72:
        return r
    if actions:
        return r
    if r.strip() and not _META_LINE_START_RE.search(r[:1200]):
        return r
    looks_ru = bool(re.search(r"[А-Яа-яЁё]", user_line or ""))
    if looks_ru:
        return "Сделаю это через ACTION-жест в интерфейсе — коротко опишу результат сразу после выполнения."
    return "I'll carry this out via an ACTION gesture—expect a short status line right after it runs."


__all__ = [
    "apply_companion_visible_reply_guards",
    "anti_meta_visible_reply",
    "collapse_idle_observation_tokens",
    "dedupe_meaningful_lines",
    "noise_risk_flags",
    "sanitize_context_block_for_llm",
    "squash_theatrical_refrain_block",
    "strip_draft_service_frames",
    "strip_internal_companion_markup",
    "strip_meta_preamble_lines",
    "theatrical_risk_score",
    "trim_condensed_against_anchor",
]
