# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# HTTP LLM client for orchestration turns via EliteEW ``httpx_compat_chat_completion_json`` (stack2 / OpenAI-compat).
# Serializes `orchestration_turn_llm_user_content` including optional ``companion_wire`` from orchestrator variables.
# Invariants:
# - No ``api.services.amka_core`` import; structured prompts only; mask failures as short error strings (logged by caller).
# - Optional env ``EWA_ORCH_LLM_CONTEXT_LOG``: INFO ``[STEP] ewa_orch_llm_context`` with UTF-8 sizes (before/after slim).
# - ``planned_tool_schemas`` serialized once per call; system gets prefix [:4000], user ``tools_hint`` only the UTF-8 continuation (no duplicate prefix).
# - Optional env ``EWA_ORCH_LLM_DISABLE_THINKING``: when set (truthy), send ``chat_template_kwargs`` with
#   ``enable_thinking: false`` for llama-server (unless overridden by constructor ``chat_template_kwargs``).
# - OpenAI-compat path sends ``response_format`` ``{"type": "json_object"}`` for strict JSON completions (no effect on
#   native Llama ``/api/chat``).
# Related:
# - api/utils/llm_openai_compat_http.py
# - api/core/unified_config.py (``llama_url``, ``default_ai_model``)
# ---
"""HTTP-backed LLM completions for EWA platform orchestration."""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Mapping
from typing import Any

import httpx

from api.core.unified_config import unified_settings
from api.ewa_platform.llm.context_budget import (
    apply_env_orchestration_llm_slimming,
    log_orchestration_llm_context,
    observation_windows_count_for_log,
    orchestration_variable_component_utf8,
)
from api.ewa_platform.llm.intent_proposal import ORCHESTRATION_LLM_PROMPT_KEY, orchestration_turn_llm_user_content
from api.ewa_platform.llm.tools_schema import planned_tool_schemas
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)


def _env_truthy(raw: str | None) -> bool:
    if raw is None:
        return False
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


_ORCH_SYSTEM_PROMPT = """You assist EliteEW desktop orchestration. Response is a JSON object (server enforces JSON syntax):
{"intent": <desktop intent wire object matching desktop_intent_v1 schema> }
or {"intent": null} to keep the server heuristic intent.
If you output an intent, it must be exactly one valid intentKind with required fields (supports e.g. patch_shell_state, patch_desktop_config for server-side desk theme/wallpaper).
The user JSON may include domain_hints (ugs/documents/content snapshots collected this turn); use them only to propose intents consistent with policy.
Optional companion_wire may contain a truncated companion_profile_json (server-side persona memory); use it only to phrase or prioritize intents consistent with desktop policy—it must never override denies.
Tool sketch (not invoked automatically): """


