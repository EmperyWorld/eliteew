# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Factory Intention record + status/stage enums (Wave F5).
# Invariants:
# - Status and stage are orthogonal: pause freezes stage; cancel is terminal.
# Related:
# - documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md
# ---

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class FactoryStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class FactoryStage(StrEnum):
    QUEUED = "queued"
    PLAN = "plan"
    IMPLEMENT = "implement"
    VERIFY = "verify"
    FIX = "fix"
    DONE = "done"


TERMINAL_STATUSES: frozenset[FactoryStatus] = frozenset(
    {
        FactoryStatus.COMPLETED,
        FactoryStatus.FAILED,
        FactoryStatus.CANCELLED,
    }
)


@dataclass
class IntentionRecord:
    id: str
    title: str
    pack_stems: list[str]
    status: FactoryStatus
    stage: FactoryStage
    attempt: int = 0
    fix_loops: int = 0
    pause_reason: str | None = None
    design_path: str | None = None
    report_path: str | None = None
    verify_status: str | None = None
    checkpoint: dict[str, Any] = field(default_factory=dict)
    created_by: str | None = None
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "pack_stems": list(self.pack_stems),
            "status": str(self.status),
            "stage": str(self.stage),
            "attempt": self.attempt,
            "fix_loops": self.fix_loops,
            "pause_reason": self.pause_reason,
            "design_path": self.design_path,
            "report_path": self.report_path,
            "verify_status": self.verify_status,
            "checkpoint": dict(self.checkpoint),
            "created_by": self.created_by,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> IntentionRecord:
        return cls(
            id=str(data["id"]),
            title=str(data.get("title") or ""),
            pack_stems=[str(x) for x in (data.get("pack_stems") or [])],
            status=FactoryStatus(str(data.get("status") or FactoryStatus.PENDING)),
            stage=FactoryStage(str(data.get("stage") or FactoryStage.QUEUED)),
            attempt=int(data.get("attempt") or 0),
            fix_loops=int(data.get("fix_loops") or 0),
            pause_reason=(str(data["pause_reason"]) if data.get("pause_reason") else None),
            design_path=(str(data["design_path"]) if data.get("design_path") else None),
            report_path=(str(data["report_path"]) if data.get("report_path") else None),
            verify_status=(str(data["verify_status"]) if data.get("verify_status") else None),
            checkpoint=dict(data.get("checkpoint") or {}),
            created_by=(str(data["created_by"]) if data.get("created_by") else None),
            created_at=str(data.get("created_at") or ""),
            updated_at=str(data.get("updated_at") or ""),
        )
