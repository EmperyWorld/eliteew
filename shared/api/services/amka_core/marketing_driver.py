# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Adapts the current marketing-cabinet AMKA implementation to the standalone driver contract.
# HTTP approve/resume/continue-step/cancel delegate through `act()` via `marketing_driver_http`;
# asyncio plan/execute/auto-chain phases schedule through `schedule_background_plan` /
# `schedule_background_execute` / `schedule_background_auto_chain`
# (lifecycle/plan/execute via `amka_driver_background_schedule` to avoid import cycles).
# Core-aligned tooling may opt into act() via explicit subject metadata.
# Invariants:
# - Marketing-specific section keys, RAG, IMC, UGS, and mutation services stay behind this driver.
# - When subject.metadata use_persisted_master_plan is truthy, plan() maps DB master_plan only (no LLM replan).
# - act() mutates only when policy allows and subject.metadata amka_core_act_operation is approve|resume|continue_step|cancel.
# - schedule_background_plan/execute/auto_chain reuse `_spawn_background` task keys for parity with cancel-run.
# - The adapter must not create new DB pools; it receives the existing asyncpg pool from FastAPI DI.
# Related:
# - shared/api/services/marketing_cabinet/amka_service.py
# - shared/api/services/amka_core/contracts.py
# - shared/api/services/amka_core/marketing_core_bridge.py
# - shared/api/services/amka_core/marketing_driver_http.py
# - shared/api/services/marketing_cabinet/amka_driver_background_schedule.py
# ---
from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any
from uuid import UUID, uuid4

import asyncpg  # type: ignore[import-not-found]

from api.services.amka_core.contracts import (
    AmkaPlanOperation,
    AmkaPlanTask,
    AmkaPolicyDecision,
    AmkaPulseArtifact,
    AmkaRiskLevel,
    AmkaSnapshot,
    AmkaSubjectRef,
    AmkaTraceEvent,
)
from api.services.marketing_cabinet import amka_background_tasks
from api.services.marketing_cabinet.amka_service import AmkaService
from api.services.marketing_cabinet.amka_service_support import _json_list

_USE_PERSISTED_MASTER_PLAN_KEYS = frozenset({"1", "true", "yes"})
_ACT_SERVICE_OPS = frozenset({"approve", "resume", "continue_step", "cancel"})
_DEFAULT_AMKA_SERVICE_CLS = AmkaService

logger = logging.getLogger(__name__)


def _subject_uses_persisted_master_plan(subject: AmkaSubjectRef) -> bool:
    raw = subject.metadata.get("use_persisted_master_plan")
    return str(raw).strip().lower() in _USE_PERSISTED_MASTER_PLAN_KEYS


def _metadata_string_list(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x).strip() for x in raw if str(x).strip()]
    s = str(raw).strip()
    if not s:
        return []
    return [p.strip() for p in s.split(",") if p.strip()]


def _metadata_optional_string_list(metadata: Mapping[str, Any], key: str) -> list[str] | None:
    """Return ``None`` when metadata key is absent, else parsed string list (possibly empty)."""

    if key not in metadata:
        return None
    return _metadata_string_list(metadata.get(key))


