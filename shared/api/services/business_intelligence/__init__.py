#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Public exports for Business Intelligence analysis services (ES, Tika, Llama, templates).
# Invariants:
# - No WebSocketManager — soft-retired 2026-07-28; realtime is Socket.IO / product WS only.
# - Eager imports are forbidden: site-studio-worker (and other lean images) import
#   ``tika_service`` without installing ``elasticsearch``; package ``__init__`` must not
#   pull ES/Llama at import time.
# Related:
# - documentation/platform/REALTIME-SOCKETIO-AND-WS.md
# - docker/builders/stack0-api/requirements/site-studio-worker.in
# ---
"""Business Intelligence service package exports (lazy)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .business_analyzer import BusinessAnalyzer
    from .elasticsearch_service import ElasticsearchService
    from .llama_ai_service import LlamaAIService
    from .template_engine import TemplateEngine
    from .tika_service import TikaService

__all__ = [
    "BusinessAnalyzer",
    "ElasticsearchService",
    "LlamaAIService",
    "TemplateEngine",
    "TikaService",
]

_LAZY_EXPORTS: dict[str, tuple[str, str]] = {
    "BusinessAnalyzer": (".business_analyzer", "BusinessAnalyzer"),
    "ElasticsearchService": (".elasticsearch_service", "ElasticsearchService"),
    "LlamaAIService": (".llama_ai_service", "LlamaAIService"),
    "TemplateEngine": (".template_engine", "TemplateEngine"),
    "TikaService": (".tika_service", "TikaService"),
}


def __getattr__(name: str) -> Any:
    target = _LAZY_EXPORTS.get(name)
    if target is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    module_name, attr = target
    from importlib import import_module

    mod = import_module(module_name, __name__)
    value = getattr(mod, attr)
    globals()[name] = value
    return value


def __dir__() -> list[str]:
    return sorted({*globals().keys(), *__all__})
