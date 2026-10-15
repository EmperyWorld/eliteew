# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Defines the AMKA core contracts that can be reused outside the marketing cabinet.
# The module is deliberately free of database, HTTP, and marketing-domain imports.
# Invariants:
# - Domain data stays behind drivers; core types carry normalized views and traces only.
# - Risk and approval decisions are explicit data, never hidden in prompt text.
# Related:
# - documentation/product/amka-seed-album/VISION-VECTORS.md
# - shared/api/services/amka_core/engine.py
# ---
from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Protocol, runtime_checkable


class AmkaCoreStage(StrEnum):
    SNAPSHOT = "snapshot"
    AUDIT = "audit"
    PLAN = "plan"
    APPROVAL = "approval"
    EXECUTE = "execute"
    FINAL = "final"


class AmkaCoreRunStatus(StrEnum):
    PLANNING = "planning"
    AWAITING_APPROVAL = "awaiting_approval"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AmkaRiskLevel(StrEnum):
    READ_ONLY = "read_only"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    DESTRUCTIVE = "destructive"


@dataclass(frozen=True, slots=True)
class AmkaSubjectRef:
    """A domain-owned object AMKA can inspect or improve through a driver."""

    driver_key: str
    domain_profile: str
    subject_id: str
    display_name: str = ""
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class AmkaSnapshot:
    """Normalized state visible to AMKA core at the start of a run."""

    subject: AmkaSubjectRef
    health: Mapping[str, Any] = field(default_factory=dict)
    context_text: str = ""
    entities: Mapping[str, Any] = field(default_factory=dict)
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class AmkaPlanOperation:
    """A normalized operation proposed by a domain driver."""

    operation_key: str
    kind: str
    title: str
    risk: AmkaRiskLevel = AmkaRiskLevel.LOW
    reversible: bool = True
    requires_approval: bool = True
    payload: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class AmkaPlanTask:
    """A unit of planned work independent of a concrete domain schema."""

    task_key: str
    title: str
    summary: str = ""
    risk: AmkaRiskLevel = AmkaRiskLevel.LOW
    dependencies: Sequence[str] = field(default_factory=tuple)
    operations: Sequence[AmkaPlanOperation] = field(default_factory=tuple)
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class AmkaPolicyDecision:
    """Decision that gates execution after planning."""

    allowed: bool
    mode: str = "semi_auto"
    reason: str = ""
    denied_operation_keys: Sequence[str] = field(default_factory=tuple)
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class AmkaTraceEvent:
    """Small event suitable for logs, UI timelines, and exported artifacts."""

    stage: AmkaCoreStage
    event: str
    message: str = ""
    payload: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class AmkaPulseArtifact:
    """Human-facing aftertaste of a run: certainty, doubt, memory, and restraint."""

    summary: str
    changed: Sequence[str] = field(default_factory=tuple)
    preserved: Sequence[str] = field(default_factory=tuple)
    doubts: Sequence[str] = field(default_factory=tuple)
    agreements: Sequence[str] = field(default_factory=tuple)
    no_change_reason: str | None = None
    next_safe_step: str | None = None

    @property
    def recommends_no_change(self) -> bool:
        return bool(self.no_change_reason)


@dataclass(frozen=True, slots=True)
class AmkaRunResult:
    """Result returned by the standalone AMKA core engine."""

    status: AmkaCoreRunStatus
    subject: AmkaSubjectRef
    snapshot: AmkaSnapshot | None = None
    tasks: Sequence[AmkaPlanTask] = field(default_factory=tuple)
    policy: AmkaPolicyDecision | None = None
    traces: Sequence[AmkaTraceEvent] = field(default_factory=tuple)
    pulse: AmkaPulseArtifact | None = None
    observations: Mapping[str, Any] = field(default_factory=dict)


@runtime_checkable
class AmkaDriver(Protocol):
    """Driver boundary between AMKA core and one domain implementation."""

    driver_key: str
    domain_profile: str

    async def read(self, subject: AmkaSubjectRef) -> AmkaSnapshot:
        """Return the domain-owned state as a normalized snapshot."""

        ...

    async def plan(self, subject: AmkaSubjectRef, snapshot: AmkaSnapshot) -> Sequence[AmkaPlanTask]:
        """Return candidate work without mutating domain state."""

        ...

    async def policy(
        self,
        subject: AmkaSubjectRef,
        snapshot: AmkaSnapshot,
        tasks: Sequence[AmkaPlanTask],
    ) -> AmkaPolicyDecision:
        """Decide whether tasks may run automatically or need an operator gate."""

        ...

    async def act(
        self,
        subject: AmkaSubjectRef,
        task: AmkaPlanTask,
        decision: AmkaPolicyDecision,
    ) -> Mapping[str, Any]:
        """Execute or delegate one normalized task."""

        ...

    async def observe(self, subject: AmkaSubjectRef) -> Mapping[str, Any]:
        """Return current long-running status and artifact versions."""

        ...

    async def pulse(
        self,
        subject: AmkaSubjectRef,
        snapshot: AmkaSnapshot,
        tasks: Sequence[AmkaPlanTask],
        traces: Sequence[AmkaTraceEvent],
    ) -> AmkaPulseArtifact:
        """Create the human-facing pulse artifact for the run."""

        ...
