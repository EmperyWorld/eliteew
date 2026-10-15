# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Factory Intention service — enqueue, pause/resume, tick (Wave F5–F6).
# Invariants:
# - Autonomous OFF → plan→verify→done; never implement writes.
# - LLM/API outage → pause with reason (caller may invoke pause_for_outage).
# - Plan/verify ticks record factory atoms + inject context_pack into checkpoint.
# Related:
# - documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md
# ---

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from api.ewa_platform.factory.atoms import (
    FactoryAtomKind,
    FactoryAtomStore,
    get_factory_atom_store,
    record_factory_atom,
    reset_factory_atom_store_for_tests,
)
from api.ewa_platform.factory.config import (
    factory_autonomous_enabled,
    factory_max_fix_loops,
)
from api.ewa_platform.factory.context_pack import (
    build_context_pack,
    summarize_atoms_for_checkpoint,
)
from api.ewa_platform.factory.models import (
    TERMINAL_STATUSES,
    FactoryStage,
    FactoryStatus,
    IntentionRecord,
)
from api.ewa_platform.factory.role_digest import build_plan_checkpoint
from api.ewa_platform.factory.state_machine import (
    FactoryTransitionError,
    apply_cancel,
    apply_pause,
    apply_resume,
    next_stage_after_tick,
)
from api.ewa_platform.factory.store import IntentionStore, MemoryIntentionStore, build_intention_store

logger = logging.getLogger(__name__)


