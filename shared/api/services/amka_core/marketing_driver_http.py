# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# HTTP-facing entry for marketing AMKA lifecycle actions that delegates to `MarketingCabinetAmkaDriver.act()`
# so approve/resume/continue/cancel flow through the driver boundary without changing response shapes.
# Invariants:
# - Callers must have already enforced Marketing Cabinet auth; `AmkaPolicyDecision` is allowed here
#   because HTTP routes own the user gate.
# - Skip lists are passed only via subject metadata keys consumed by `MarketingCabinetAmkaDriver.act()`.
# Related:
# - shared/api/services/amka_core/marketing_driver.py
# - shared/api/routers/marketing_cabinet/amka.py
# ---
from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from api.services.amka_core.contracts import AmkaPlanTask, AmkaPolicyDecision, AmkaSubjectRef
from api.services.amka_core.marketing_driver import MarketingCabinetAmkaDriver

MarketingAmkaHttpActOp = Literal["approve", "resume", "continue_step", "cancel"]


def _subject_for_http_act(
    *,
    run_id: UUID,
    user_id: UUID,
    operation: MarketingAmkaHttpActOp,
    skip_section_keys: list[str] | None,
    skip_operation_keys: list[str] | None,
    skip_step_ids: list[str] | None,
) -> AmkaSubjectRef:
    base = MarketingCabinetAmkaDriver.subject_for_run(run_id=run_id, user_id=user_id)
    meta: dict[str, str] = dict(base.metadata)
    meta["amka_core_act_operation"] = operation
    # Keep explicit empty-list semantics for HTTP contract tests:
    # absent payload fields still serialize into empty skip lists for service calls.
    meta["amka_core_act_skip_section_keys"] = ",".join(skip_section_keys or [])
    meta["amka_core_act_skip_operation_keys"] = ",".join(skip_operation_keys or [])
    meta["amka_core_act_skip_step_ids"] = ",".join(skip_step_ids or [])
    return AmkaSubjectRef(
        driver_key=base.driver_key,
        domain_profile=base.domain_profile,
        subject_id=base.subject_id,
        display_name=base.display_name,
        metadata=meta,
    )


async def marketing_amka_driver_act_for_http(
    db_pool: asyncpg.Pool,
    *,
    run_id: UUID,
    user_id: UUID,
    operation: MarketingAmkaHttpActOp,
    skip_section_keys: list[str] | None = None,
    skip_operation_keys: list[str] | None = None,
    skip_step_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Run a marketing Cabinet AMKA lifecycle action via the standalone driver `act()` hook."""

    driver = MarketingCabinetAmkaDriver(db_pool)
    subject = _subject_for_http_act(
        run_id=run_id,
        user_id=user_id,
        operation=operation,
        skip_section_keys=skip_section_keys,
        skip_operation_keys=skip_operation_keys,
        skip_step_ids=skip_step_ids,
    )
    task = AmkaPlanTask(
        task_key=f"http-{operation}",
        title=f"Marketing AMKA HTTP {operation}",
        summary="Router-delegated driver act",
    )
    decision = AmkaPolicyDecision(
        allowed=True,
        mode="semi_auto",
        reason="Marketing Cabinet HTTP route authorized this act() delegation.",
    )
    out = await driver.act(subject, task, decision)
    if not out.get("executed"):
        raise RuntimeError(f"marketing_amka_driver_act_for_http: driver.act did not execute ({operation!r}): {out!r}")
    svc_result = out.get("amka_service_result")
    if not isinstance(svc_result, dict):
        raise RuntimeError("marketing_amka_driver_act_for_http: missing amka_service_result dict")
    return svc_result
