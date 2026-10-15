# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Layer E lock: companion task persistence lives in companion_task_asyncpg and stays
# reachable via companion_asyncpg facade attributes (stable import / monkeypatch paths).
# Invariants:
# - Facade attributes are the same callables as the task module.
# Related:
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# - api/ewa_platform/persistence_pg/companion_task_asyncpg.py
# ---

from __future__ import annotations

import pytest

from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.persistence_pg import companion_task_asyncpg as companion_task_pg

_FACADE_TASK_SYMBOLS = (
    "companion_task_run_create",
    "companion_task_run_update",
    "companion_task_run_fetch",
    "companion_task_run_fetch_for_principal",
    "companion_task_run_mirror_sync",
    "companion_task_step_create",
    "companion_task_step_update",
    "companion_task_steps_list",
    "companion_task_runs_list",
    "companion_task_count_active_music_runs",
    "companion_task_count_active_image_runs",
    "companion_task_count_active_presentation_runs",
    "_task_run_from_row",
    "_effective_parent_run_id",
)


@pytest.mark.unit
def test_companion_task_symbols_reexported_from_facade() -> None:
    for name in _FACADE_TASK_SYMBOLS:
        assert hasattr(companion_pg, name), name
        assert hasattr(companion_task_pg, name), name
        assert getattr(companion_pg, name) is getattr(companion_task_pg, name), name