def _utcnow() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class FactoryIntentionService:
    def __init__(
        self,
        store: IntentionStore | None = None,
        atom_store: FactoryAtomStore | None = None,
    ) -> None:
        self._store = store or build_intention_store()
        self._atoms = atom_store or get_factory_atom_store()

    def list_intentions(self) -> list[dict]:
        return [r.to_dict() for r in self._store.list()]

    def get_intention(self, intention_id: str) -> dict | None:
        row = self._store.get(intention_id)
        return row.to_dict() if row else None

    def enqueue(
        self,
        *,
        title: str,
        pack_stems: list[str] | None = None,
        created_by: str | None = None,
        run_ticks: int = 0,
    ) -> dict:
        now = _utcnow()
        record = IntentionRecord(
            id=str(uuid.uuid4()),
            title=(title or "").strip() or "factory intention",
            pack_stems=[str(p).strip() for p in (pack_stems or []) if str(p).strip()],
            status=FactoryStatus.PENDING,
            stage=FactoryStage.QUEUED,
            created_by=created_by,
            created_at=now,
            updated_at=now,
            checkpoint={"enqueued": True},
        )
        self._store.upsert(record)
        logger.info(
            "[STEP] factory_intention_enqueue id=%s packs=%s autonomous=%s",
            record.id,
            record.pack_stems,
            factory_autonomous_enabled(),
        )
        for _ in range(max(0, run_ticks)):
            record = self._tick_record(record)
            if record.status in TERMINAL_STATUSES or record.status == FactoryStatus.PAUSED:
                break
        return record.to_dict()

    def pause(self, intention_id: str, *, reason: str = "operator_pause") -> dict:
        row = self._require(intention_id)
        try:
            row.status = apply_pause(row.status)
        except FactoryTransitionError as exc:
            raise FactoryTransitionError(str(exc)) from exc
        row.pause_reason = reason
        row.updated_at = _utcnow()
        self._store.upsert(row)
        logger.info("[STEP] factory_intention_pause id=%s reason=%s", intention_id, reason)
        return row.to_dict()

    def resume(self, intention_id: str) -> dict:
        row = self._require(intention_id)
        try:
            row.status = apply_resume(row.status)
        except FactoryTransitionError as exc:
            raise FactoryTransitionError(str(exc)) from exc
        row.pause_reason = None
        row.updated_at = _utcnow()
        self._store.upsert(row)
        logger.info("[STEP] factory_intention_resume id=%s", intention_id)
        return row.to_dict()

    def cancel(self, intention_id: str) -> dict:
        row = self._require(intention_id)
        try:
            row.status = apply_cancel(row.status)
        except FactoryTransitionError as exc:
            raise FactoryTransitionError(str(exc)) from exc
        row.updated_at = _utcnow()
        self._store.upsert(row)
        return row.to_dict()

    def tick(self, intention_id: str, *, verify_passed: bool = True) -> dict:
        row = self._require(intention_id)
        if row.status == FactoryStatus.PAUSED:
            raise FactoryTransitionError("paused — resume before tick")
        if row.status in TERMINAL_STATUSES:
            raise FactoryTransitionError(f"terminal status={row.status}")
        row = self._tick_record(row, verify_passed=verify_passed)
        return row.to_dict()

    def pause_for_outage(self, intention_id: str, *, reason: str = "llm_unavailable") -> dict:
        return self.pause(intention_id, reason=reason)

    def kill_all_active(
        self,
        *,
        mode: str = "cancel",
        reason: str = "admin_kill_switch",
    ) -> dict:
        """Wave G3 Admin kill switch — pause or cancel every non-terminal intention."""

        mode_norm = (mode or "cancel").strip().lower()
        if mode_norm not in {"cancel", "pause"}:
            raise ValueError("mode must be cancel|pause")

        paused: list[dict] = []
        cancelled: list[dict] = []
        skipped: list[dict] = []

        for row in self._store.list():
            if row.status in TERMINAL_STATUSES:
                skipped.append(
                    {
                        "id": row.id,
                        "status": str(row.status),
                        "reason": "terminal",
                    }
                )
                continue
            if mode_norm == "pause":
                if row.status == FactoryStatus.PAUSED:
                    skipped.append(
                        {
                            "id": row.id,
                            "status": str(row.status),
                            "reason": "already_paused",
                        }
                    )
                    continue
                try:
                    item = self.pause(row.id, reason=reason)
                except FactoryTransitionError as exc:
                    skipped.append(
                        {
                            "id": row.id,
                            "status": str(row.status),
                            "reason": str(exc),
                        }
                    )
                    continue
                paused.append({"id": item["id"], "status": item["status"]})
                continue

            try:
                item = self.cancel(row.id)
            except FactoryTransitionError as exc:
                skipped.append(
                    {
                        "id": row.id,
                        "status": str(row.status),
                        "reason": str(exc),
                    }
                )
                continue
            cancelled.append({"id": item["id"], "status": item["status"]})

        logger.info(
            "[STEP] factory_kill_all mode=%s paused=%s cancelled=%s skipped=%s",
            mode_norm,
            len(paused),
            len(cancelled),
            len(skipped),
        )
        return {
            "mode": mode_norm,
            "reason": reason,
            "paused": paused,
            "cancelled": cancelled,
            "skipped": skipped,
            "affected": len(paused) + len(cancelled),
        }

    def _require(self, intention_id: str) -> IntentionRecord:
        row = self._store.get(intention_id)
        if row is None:
            raise KeyError(intention_id)
        return row

    def _tick_record(
        self,
        row: IntentionRecord,
        *,
        verify_passed: bool = True,
    ) -> IntentionRecord:
        autonomous = factory_autonomous_enabled()
        max_fix = factory_max_fix_loops()

        if row.stage == FactoryStage.QUEUED:
            row.status = FactoryStatus.RUNNING

        if row.stage in {FactoryStage.QUEUED, FactoryStage.PLAN} and not row.checkpoint.get("recipe_index_digest"):
            row.checkpoint = {
                **row.checkpoint,
                **build_plan_checkpoint(pack_stems=row.pack_stems, title=row.title),
            }
            row.design_path = f".cursor/orchestration/reports/factory_plan_{row.id[:8]}.md"

        stage_before = row.stage
        new_stage, new_status, pause_reason = next_stage_after_tick(
            stage=row.stage,
            autonomous=autonomous,
            verify_passed=verify_passed,
            fix_loops=row.fix_loops,
            max_fix_loops=max_fix,
        )

        if stage_before == FactoryStage.VERIFY and new_stage == FactoryStage.FIX:
            row.fix_loops += 1
        if stage_before == FactoryStage.VERIFY and new_status == FactoryStatus.COMPLETED:
            row.verify_status = "PASSED"
            row.report_path = row.report_path or (f".cursor/orchestration/reports/factory_verify_{row.id[:8]}.md")
        if stage_before == FactoryStage.VERIFY and new_status == FactoryStatus.FAILED:
            row.verify_status = "FAILED"

        if new_stage == FactoryStage.IMPLEMENT and not autonomous:
            # Safety: should not happen; FSM already skips implement when autonomous off
            new_stage, new_status, pause_reason = (
                FactoryStage.VERIFY,
                FactoryStatus.RUNNING,
                None,
            )

        row.stage = new_stage
        row.status = new_status
        row.attempt += 1
        row.pause_reason = pause_reason
        if pause_reason:
            row.status = FactoryStatus.PAUSED
        row.updated_at = _utcnow()

        # Wave F6: persist decision/verify atoms + inject context pack
        if stage_before in {FactoryStage.QUEUED, FactoryStage.PLAN} and new_stage != FactoryStage.QUEUED:
            record_factory_atom(
                self._atoms,
                kind=FactoryAtomKind.DECISION,
                intention_id=row.id,
                summary=f"plan packs={row.pack_stems} title={row.title}",
                payload={
                    "pack_stems": list(row.pack_stems),
                    "autonomous": autonomous,
                    "next_stage": str(new_stage),
                },
                tags=["factory", "plan"],
            )
        if stage_before == FactoryStage.VERIFY:
            record_factory_atom(
                self._atoms,
                kind=FactoryAtomKind.VERIFY,
                intention_id=row.id,
                summary=f"verify status={row.verify_status or new_status}",
                payload={
                    "verify_status": row.verify_status,
                    "verify_passed": verify_passed,
                    "fix_loops": row.fix_loops,
                },
                tags=["factory", "verify"],
            )

        atoms_now = self._atoms.list_for_intention(row.id)
        context = build_context_pack(
            self._atoms,
            intention_id=row.id,
            stage=new_stage,
        )
        row.checkpoint = {
            **row.checkpoint,
            "last_tick_stage": str(stage_before),
            "autonomous": autonomous,
            "attempt": row.attempt,
            "context_pack": context,
            "atoms": summarize_atoms_for_checkpoint(atoms_now),
        }
        self._store.upsert(row)
        logger.info(
            "[STEP] factory_intention_tick id=%s %s→%s status=%s atoms=%s",
            row.id,
            stage_before,
            row.stage,
            row.status,
            len(atoms_now),
        )
        return row


_SERVICE: FactoryIntentionService | None = None


def get_factory_service() -> FactoryIntentionService:
    global _SERVICE
    if _SERVICE is None:
        _SERVICE = FactoryIntentionService()
    return _SERVICE


def reset_factory_service_for_tests(
    store: IntentionStore | None = None,
    atom_store: FactoryAtomStore | None = None,
) -> FactoryIntentionService:
    """Test helper — replace singleton with memory stores."""

    global _SERVICE
    atoms = reset_factory_atom_store_for_tests(atom_store)
    _SERVICE = FactoryIntentionService(
        store=store or MemoryIntentionStore(),
        atom_store=atoms,
    )
    return _SERVICE
