# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 3 LLM redesign: shared interactive vs deep job-class URL resolution.
# Invariants:
# - Default job class is interactive (``.111`` / ``LLAMA_URL``).
# - Deep never silently falls back onto interactive under load — missing deep URL → explicit error.
# Related:
# - documentation/platform/LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md §6 / Phase 3–4
# - api/services/desktop_chat/llm/runtime.py
# - api/ewa_platform/companion/turn/turn_llm_runtime.py
# ---
"""Resolve chat LLM base URL by job class (interactive | deep)."""

from __future__ import annotations

import logging
import os
from typing import Literal

from api.core.unified_config import unified_settings

logger = logging.getLogger(__name__)

LlmJobClass = Literal["interactive", "deep"]

_DEEP_URL_ENV = "LLAMA_DEEP_URL"


class DeepLlmUnavailableError(RuntimeError):
    """Deep job class requested but ``LLAMA_DEEP_URL`` is unset (deep host not configured)."""


def normalize_llm_job_class(raw: str | None) -> LlmJobClass:
    v = (raw or "interactive").strip().lower()
    if v in ("deep", "research", "heavy"):
        return "deep"
    return "interactive"


def resolve_llm_base_url(*, job_class: LlmJobClass | str | None = "interactive") -> str:
    """Return OpenAI-compat base URL (no trailing slash) for the job class.

    - ``interactive`` → ``unified_settings.llama_url`` (prod-core stack2 chat).
    - ``deep`` → env ``LLAMA_DEEP_URL`` only; raises ``DeepLlmUnavailableError`` if empty
      (never steals interactive slots on ``.111``).
    """

    raw = job_class if isinstance(job_class, str) else (job_class or "interactive")
    jc = normalize_llm_job_class(raw if isinstance(raw, str) else "interactive")
    if jc == "deep":
        deep = (os.getenv(_DEEP_URL_ENV) or "").strip().rstrip("/")
        if not deep:
            logger.info("[STEP] llm_deep_url_unavailable env=%s", _DEEP_URL_ENV)
            raise DeepLlmUnavailableError(
                f"{_DEEP_URL_ENV} is unset; deep job class unavailable until LLAMA_DEEP_URL is configured"
            )
        return deep
    return (unified_settings.llama_url or "").strip().rstrip("/")


__all__ = [
    "DeepLlmUnavailableError",
    "LlmJobClass",
    "normalize_llm_job_class",
    "resolve_llm_base_url",
]
