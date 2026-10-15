# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Marketing cabinet sub-routers.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""Marketing cabinet sub-routers.

Routers are lazy-loaded so `import api.routers.marketing_cabinet.common` (and contract tests)
do not execute every router module at package import time.
"""

from __future__ import annotations

import importlib
from typing import Any

_LAZY_ROUTERS: dict[str, tuple[str, str]] = {
    "amka_router": ("api.routers.marketing_cabinet.amka", "router"),
    "ai_router": ("api.routers.marketing_cabinet.ai", "router"),
    "analysis_router": ("api.routers.marketing_cabinet.analysis", "router"),
    "campaigns_router": ("api.routers.marketing_cabinet.campaigns", "router"),
    "chat_router": ("api.routers.marketing_cabinet.chat", "router"),
    "client_interaction_router": ("api.routers.marketing_cabinet.client_interaction", "router"),
    "customer_diagnostic_router": ("api.routers.marketing_cabinet.customer_diagnostic", "router"),
    "competitors_router": ("api.routers.marketing_cabinet.competitors", "router"),
    "dashboard_router": ("api.routers.marketing_cabinet.dashboard", "router"),
    "dashboard_layout_templates_router": (
        "api.routers.marketing_cabinet.dashboard_layout_templates",
        "router",
    ),
    "document_autofill_router": ("api.routers.marketing_cabinet.document_autofill", "router"),
    "funnels_router": ("api.routers.marketing_cabinet.funnels", "router"),
    "imc_router": ("api.routers.marketing_cabinet.imc", "router"),
    "jtbd_router": ("api.routers.marketing_cabinet.jtbd", "router"),
    "live_jobs_summary_router": (
        "api.routers.marketing_cabinet.live_jobs_summary",
        "router",
    ),
    "operations_router": ("api.routers.marketing_cabinet.operations", "router"),
    "project_rag_sources_router": ("api.routers.marketing_cabinet.project_rag_sources", "router"),
    "projects_router": ("api.routers.marketing_cabinet.projects", "router"),
    "researches_router": ("api.routers.marketing_cabinet.researches", "router"),
    "segments_router": ("api.routers.marketing_cabinet.segments", "router"),
    "value_proposition_router": ("api.routers.marketing_cabinet.value_proposition", "router"),
}

__all__ = tuple(_LAZY_ROUTERS)  # pyright: ignore[reportUnsupportedDunderAll] — mirrors _LAZY_ROUTERS keys for lazy exports


def __getattr__(name: str) -> Any:
    if name in _LAZY_ROUTERS:
        mod_path, attr = _LAZY_ROUTERS[name]
        mod = importlib.import_module(mod_path)
        return getattr(mod, attr)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted([*__all__, "__all__"])
