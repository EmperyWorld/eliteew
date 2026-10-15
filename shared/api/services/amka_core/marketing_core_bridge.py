# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Runs AmkaCoreEngine against the production marketing driver for read-only alignment
# (snapshot + persisted master plan + policy + pulse + trace timeline) with execute=False (no act()).
# Invariants:
# - Subject metadata use_persisted_master_plan must be set so plan() never calls the LLM replan path.
# - Optional run_row avoids a duplicate ownership check when the router already loaded the row (ETag path).
# Related:
# - shared/api/services/amka_core/marketing_driver.py
# - shared/api/services/amka_core/engine.py
# - shared/api/routers/marketing_cabinet/amka.py
# ---
from __future__ import annotations

from collections.abc import Mapping
from dataclasses import replace
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.services.amka_core.alignment_payload import serialize_amka_core_alignment_payload
from api.services.amka_core.contracts import AmkaRunResult
from api.services.amka_core.engine import AmkaCoreEngine
from api.services.amka_core.marketing_driver import MarketingCabinetAmkaDriver
from api.services.marketing_cabinet.amka_service import AmkaService

_PERSISTED_PLAN_SENTINEL = "true"


def marketing_amka_core_alignment_weak_etag(*, run_id: UUID, run_row: Mapping[str, Any]) -> str:
    """Weak ETag for core-alignment JSON; shifts when run row `updated_at` or `status` changes."""

    updated_at = run_row.get("updated_at")
    st = run_row.get("status")
    return f'W/"amka-core-align:{run_id}:{updated_at}:{st}"'


def serialize_marketing_amka_core_alignment(result: AmkaRunResult) -> dict[str, Any]:
    """JSON-serializable alignment payload for marketing core-alignment (same shape as other profiles)."""

    return serialize_amka_core_alignment_payload(result)


async def build_marketing_amka_core_alignment(
    db_pool: asyncpg.Pool,
    *,
    run_id: UUID,
    user_id: UUID,
    run_row: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Align marketing run state through AmkaCoreEngine with execute=False."""

    if run_row is not None:
        run = dict(run_row)
    else:
        svc = AmkaService(db_pool)
        run = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=False)
    project_raw = run.get("project_id")
    project_id = UUID(str(project_raw)) if project_raw else None
    base_subject = MarketingCabinetAmkaDriver.subject_for_run(
        run_id=run_id,
        user_id=user_id,
        project_id=project_id,
    )
    subject = replace(
        base_subject,
        metadata={**dict(base_subject.metadata), "use_persisted_master_plan": _PERSISTED_PLAN_SENTINEL},
    )
    driver = MarketingCabinetAmkaDriver(db_pool)
    result = await AmkaCoreEngine(driver).run_once(subject, execute=False)
    return serialize_marketing_amka_core_alignment(result)
