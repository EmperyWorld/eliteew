# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# LLM condense sidecar — compress cold checkpoint window into warm plan_summary (Phase 3.5c).
# Invariants:
# - Goal text is always included in LLM input; output must preserve mission intent.
# - Structured JSON output validated via Pydantic before persist.
# Related:
# - api/ewa_platform/agentic/context/condense_contracts.py
# - api/ewa_platform/agentic/context/condense_orchestrator.py
# - api/utils/llm_openai_compat_http.py
# ---

from __future__ import annotations

import json
import logging
import os
from collections.abc import Awaitable, Callable, Mapping
from typing import Any

import httpx
from pydantic import BaseModel, Field, ValidationError

from api.ewa_platform.agentic.config import (
    agentic_condense_http_runtime,
    agentic_condense_llm_enabled,
    agentic_condense_max_summary_chars,
    agentic_condense_num_predict,
    agentic_condense_timeout_sec,
)
from api.ewa_platform.agentic.context.condense_contracts import CondenseSidecarInput
from api.ewa_platform.agentic.kernel.think_command_v1 import extract_json_object

logger = logging.getLogger(__name__)

CondenseLlmFn = Callable[[list[dict[str, str]], str], Awaitable[str]]


class CondenseSidecarError(Exception):
    """Fail-closed condense parse/validation error."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class CondenseSidecarOutput(BaseModel):
    """Structured LLM output — warm-tier mission summary after condensation."""

    plan_summary: str = Field(min_length=1, max_length=12000)

    def trimmed_summary(self, *, max_chars: int | None = None) -> str:
        cap = max_chars if max_chars is not None else agentic_condense_max_summary_chars()
        text = self.plan_summary.strip()
        if len(text) <= cap:
            return text
        return text[: cap - 1].rstrip() + "…"


CONDENSE_SYSTEM_PROMPT = """You are the EWA Agentic Archivist — a sidecar that compresses session event logs into a durable mission summary.

Your job:
1. Read the immutable GOAL and the current PLAN SUMMARY (warm memory).
2. Read the NEW EVENT LOG (checkpoints since the last condensation).
3. Produce an updated plan_summary that:
   - Preserves the mission goal, constraints, and any unresolved blockers.
   - Integrates new facts, tool outcomes, and decisions from the event log.
   - Drops redundant phrasing and duplicate tool chatter.
   - Uses clear prose (2–8 sentences); no bullet lists unless essential.
   - Never claims success for steps that failed or were not executed.

Output exactly ONE JSON object:
{"plan_summary": "<updated warm-tier summary>"}