class MarketingCabinetAmkaDriver:
    """First real AMKA domain driver: the existing marketing cabinet implementation."""

    driver_key = "marketing_cabinet"
    domain_profile = "marketing"

    def __init__(self, db_pool: asyncpg.Pool) -> None:
        self._service = self._resolve_service_cls()(db_pool)

    @staticmethod
    def _resolve_service_cls() -> Any:
        """Resolve service class honoring both local and router monkeypatches in tests."""

        # Unit tests sometimes patch ``marketing_driver.AmkaService`` directly.
        local_service_cls = AmkaService
        if local_service_cls is not _DEFAULT_AMKA_SERVICE_CLS and callable(local_service_cls):
            return local_service_cls

        try:
            from api.routers.marketing_cabinet import amka as amka_router

            service_cls = getattr(amka_router, "AmkaService", local_service_cls)
            if callable(service_cls):
                return service_cls
        except Exception as exc:  # noqa: BLE001 — fall back to local AmkaService (tests / import isolation)
            logger.debug(
                "Marketing AMKA router service class resolve skipped: %s",
                exc,
                exc_info=True,
            )
        return local_service_cls

    @staticmethod
    def subject_for_run(*, run_id: UUID, user_id: UUID, project_id: UUID | None = None) -> AmkaSubjectRef:
        metadata: dict[str, str] = {"user_id": str(user_id)}
        if project_id is not None:
            metadata["project_id"] = str(project_id)
        return AmkaSubjectRef(
            driver_key=MarketingCabinetAmkaDriver.driver_key,
            domain_profile=MarketingCabinetAmkaDriver.domain_profile,
            subject_id=str(run_id),
            display_name="Marketing AMKA run",
            metadata=metadata,
        )

    async def read(self, subject: AmkaSubjectRef) -> AmkaSnapshot:
        run_id, user_id = self._run_and_user(subject)
        raw_snapshot = await self._service._build_run_snapshot(run_id=run_id, user_id=user_id)
        return AmkaSnapshot(
            subject=subject,
            health=dict(raw_snapshot.get("health") or {}),
            context_text=str(raw_snapshot.get("project_context_text") or ""),
            entities={
                "section_entities": raw_snapshot.get("section_entities") or {},
                "source_catalog": raw_snapshot.get("source_catalog") or {},
            },
            metadata={
                "raw_snapshot": raw_snapshot,
                "run_mode": raw_snapshot.get("run_mode"),
                "allowed_sections": list(raw_snapshot.get("allowed_sections") or []),
            },
        )

    async def plan(self, subject: AmkaSubjectRef, snapshot: AmkaSnapshot) -> Sequence[AmkaPlanTask]:
        if _subject_uses_persisted_master_plan(subject):
            return self._plan_tasks_from_persisted_master_plan(snapshot)
        raw_snapshot = self._raw_snapshot(snapshot)
        audit_steps = await self._service._build_section_audits(raw_snapshot)
        master_plan = await self._service._build_master_plan(snapshot=raw_snapshot, audit_steps=audit_steps)
        tasks_raw = master_plan.get("tasks") if isinstance(master_plan, dict) else None
        tasks_list = tasks_raw if isinstance(tasks_raw, list) else []
        return tuple(self._map_task(task) for task in tasks_list if isinstance(task, dict))

    def _plan_tasks_from_persisted_master_plan(self, snapshot: AmkaSnapshot) -> tuple[AmkaPlanTask, ...]:
        raw_snapshot = self._raw_snapshot(snapshot)
        run = raw_snapshot.get("run")
        if not isinstance(run, dict):
            return ()
        mp_raw = run.get("master_plan")
        tasks_list = _json_list(mp_raw) if mp_raw is not None else []
        return tuple(self._map_task(task) for task in tasks_list if isinstance(task, dict))

    async def policy(
        self,
        subject: AmkaSubjectRef,
        snapshot: AmkaSnapshot,
        tasks: Sequence[AmkaPlanTask],
    ) -> AmkaPolicyDecision:
        denied = tuple(
            dict.fromkeys(
                op.operation_key for task in tasks for op in task.operations if op.risk == AmkaRiskLevel.DESTRUCTIVE
            )
        )
        run_mode = str(snapshot.metadata.get("run_mode") or "semi_auto")
        if denied:
            return AmkaPolicyDecision(
                allowed=False,
                mode="semi_auto",
                reason="Marketing AMKA destructive operations require the existing approval endpoint.",
                denied_operation_keys=denied,
            )
        return AmkaPolicyDecision(
            allowed=run_mode == "auto",
            mode=run_mode,
            reason=(
                "Marketing AMKA run is auto-approved by run mode."
                if run_mode == "auto"
                else "Marketing AMKA keeps the operator approval gate."
            ),
        )

    async def act(
        self,
        subject: AmkaSubjectRef,
        task: AmkaPlanTask,
        decision: AmkaPolicyDecision,
    ) -> Mapping[str, Any]:
        run_id, user_id = self._run_and_user(subject)
        if not decision.allowed:
            return {
                "executed": False,
                "reason": "policy_not_allowed",
                "task_key": task.task_key,
                "driver_key": self.driver_key,
            }

        op = str(subject.metadata.get("amka_core_act_operation") or "").strip().lower()
        if op not in _ACT_SERVICE_OPS:
            return {
                "executed": False,
                "delegated": True,
                "task_key": task.task_key,
                "driver_key": self.driver_key,
                "hint": (
                    "Set subject.metadata['amka_core_act_operation'] to approve, resume, continue_step, or cancel "
                    "to invoke AmkaService from act(); default remains non-mutating."
                ),
            }

        skip_sections = _metadata_optional_string_list(subject.metadata, "amka_core_act_skip_section_keys")
        skip_ops = _metadata_optional_string_list(subject.metadata, "amka_core_act_skip_operation_keys")
        skip_steps = _metadata_optional_string_list(subject.metadata, "amka_core_act_skip_step_ids")

        if op == "approve":
            svc_out = await self._service.approve_run(
                run_id=run_id,
                user_id=user_id,
                skip_section_keys=skip_sections,
                skip_operation_keys=skip_ops,
                skip_step_ids=skip_steps,
            )
        elif op == "resume":
            svc_out = await self._service.resume_run(
                run_id=run_id,
                user_id=user_id,
                skip_section_keys=skip_sections,
                skip_operation_keys=skip_ops,
                skip_step_ids=skip_steps,
            )
        elif op == "cancel":
            svc_out = await self._service.cancel_run(run_id=run_id, user_id=user_id)
        else:
            svc_out = await self._service.continue_step_run(run_id=run_id, user_id=user_id)

        return {
            "executed": True,
            "amka_core_act_operation": op,
            "task_key": task.task_key,
            "driver_key": self.driver_key,
            "amka_service_result": svc_out,
        }

    async def observe(self, subject: AmkaSubjectRef) -> Mapping[str, Any]:
        run_id, user_id = self._run_and_user(subject)
        return await self._service.get_run_progress_snapshot(run_id=run_id, user_id=user_id)

    async def pulse(
        self,
        subject: AmkaSubjectRef,
        snapshot: AmkaSnapshot,
        tasks: Sequence[AmkaPlanTask],
        traces: Sequence[AmkaTraceEvent],
    ) -> AmkaPulseArtifact:
        if not tasks:
            return AmkaPulseArtifact(
                summary="AMKA reviewed the marketing run and found no executable work.",
                preserved=("Marketing data remains unchanged.",),
                agreements=("No-op is a valid AMKA decision when evidence is insufficient.",),
                no_change_reason="The marketing driver produced no normalized plan tasks.",
            )
        destructive_unique: dict[str, AmkaPlanOperation] = {}
        for task in tasks:
            for op in task.operations:
                if op.risk != AmkaRiskLevel.DESTRUCTIVE:
                    continue
                if op.operation_key in destructive_unique:
                    continue
                destructive_unique[op.operation_key] = op
        destructive_count = len(destructive_unique)
        doubts: tuple[str, ...] = ()
        if destructive_count:
            sample_ops = list(destructive_unique.values())[:3]
            sample_titles = ", ".join((op.title or op.kind) for op in sample_ops)
            extra = f" (+{destructive_count - len(sample_ops)} more)." if destructive_count > len(sample_ops) else ""
            doubts = (
                f"{destructive_count} destructive operation(s) still need explicit operator attention."
                f" Examples: {sample_titles}.{extra}",
            )
        return AmkaPulseArtifact(
            summary=f"AMKA prepared {len(tasks)} marketing task(s) behind the standalone driver boundary.",
            preserved=("Existing Marketing Cabinet API and database tables remain the source of truth.",),
            doubts=doubts,
            agreements=("Marketing is the first driver, not the place where all AMKA core logic must live.",),
        )

    def schedule_background_plan(self, *, run_id: UUID, user_id: UUID) -> None:
        """Enqueue marketing plan phase (`AmkaService._run_plan_background`) under stable task key `amka-plan:`.

        Delegates to `amka_background_tasks._spawn_background` so cancel-run task bookkeeping stays unchanged.
        """
        from api.services.marketing_cabinet.amka_background_task_keys import amka_plan_task_key

        amka_background_tasks._spawn_background(
            amka_plan_task_key(run_id),
            lambda: self._service._run_plan_background(run_id=run_id, user_id=user_id),
        )

    def schedule_background_execute(self, *, run_id: UUID, user_id: UUID) -> None:
        """Enqueue marketing execute phase under stable task key `amka-exec:` (parity with lifecycle)."""
        from api.services.marketing_cabinet.amka_background_task_keys import amka_exec_task_key

        amka_background_tasks._spawn_background(
            amka_exec_task_key(run_id),
            lambda: self._service._run_execute_background(run_id=run_id, user_id=user_id),
        )

    def schedule_background_auto_chain(self, *, prev_run_id: UUID, user_id: UUID) -> None:
        """Enqueue `maybe_start_next_auto_amka_cycle` after a completed execute (unique key per enqueue)."""
        from api.services.marketing_cabinet.amka_background_task_keys import amka_auto_chain_task_key

        chain_key = amka_auto_chain_task_key(run_id=prev_run_id, unique_suffix=str(uuid4()))
        amka_background_tasks._spawn_background(
            chain_key,
            self._service._maybe_start_next_auto_amka_cycle(prev_run_id=prev_run_id, user_id=user_id),
        )

    @staticmethod
    def _run_and_user(subject: AmkaSubjectRef) -> tuple[UUID, UUID]:
        return UUID(subject.subject_id), UUID(str(subject.metadata["user_id"]))

    @staticmethod
    def _raw_snapshot(snapshot: AmkaSnapshot) -> dict[str, Any]:
        raw = snapshot.metadata.get("raw_snapshot")
        return dict(raw) if isinstance(raw, dict) else {}

    @staticmethod
    def _map_task(raw: Mapping[str, Any]) -> AmkaPlanTask:
        operations = tuple(
            MarketingCabinetAmkaDriver._map_operation(op) for op in raw.get("operations", []) if isinstance(op, dict)
        )
        task_risk = (
            AmkaRiskLevel.DESTRUCTIVE
            if any(op.risk == AmkaRiskLevel.DESTRUCTIVE for op in operations)
            else AmkaRiskLevel.MEDIUM
        )
        return AmkaPlanTask(
            task_key=str(raw.get("plan_task_uid") or raw.get("step_key") or raw.get("section_key") or "task"),
            title=str(raw.get("title") or raw.get("section_key") or "AMKA task"),
            summary=str(raw.get("rationale") or raw.get("expected_effect") or ""),
            risk=task_risk,
            dependencies=tuple(str(item) for item in raw.get("depends_on", []) if str(item).strip()),
            operations=operations,
            metadata={
                "section_key": raw.get("section_key"),
                "execution_mode": raw.get("execution_mode"),
                "write_policy": raw.get("write_policy"),
            },
        )

    @staticmethod
    def _map_operation(raw: Mapping[str, Any]) -> AmkaPlanOperation:
        destructive = bool(raw.get("destructive"))
        risk = AmkaRiskLevel.DESTRUCTIVE if destructive else AmkaRiskLevel.MEDIUM
        return AmkaPlanOperation(
            operation_key=str(raw.get("operation_key") or raw.get("kind") or "operation"),
            kind=str(raw.get("kind") or "unknown"),
            title=str(raw.get("title") or raw.get("reason") or raw.get("kind") or "Operation"),
            risk=risk,
            reversible=not destructive,
            requires_approval=destructive,
            payload=dict(raw.get("payload") or {}),
        )
