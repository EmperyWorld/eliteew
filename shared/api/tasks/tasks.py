# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery task registry imports for package `api.tasks`.
# Invariants:
# - Import-only side effects register task functions; no task should execute during import.
# - All modules under `api.tasks` are imported automatically (except celery bootstrap modules).
# - Task modules outside `api.tasks` keep explicit imports here.
# Related:
# - api/tasks/celery_app.py
# - api/tasks/music_evolution.py
# ---
"""Celery task definitions for package ``api.tasks``."""

import importlib
import pkgutil

import api.tasks as _api_tasks_package


def _import_local_task_modules() -> None:
    """Import every concrete module from `api.tasks` so task decorators register."""
    prefix = f"{_api_tasks_package.__name__}."
    for module_info in sorted(pkgutil.iter_modules(_api_tasks_package.__path__), key=lambda item: item.name):
        module_name = f"{prefix}{module_info.name}"
        if module_name in {"api.tasks.celery_app", "api.tasks.tasks"}:
            continue
        importlib.import_module(module_name)


_import_local_task_modules()

# Register task modules outside `api.tasks` (side-effect: @task defs bind to app).
for _task_module in (
    "api.ewa_platform.workers.daily_rollup_task",
    "api.ewa_platform.workers.episodic_reembed_task",
    "api.ewa_platform.workers.evolution_tick_task",
    "api.ewa_platform.workers.companion_task_runner",
    "api.ewa_platform.workers.agentic_task_runner",
    "api.ewa_platform.workers.agentic_step_runner",
    "api.ewa_platform.workers.factory_task_runner",
    "api.ewa_platform.workers.meta_evolution_sweep_task",
    "api.ewa_platform.workers.turn_dedup_cleanup_task",
):
    importlib.import_module(_task_module)
