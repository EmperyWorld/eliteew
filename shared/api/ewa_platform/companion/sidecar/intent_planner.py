# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Intent planner** for EWA companion: one cheap HTTP LLM call returns ``CompanionIntentPlanV1`` from **JSON** or
# **markdown bullet** key lines; ``task_orchestrator`` validates slots and runs tools **after** the plan, with regex
# fallbacks if the planner is off or returns ``chat_only``.
# Invariants:
# - Default HTTP base: shared tool-router sidecar URL chain (not main chat LLAMA_URL).
# - Never executes side effects; parsing failures → ``None`` (caller falls back to legacy orchestration).
# - Model output: **JSON** (fenced ``` / balanced ``{...}`` / ``find``–``rfind`` slice) **or** markdown bullet ``key: value``
#   lines parsed via ``companion_llm_kv_markdown`` — same ``CompanionIntentPlanV1`` contract. Suffix re-parse tolerates CoT.
#   Sidecar HTTP call sets ``openai_sidecar_merge_reasoning`` so an empty ``assistant.content`` still yields ``response`` from ``reasoning_content``.
#   Unparseable output → **info** log with ``finish_reason``; HTTP/schema failures stay **warning**.
# Related:
# - api/ewa_platform/schemas/pydantic/companion_intent.py (model definition)
# - api/ewa_platform/companion/contracts/__init__.py (import path for planner/orchestrator)
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - api/ewa_platform/companion/turn/chat_turn.py
# **Canonical path:** ``api.ewa_platform.companion.sidecar.intent_planner``; shim ``companion_intent_planner``.
# ---
"""HTTP LLM JSON intent planner for EWA companion orchestration."""

from __future__ import annotations

import json
import logging
import os
import re
from collections.abc import Mapping
from typing import Any

import httpx

from api.core.unified_config import unified_settings
from api.ewa_platform.companion.contracts import CompanionIntentPlan
from api.ewa_platform.companion.sidecar.llm_kv_markdown import (
    intent_kv_suffix_after_cot,
    intent_plan_dict_from_markdown_kv,
    parse_companion_markdown_kv,
)
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json
from api.utils.tool_router_sidecar_runtime import (
    shared_tool_router_base_url,
    shared_tool_router_model,
)

logger = logging.getLogger(__name__)