class HttpOrchestrationLlmClient:
    """Non-streaming chat completion against configured HTTP LLM."""

    def __init__(
        self,
        *,
        base_url: str | None = None,
        model: str | None = None,
        client: httpx.AsyncClient | None = None,
        timeout_sec: float = 120.0,
        chat_template_kwargs: dict[str, Any] | None = None,
    ) -> None:
        self._base_url = base_url
        self._model = model
        self._client = client
        self._timeout_sec = timeout_sec
        self._chat_template_kwargs = chat_template_kwargs

    def _orch_chat_template_kwargs(self) -> dict[str, Any] | None:
        """Template kwargs for llama-server; explicit constructor dict wins over env."""

        if self._chat_template_kwargs is not None:
            return self._chat_template_kwargs if self._chat_template_kwargs else None
        if _env_truthy(os.getenv("EWA_ORCH_LLM_DISABLE_THINKING")):
            return {"enable_thinking": False}
        return None

    async def complete(self, prompt: str, *, variables: Mapping[str, Any] | None = None) -> str:
        raw_variables = dict(variables or {})
        component_before = orchestration_variable_component_utf8(raw_variables)
        vars_dict = dict(raw_variables)
        slim_meta = apply_env_orchestration_llm_slimming(vars_dict)

        observation = vars_dict.get("observation")
        heuristic = vars_dict.get("heuristic_intent")
        domain_hints = vars_dict.get("domain_hints")
        companion_wire = vars_dict.get("companion_wire")
        if not isinstance(observation, Mapping):
            observation = {}
        heuristic_mapping = heuristic if isinstance(heuristic, Mapping) else None
        domain_hints_mapping = domain_hints if isinstance(domain_hints, Mapping) else None
        companion_wire_mapping = companion_wire if isinstance(companion_wire, Mapping) else None

        base = (self._base_url or unified_settings.llama_url).strip().rstrip("/")
        model_raw = (
            self._model or os.getenv("EWA_ORCH_LLM_MODEL", "").strip() or unified_settings.default_ai_model or "mistral"
        ).strip()

        orch_payload = orchestration_turn_llm_user_content(
            observation,
            heuristic_mapping,
            domain_hints=domain_hints_mapping,
            companion_wire=companion_wire_mapping,
        )
        orch_json_utf8 = len(orch_payload.encode("utf-8"))
        user_lines = [
            f"prompt_key={prompt!r}",
            orch_payload,
        ]

        tools_once = planned_tool_schemas()
        tools_json = json.dumps(tools_once, ensure_ascii=False)
        tools_json_utf8 = len(tools_json.encode("utf-8"))
        system_content = _ORCH_SYSTEM_PROMPT + tools_json[:4000]

        tools_hint_appended_utf8 = 0
        if prompt == ORCHESTRATION_LLM_PROMPT_KEY and len(tools_json) > 4000:
            tail = tools_json[4000 : 4000 + 8000]
            th_line = f"tools_hint={tail}"
            tools_hint_appended_utf8 = len(th_line.encode("utf-8"))
            user_lines.append(th_line)

        user_blob = "\n".join(user_lines)
        user_utf8 = len(user_blob.encode("utf-8"))
        sys_utf8 = len(system_content.encode("utf-8"))

        if _env_truthy(os.getenv("EWA_ORCH_LLM_CONTEXT_LOG")):
            component_after = orchestration_variable_component_utf8(vars_dict)
            log_orchestration_llm_context(
                logger,
                component_utf8_before=dict(component_before),
                component_utf8_after=dict(component_after),
                observation_windows=observation_windows_count_for_log(
                    observation if isinstance(observation, Mapping) else None
                ),
                user_content_utf8=user_utf8,
                system_content_utf8=sys_utf8,
                orch_json_utf8=orch_json_utf8,
                tools_hint_appended_utf8=tools_hint_appended_utf8,
                tools_json_utf8=tools_json_utf8,
                slim_meta=slim_meta,
            )

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_blob},
        ]

        timeout = httpx.Timeout(self._timeout_sec)
        orch_response_format: dict[str, Any] = {"type": "json_object"}
        orch_template_kw = self._orch_chat_template_kwargs()
        if logger.isEnabledFor(logging.DEBUG):
            logger.debug(
                "ewa_orch_llm request openai-compat extras: response_format=%r chat_template_kwargs=%r",
                orch_response_format,
                orch_template_kw,
            )
        try:
            if self._client is not None:
                out = await httpx_compat_chat_completion_json(
                    self._client,
                    base,
                    model=model_raw,
                    messages=messages,
                    options={"temperature": 0.2, "num_predict": 512},
                    timeout=timeout,
                    response_format=orch_response_format,
                    chat_template_kwargs=orch_template_kw,
                )
            else:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    out = await httpx_compat_chat_completion_json(
                        client,
                        base,
                        model=model_raw,
                        messages=messages,
                        options={"temperature": 0.2, "num_predict": 512},
                        timeout=timeout,
                        response_format=orch_response_format,
                        chat_template_kwargs=orch_template_kw,
                    )
        except (TimeoutError, httpx.HTTPError, OSError, RuntimeError, ValueError, TypeError) as exc:
            logger.warning("EWA orchestration LLM HTTP failure: %s", exc)
            return '{"intent":null}'

        if out.get("timings") is not None and logger.isEnabledFor(logging.DEBUG):
            logger.debug("ewa_orch_llm llm timings: %s", out.get("timings"))

        text = str(out.get("response", "") or "").strip()
        return text if text else '{"intent":null}'