Rules:
- plan_summary must remain usable on the next Think tick without the raw event log.
- Do NOT remove or rewrite the core goal; fold progress around it.
- If the event log is empty of new facts, return an improved tightening of the current summary.
"""


def _checkpoint_line(cp: Mapping[str, Any]) -> str | None:
    seq = cp.get("seq")
    kind = str(cp.get("kind") or "").strip()
    payload = cp.get("payload_json")
    if not kind or not isinstance(payload, Mapping):
        return None

    prefix = f"#{seq} [{kind}]" if seq is not None else f"[{kind}]"

    if kind == "think":
        dt = payload.get("decision_type") or payload.get("action")
        trace = str(payload.get("reasoning_trace") or payload.get("rationale") or "")[:400]
        summary = str(payload.get("plan_update_summary") or "")[:300]
        parts = [f"decision={dt}"]
        if summary:
            parts.append(f"summary={summary}")
        if trace:
            parts.append(f"trace={trace}")
        return f"{prefix} " + " ".join(parts)

    if kind == "act":
        tool = payload.get("tool") or payload.get("tool_name") or "-"
        status = payload.get("status") or "-"
        summary = str(payload.get("summary") or "")[:400]
        return f"{prefix} tool={tool} status={status} {summary}"

    if kind == "error":
        reason = str(payload.get("reason") or payload.get("summary") or payload)[:400]
        return f"{prefix} {reason}"

    if kind in {"observe", "gate", "plan", "condense"}:
        summary = str(payload.get("summary") or payload.get("plan_summary") or "")[:400]
        return f"{prefix} {summary}" if summary else None

    summary = str(payload.get("summary") or "")[:400]
    return f"{prefix} {summary}" if summary else None


def format_checkpoints_for_condense(checkpoints: list[dict[str, Any]] | tuple[dict[str, Any], ...]) -> str:
    """Render checkpoint rows as compact event log text for the condense LLM."""

    lines: list[str] = []
    for cp in checkpoints:
        if not isinstance(cp, Mapping):
            continue
        line = _checkpoint_line(cp)
        if line:
            lines.append(line)
    return "\n".join(lines)


def build_condense_messages(sidecar_input: CondenseSidecarInput) -> list[dict[str, str]]:
    goal = (sidecar_input.goal_text or "").strip() or "(none)"
    current = (sidecar_input.current_plan_summary or "").strip() or "(empty — first condensation)"
    events = format_checkpoints_for_condense(sidecar_input.checkpoints)
    if not events.strip():
        events = "(no new checkpoint events in window)"

    user_blob = (
        f"GOAL (immutable):\n{goal}\n\n"
        f"CURRENT PLAN SUMMARY:\n{current}\n\n"
        f"NEW EVENT LOG (seq {sidecar_input.from_seq} → {sidecar_input.to_seq}):\n{events}"
    )
    return [
        {"role": "system", "content": CONDENSE_SYSTEM_PROMPT},
        {"role": "user", "content": user_blob},
    ]


def parse_condense_output(raw: str) -> CondenseSidecarOutput:
    blob = extract_json_object(raw)
    if blob is None:
        raise CondenseSidecarError("no_json_object_in_llm_response")
    try:
        return CondenseSidecarOutput.model_validate(blob)
    except ValidationError as exc:
        err_type = exc.errors()[0]["type"] if exc.errors() else "validation_error"
        raise CondenseSidecarError(f"schema_validation_failed:{err_type}") from exc


def _heuristic_condense(sidecar_input: CondenseSidecarInput) -> CondenseSidecarOutput:
    """Deterministic merge when LLM disabled — preserves goal + merges event one-liners."""

    goal = (sidecar_input.goal_text or "").strip()
    current = (sidecar_input.current_plan_summary or "").strip()
    events = format_checkpoints_for_condense(sidecar_input.checkpoints)
    parts: list[str] = []
    if goal:
        parts.append(f"Goal: {goal[:800]}")
    if current:
        parts.append(current)
    elif events:
        parts.append("Progress condensed from recent events.")
    if events:
        event_lines = events.split("\n")[:12]
        digest = " | ".join(line[:120] for line in event_lines if line.strip())
        if digest:
            parts.append(f"Recent: {digest}")
    merged = " ".join(p.strip() for p in parts if p.strip()).strip()
    if not merged:
        merged = goal or "Mission in progress."
    return CondenseSidecarOutput(plan_summary=merged[: agentic_condense_max_summary_chars()])


async def _default_condense_llm_complete(messages: list[dict[str, str]], model: str) -> str:
    from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

    base, resolved_model = agentic_condense_http_runtime()
    use_model = model or resolved_model
    timeout = httpx.Timeout(agentic_condense_timeout_sec())
    response_format: dict[str, Any] = {"type": "json_object"}
    options: dict[str, Any] = {
        "temperature": 0.15,
        "num_predict": agentic_condense_num_predict(),
        "openai_sidecar_merge_reasoning": True,
    }
    disable_thinking = os.getenv("EWA_AGENTIC_CONDENSE_DISABLE_THINKING", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    template_kw = {"enable_thinking": False} if disable_thinking else None

    async with httpx.AsyncClient(timeout=timeout) as client:
        out = await httpx_compat_chat_completion_json(
            client,
            base,
            model=use_model,
            messages=messages,
            options=options,
            timeout=timeout,
            response_format=response_format,
            chat_template_kwargs=template_kw,
        )
    return str(out.get("response", "") or "").strip()


async def invoke_condense_sidecar(
    sidecar_input: CondenseSidecarInput,
    *,
    llm_complete: CondenseLlmFn | None = None,
) -> CondenseSidecarOutput:
    """Run condense sidecar LLM (or heuristic) and return validated warm summary."""

    if not agentic_condense_llm_enabled():
        return _heuristic_condense(sidecar_input)

    messages = build_condense_messages(sidecar_input)
    _, model = agentic_condense_http_runtime()
    complete = llm_complete or _default_condense_llm_complete
    raw = await complete(messages, model)
    if not raw.strip():
        raise CondenseSidecarError("empty_llm_response")

    output = parse_condense_output(raw)
    trimmed = output.trimmed_summary()
    logger.info(
        "[STEP] agentic_condense_sidecar_ok from_seq=%s to_seq=%s summary_chars=%s",
        sidecar_input.from_seq,
        sidecar_input.to_seq,
        len(trimmed),
    )
    return CondenseSidecarOutput(plan_summary=trimmed)


def condense_output_json_schema_hint() -> str:
    return json.dumps({"plan_summary": "string"}, ensure_ascii=False)