_JSON_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*(?P<body>.*?)\s*```\s*$", re.DOTALL | re.IGNORECASE)


def _balanced_json_object_slice(s: str) -> str | None:
    """First top-level JSON object substring, respecting double-quoted strings (so ``}`` inside strings does not end early)."""

    start = s.find("{")
    if start < 0:
        return None
    depth = 0
    i = start
    n = len(s)
    while i < n:
        ch = s[i]
        if ch == '"':
            j = i + 1
            while j < n:
                if s[j] == "\\":
                    j += 2
                    continue
                if s[j] == '"':
                    i = j + 1
                    break
                j += 1
            else:
                return None
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return s[start : i + 1]
        i += 1
    return None


def companion_intent_planner_enabled() -> bool:
    from api.ewa_platform.companion.sidecar.tool_router import (
        companion_tool_router_should_skip_legacy_planner,
    )

    if companion_tool_router_should_skip_legacy_planner():
        return False
    raw = os.getenv("EWA_COMPANION_INTENT_PLANNER", "1")
    return str(raw).strip().lower() not in ("0", "false", "no", "off")


def companion_intent_planner_min_confidence() -> float:
    try:
        v = float(os.getenv("EWA_COMPANION_INTENT_PLANNER_MIN_CONFIDENCE", "0.48").strip())
    except ValueError:
        v = 0.48
    return max(0.0, min(1.0, v))


def _planner_model() -> str:
    return (
        os.getenv("EWA_COMPANION_INTENT_MODEL", "").strip()
        or os.getenv("EWA_COMPANION_CHAT_MODEL", "").strip()
        or os.getenv("EWA_ORCH_LLM_MODEL", "").strip()
        or unified_settings.default_ai_model
        or "mistral"
    ).strip()


def companion_intent_planner_http_runtime() -> tuple[str, str]:
    """
    HTTP base + model for intent planner.

    Default: shared LAN tool-router sidecar (``.141:8083``) + router model.
    Override base only: ``EWA_COMPANION_INTENT_PLANNER_URL``.
    Override model: ``EWA_COMPANION_INTENT_MODEL`` (else router model on sidecar path).
    """

    explicit_base = os.getenv("EWA_COMPANION_INTENT_PLANNER_URL", "").strip().rstrip("/")
    if explicit_base:
        return explicit_base, _planner_model()
    intent_model = os.getenv("EWA_COMPANION_INTENT_MODEL", "").strip()
    if intent_model:
        return shared_tool_router_base_url(), intent_model
    return (
        shared_tool_router_base_url(),
        shared_tool_router_model(primary_model_env="EWA_COMPANION_INTENT_MODEL"),
    )


def _shell_hint_for_planner(shell_norm: Mapping[str, Any] | None) -> str:
    if not shell_norm:
        return "No desktop shell snapshot."
    try:
        from api.ewa_platform.companion.storage.doceditor_translate_body import (
            resolve_doc_editor_unified_id_for_shell,
        )

        uc = resolve_doc_editor_unified_id_for_shell(shell_norm)
        if uc:
            return f"DocEditor has an open document unified_content_id={uc}."
    except Exception as exc:  # noqa: BLE001 — hint only; planner falls back to generic shell text
        logger.debug(
            "intent_planner shell DocEditor hint skipped: %s",
            exc,
            exc_info=True,
        )
    return "Shell snapshot present; DocEditor open document uc unknown from this hint."


def parse_llm_json_object(raw: str) -> dict[str, Any] | None:
    """Best-effort JSON object from model output."""

    def _try(t0: str) -> dict[str, Any] | None:
        t = (t0 or "").strip()
        if not t:
            return None
        m = _JSON_FENCE_RE.match(t)
        if m:
            t = m.group("body").strip()

        candidates: list[str] = [t]
        bal = _balanced_json_object_slice(t)
        if bal:
            candidates.append(bal)
        i = t.find("{")
        j = t.rfind("}")
        if i >= 0 and j > i:
            slice_ij = t[i : j + 1]
            if slice_ij not in candidates:
                candidates.append(slice_ij)

        for cand in candidates:
            try:
                obj = json.loads(cand.strip())
                if isinstance(obj, dict):
                    return obj
            except json.JSONDecodeError:
                continue
        return None

    t = (raw or "").strip()
    if not t:
        return None
    hit = _try(t)
    if hit:
        return hit
    if len(t) > 6144:
        return _try(t[-6144:])
    return None


def parse_intent_planner_model_text(text: str) -> dict[str, Any] | None:
    """Parse planner JSON or markdown KV, including CoT-prefixed replies (final ``- intent:`` block)."""

    t = (text or "").strip()
    if not t:
        return None
    suffix = intent_kv_suffix_after_cot(t)
    ordered: list[str] = []
    seen: set[str] = set()
    for cand in (suffix, t):
        if cand and cand not in seen:
            seen.add(cand)
            ordered.append(cand)
    for cand in ordered:
        md = intent_plan_dict_from_markdown_kv(parse_companion_markdown_kv(cand))
        if md:
            return md
        blob = parse_llm_json_object(cand)
        if blob and (str(blob.get("tool") or "").strip() or str(blob.get("intent") or "").strip()):
            return blob
    return None


def _planner_system_prompt(*, russian_user: bool) -> str:
    from api.ewa_platform.companion.prompt_blocks.service import get_prompt_block

    lang = "Russian" if russian_user else "English"
    tmpl = get_prompt_block("sidecar.intent_planner")
    if "{lang}" in tmpl:
        return tmpl.replace("{lang}", lang)
    return tmpl.replace("The user writes in English.", f"The user writes in {lang}.")


async def run_companion_intent_planner(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    user_line: str,
    shell_norm: Mapping[str, Any] | None,
    russian_user: bool,
) -> CompanionIntentPlan | None:
    """Call HTTP LLM once; return validated normalized plan or ``None`` on failure."""

    if not companion_intent_planner_enabled():
        return None
    explicit = (base_url or "").strip().rstrip("/")
    if explicit:
        base, model = explicit, _planner_model()
    else:
        base, model = companion_intent_planner_http_runtime()
    if not base:
        return None
    try:
        user_n = int(os.getenv("EWA_COMPANION_INTENT_NUM_PREDICT", "1536").strip() or "1536")
    except ValueError:
        user_n = 1536
    try:
        n_floor = int(os.getenv("EWA_COMPANION_INTENT_MIN_NUM_PREDICT", "256").strip() or "256")
    except ValueError:
        n_floor = 256
    n_floor = max(120, min(n_floor, 4096))
    n_predict = max(n_floor, min(user_n, 4096))
    try:
        timeout_sec = float(os.getenv("EWA_COMPANION_INTENT_TIMEOUT_SEC", "45").strip() or "45")
    except ValueError:
        timeout_sec = 45.0
    timeout_sec = max(10.0, min(timeout_sec, 120.0))
    timeout = httpx.Timeout(timeout_sec)

    shell_hint = _shell_hint_for_planner(shell_norm)
    messages = [
        {"role": "system", "content": _planner_system_prompt(russian_user=russian_user)},
        {
            "role": "user",
            "content": f"Desktop hint: {shell_hint}\n\nUser message:\n{user_line}",
        },
    ]
    try:
        out = await httpx_compat_chat_completion_json(
            client,
            base,
            model=model,
            messages=messages,
            options={
                "temperature": 0.15,
                "num_predict": n_predict,
                "openai_sidecar_merge_reasoning": True,
            },
            chat_template_kwargs={"enable_thinking": False},
            extra_params={"reasoning_format": "none"},
            timeout=timeout,
        )
        reply_raw = str(out.get("response", "") or "").strip()
        fin = out.get("finish_reason")
        blob = parse_intent_planner_model_text(reply_raw)
        if not blob:
            has_intent_line = "intent:" in reply_raw.lower() or "- intent" in reply_raw.lower()
            logger.info(
                "companion_intent_planner_unparseable len=%s finish_reason=%s intent_markers=%s preview=%r",
                len(reply_raw),
                fin,
                has_intent_line,
                reply_raw[:240],
            )
            return None
        plan = CompanionIntentPlan.from_blob(blob)
        if plan is None:
            has_marker = (
                "intent:" in reply_raw.lower()
                or "- intent" in reply_raw.lower()
                or "tool:" in reply_raw.lower()
                or "- tool" in reply_raw.lower()
            )
            logger.info(
                "companion_intent_planner_unparseable len=%s finish_reason=%s markers=%s preview=%r",
                len(reply_raw),
                fin,
                has_marker,
                reply_raw[:240],
            )
            return None
        min_c = companion_intent_planner_min_confidence()
        would_dispatch_if_reached = plan.tool != "chat_only" and float(plan.confidence) >= min_c
        logger.info(
            "[STEP] companion_intent_planner_decision tool=%s confidence=%.2f min_c=%.2f "
            "would_dispatch_if_reached=%s reply_chars=%d",
            plan.tool,
            float(plan.confidence),
            float(min_c),
            "true" if would_dispatch_if_reached else "false",
            len(reply_raw),
        )
        return plan
    except Exception as exc:  # noqa: BLE001
        logger.warning("companion_intent_planner_failed err=%s", exc)
        return None


__all__ = (
    "companion_intent_planner_enabled",
    "companion_intent_planner_http_runtime",
    "companion_intent_planner_min_confidence",
    "parse_intent_planner_model_text",
    "parse_llm_json_object",
    "run_companion_intent_planner",
)
