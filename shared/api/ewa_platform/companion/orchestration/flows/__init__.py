# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Package for shared orchestration flow helpers extracted from ``task_orchestrator`` during Phase E registry migration.
# Invariants:
# - Flow modules must not import ``task_orchestrator`` (avoid cycles); ``tool_registry`` and orchestrator import flows.
# Related:
# - api/ewa_platform/companion/orchestration/flows/doc_create.py
# - documentation/product/ewa/EWA-COMPANION-BACKGROUND-ORCHESTRATION-MASTER-PLAN.md
# ---
