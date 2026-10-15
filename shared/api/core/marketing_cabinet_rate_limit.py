# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `core/marketing_cabinet_rate_limit.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""
Чистая логика лимита AI маркетингового кабинета (значение из env / unified_settings).
Без импорта FastAPI/Pydantic — удобно для unit-тестов без полного venv.
"""


def clamp_marketing_dashboard_write_per_minute(raw: object) -> int:
    """Лимит PATCH/POST виджетов и макета дашборда (по пользователю, в минуту)."""
    try:
        return max(20, min(300, int(raw)))  # type: ignore[arg-type]
    except (TypeError, ValueError):  # fmt: skip
        return 120


def clamp_marketing_cabinet_ai_per_minute(raw: object) -> int:
    """
    Согласовано с `routers/marketing_cabinet/rate_limit.py`: 10..60 req/min, иначе 30.
    """
    try:
        return max(10, min(60, int(raw)))  # type: ignore[arg-type]
    except (TypeError, ValueError):  # fmt: skip
        return 30
