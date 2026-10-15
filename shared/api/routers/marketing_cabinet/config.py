# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Конфигурация маркетингового кабинета.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
Конфигурация маркетингового кабинета.

Лимиты для build_project_context и format_project_context_for_prompt.
"""

# Лимиты выборки в build_project_context (сколько записей загружать из БД)
CONTEXT_LIMIT_JOB_STORIES = 8
CONTEXT_LIMIT_VALUE_PROPOSITIONS = 5
CONTEXT_LIMIT_COMPETITORS = 6
CONTEXT_LIMIT_RESEARCHES = 6
CONTEXT_LIMIT_CONTENT = 6
CONTEXT_LIMIT_SWOT_FACTORS = 12

# Лимиты для промпта (сколько записей включать в текст для AI)
PROMPT_LIMIT_JOB_STORIES = 6
PROMPT_LIMIT_VALUE_PROPOSITIONS = 4
PROMPT_LIMIT_COMPETITORS = 5
PROMPT_LIMIT_RESEARCHES = 4
PROMPT_LIMIT_CONTENT = 5
PROMPT_LIMIT_SWOT_FACTORS_PER_TYPE = 3
