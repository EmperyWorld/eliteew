# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pure dry-run capacity model for EWA E7 evidence. It projects worker slots, Celery rate limits,
# reaper clearance, and rough EWA DB-pool pressure from documented production constants.
# Invariants:
# - No Redis, Postgres, Celery, HTTP, or filesystem access.
# - Defaults mirror prod-baked E0 worker split, E1/E6 reaper cadence, and E4 worker pool sizing.
# - Active-user mix is an explicit assumption and must stay overridable by callers.
# Related:
# - docker/stack/stack0_b.prod-baked.override.yml
# - api/tasks/celery_app.py
# - documentation/product/ewa/EWA-CAPACITY-MODEL-E7-2026-07-09.md
# ---

from __future__ import annotations

from dataclasses import asdict, dataclass, fields, replace
from typing import Literal, TypedDict, cast

CapacityVerdict = Literal["ok", "at_risk", "blocked"]
BottleneckSeverity = Literal["low", "medium", "high"]


@dataclass(frozen=True, slots=True)
class CapacityConfig:
    """Dry-run inputs for EWA capacity modeling.

    Active mix assumptions are intentionally simple: each fraction describes a share of principals
    with one active unit of work in that plane. Rate-limit demand assumes one enqueue per active job
    per minute, amortized across companion, agentic, and media work.
    """

    general_concurrency: int = 4
    agentic_concurrency: int = 2
    companion_concurrency: int = 2
    celery_global_rate_limit_per_min: int = 100
    reaper_batch_limit: int = 50
    reaper_interval_sec: int = 180
    music_stale_sec: int = 1200
    image_stale_sec: int = 1800
    presentation_stale_sec: int = 1800
    generic_stale_sec: int = 600
    music_max_concurrent_per_principal: int = 1
    image_catalog_max_concurrent_per_principal: int = 1
    # E8 / V-M1: image handler enforces catalog cap before enqueue (parity with music).
    image_capacity_enforced: bool = True
    # E8 / V-M6: agentic + companion + maintenance reapers are exempt from global 100/m.
    celery_ewa_lanes_rate_limit_exempt: bool = True
    ewa_worker_pool_max_size: int = 4
    prefetch_multiplier: int = 1
    fraction_active_companion_jobs: float = 0.05
    fraction_active_agentic: float = 0.02
    fraction_active_media: float = 0.03

    @classmethod
    def from_mapping(cls, values: dict[str, object] | None) -> CapacityConfig:
        """Build a config from a partial JSON-compatible mapping."""

        if not values:
            return cls()
        allowed = {f.name for f in fields(cls)}
        unknown = sorted(set(values) - allowed)
        if unknown:
            raise ValueError(f"unknown CapacityConfig keys: {', '.join(unknown)}")

        cfg = cls()
        updates: dict[str, object] = {}
        for f in fields(cls):
            if f.name not in values:
                continue
            raw = values[f.name]
            current = getattr(cfg, f.name)
            if isinstance(current, int) and not isinstance(current, bool):
                updates[f.name] = _positive_int(raw, field_name=f.name)
            elif isinstance(current, float):
                updates[f.name] = _fraction(raw, field_name=f.name)
            else:
                updates[f.name] = raw
        return replace(cfg, **updates)


class BottleneckReport(TypedDict):
    id: str
    severity: BottleneckSeverity
    related_vuln_ids: list[str]
    summary: str
    observed: float
    capacity: float
    pressure_ratio: float


class SlotPressureReport(TypedDict):
    plane: str
    expected_concurrent_jobs: float
    configured_concurrency: int
    effective_slots: int
    pressure_ratio: float


class RateLimitReport(TypedDict):
    tasks_per_min_needed: float
    limit_per_min: int
    headroom_per_min: float
    utilization_ratio: float


class ReaperReport(TypedDict):
    assumed_media_orphan_backlog: float
    clearance_per_min_per_domain: float
    clearance_per_hour_per_domain: float
    time_to_clear_hours: float
    music_stale_sec: int
    image_stale_sec: int
    presentation_stale_sec: int
    generic_stale_sec: int


class PoolPressureReport(TypedDict):
    expected_concurrent_db_users: float
    rough_pool_capacity: int
    pressure_ratio: float


class ExpectedWorkReport(TypedDict):
    companion_jobs: float
    agentic_jobs: float
    media_jobs: float
    total_active_jobs: float


class CapacityReport(TypedDict):
    principals: int
    verdict: CapacityVerdict
    assumptions: dict[str, float | int]
    expected_concurrent: ExpectedWorkReport
    slot_pressure: list[SlotPressureReport]
    rate_limit: RateLimitReport
    reaper_clearance: ReaperReport
    pool_pressure: PoolPressureReport
    bottlenecks: list[BottleneckReport]


def evaluate_capacity(principals: int, *, cfg: CapacityConfig | None = None) -> CapacityReport:
    """Evaluate EWA capacity pressure for ``principals`` without touching runtime services."""

    if principals <= 0:
        raise ValueError("principals must be positive")

    active_cfg = cfg or CapacityConfig()
    companion_jobs = _round2(principals * active_cfg.fraction_active_companion_jobs)
    agentic_jobs = _round2(principals * active_cfg.fraction_active_agentic)
    media_jobs = _round2(principals * active_cfg.fraction_active_media)
    total_active_jobs = _round2(companion_jobs + agentic_jobs + media_jobs)

    companion_plane_jobs = _round2(companion_jobs + media_jobs)
    slot_pressure = [
        _slot_pressure(
            plane="general",
            expected_concurrent_jobs=_round2(_reaper_tasks_per_min(active_cfg) / 60.0),
            configured_concurrency=active_cfg.general_concurrency,
            prefetch_multiplier=active_cfg.prefetch_multiplier,
        ),
        _slot_pressure(
            plane="agentic",
            expected_concurrent_jobs=agentic_jobs,
            configured_concurrency=active_cfg.agentic_concurrency,
            prefetch_multiplier=active_cfg.prefetch_multiplier,
        ),
        _slot_pressure(
            plane="companion",
            expected_concurrent_jobs=companion_plane_jobs,
            configured_concurrency=active_cfg.companion_concurrency,
            prefetch_multiplier=active_cfg.prefetch_multiplier,
        ),
    ]

    tasks_per_min_needed = total_active_jobs
    rate_limit: RateLimitReport = {
        "tasks_per_min_needed": tasks_per_min_needed,
        "limit_per_min": active_cfg.celery_global_rate_limit_per_min,
        "headroom_per_min": _round2(active_cfg.celery_global_rate_limit_per_min - tasks_per_min_needed),
        "utilization_ratio": _ratio(tasks_per_min_needed, active_cfg.celery_global_rate_limit_per_min),
    }

    clearance_per_min = _ratio(active_cfg.reaper_batch_limit, active_cfg.reaper_interval_sec / 60.0)
    clearance_per_hour = clearance_per_min * 60.0
    time_to_clear_hours = _ratio(media_jobs, clearance_per_hour)
    reaper_clearance: ReaperReport = {
        "assumed_media_orphan_backlog": media_jobs,
        "clearance_per_min_per_domain": _round2(clearance_per_min),
        "clearance_per_hour_per_domain": _round2(clearance_per_hour),
        "time_to_clear_hours": _round2(time_to_clear_hours),
        "music_stale_sec": active_cfg.music_stale_sec,
        "image_stale_sec": active_cfg.image_stale_sec,
        "presentation_stale_sec": active_cfg.presentation_stale_sec,
        "generic_stale_sec": active_cfg.generic_stale_sec,
    }

    rough_pool_capacity = active_cfg.companion_concurrency * active_cfg.ewa_worker_pool_max_size
    pool_pressure: PoolPressureReport = {
        "expected_concurrent_db_users": total_active_jobs,
        "rough_pool_capacity": rough_pool_capacity,
        "pressure_ratio": _ratio(total_active_jobs, rough_pool_capacity),
    }

    bottlenecks = _bottlenecks(
        slot_pressure=slot_pressure,
        rate_limit=rate_limit,
        reaper_clearance=reaper_clearance,
        pool_pressure=pool_pressure,
        media_jobs=media_jobs,
        cfg=active_cfg,
    )
    verdict = _verdict(bottlenecks)

    return {
        "principals": principals,
        "verdict": verdict,
        "assumptions": asdict(active_cfg),
        "expected_concurrent": {
            "companion_jobs": companion_jobs,
            "agentic_jobs": agentic_jobs,
            "media_jobs": media_jobs,
            "total_active_jobs": total_active_jobs,
        },
        "slot_pressure": slot_pressure,
        "rate_limit": rate_limit,
        "reaper_clearance": reaper_clearance,
        "pool_pressure": pool_pressure,
        "bottlenecks": bottlenecks,
    }


def evaluate_capacity_matrix(
    principals_list: tuple[int, ...] = (100, 500, 1000),
    *,
    cfg: CapacityConfig | None = None,
) -> list[CapacityReport]:
    """Evaluate several principal counts with the same config."""

    return [evaluate_capacity(principals, cfg=cfg) for principals in principals_list]


def _positive_int(raw: object, *, field_name: str) -> int:
    try:
        value = int(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be an integer") from exc
    if value <= 0:
        raise ValueError(f"{field_name} must be positive")
    return value


def _fraction(raw: object, *, field_name: str) -> float:
    try:
        value = float(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be a number") from exc
    if value < 0 or value > 1:
        raise ValueError(f"{field_name} must be between 0 and 1")
    return value


def _round2(value: float) -> float:
    return round(float(value), 2)


def _ratio(observed: float, capacity: float) -> float:
    if capacity <= 0:
        return float("inf")
    return _round2(observed / capacity)


def _slot_pressure(
    *,
    plane: str,
    expected_concurrent_jobs: float,
    configured_concurrency: int,
    prefetch_multiplier: int,
) -> SlotPressureReport:
    effective_slots = configured_concurrency * prefetch_multiplier
    return {
        "plane": plane,
        "expected_concurrent_jobs": expected_concurrent_jobs,
        "configured_concurrency": configured_concurrency,
        "effective_slots": effective_slots,
        "pressure_ratio": _ratio(expected_concurrent_jobs, effective_slots),
    }


def _reaper_tasks_per_min(cfg: CapacityConfig) -> float:
    # Conservative recurring maintenance pressure from music/image/presentation/generic reaper domains.
    return 4.0 / (cfg.reaper_interval_sec / 60.0)


def _bottlenecks(
    *,
    slot_pressure: list[SlotPressureReport],
    rate_limit: RateLimitReport,
    reaper_clearance: ReaperReport,
    pool_pressure: PoolPressureReport,
    media_jobs: float,
    cfg: CapacityConfig,
) -> list[BottleneckReport]:
    bottlenecks: list[BottleneckReport] = []
    for item in slot_pressure:
        related = ["E0"]
        if item["plane"] == "companion":
            related = ["E0", "V-M1"]
        elif item["plane"] == "agentic":
            related = ["E0", "V-M6"]
        bottlenecks.append(
            {
                "id": f"{item['plane']}_slots",
                "severity": _pressure_severity(item["pressure_ratio"]),
                "related_vuln_ids": related,
                "summary": f"{item['plane']} worker slot demand vs configured E0 concurrency",
                "observed": item["expected_concurrent_jobs"],
                "capacity": float(item["effective_slots"]),
                "pressure_ratio": item["pressure_ratio"],
            }
        )

    rate_sev = _rate_limit_severity(rate_limit)
    if cfg.celery_ewa_lanes_rate_limit_exempt:
        # E8 / V-M6: EWA agentic/companion/maintenance are exempt; residual is short-queue only.
        if rate_sev == "high":
            rate_sev = "medium"
        elif rate_sev == "medium":
            rate_sev = "low"
        rate_summary = "Global 100/m remains for short queue; EWA agentic/companion/maintenance exempt (E8)"
    else:
        rate_summary = "Global Celery task rate limit headroom at ~1 enqueue/min per active job"
    bottlenecks.append(
        {
            "id": "rate_limit",
            "severity": rate_sev,
            "related_vuln_ids": ["V-M6"],
            "summary": rate_summary,
            "observed": rate_limit["tasks_per_min_needed"],
            "capacity": float(rate_limit["limit_per_min"]),
            "pressure_ratio": rate_limit["utilization_ratio"],
        }
    )
    bottlenecks.append(
        {
            "id": "reaper_clearance",
            "severity": _reaper_severity(reaper_clearance["time_to_clear_hours"]),
            "related_vuln_ids": ["V-M7", "V-H2"],
            "summary": "Worst-case media orphan backlog clearance per reaper domain",
            "observed": reaper_clearance["assumed_media_orphan_backlog"],
            "capacity": reaper_clearance["clearance_per_hour_per_domain"],
            "pressure_ratio": _ratio(
                reaper_clearance["assumed_media_orphan_backlog"],
                reaper_clearance["clearance_per_hour_per_domain"],
            ),
        }
    )
    bottlenecks.append(
        {
            "id": "db_pool_pressure",
            "severity": _pressure_severity(pool_pressure["pressure_ratio"]),
            "related_vuln_ids": ["E4", "V-H2"],
            "summary": "Rough EWA worker DB-pool pressure from active background jobs",
            "observed": pool_pressure["expected_concurrent_db_users"],
            "capacity": float(pool_pressure["rough_pool_capacity"]),
            "pressure_ratio": pool_pressure["pressure_ratio"],
        }
    )
    if cfg.image_capacity_enforced:
        bottlenecks.append(
            {
                "id": "image_capacity_enforcement",
                "severity": "low",
                "related_vuln_ids": ["V-M1"],
                "summary": "Image max_concurrent_per_principal is enforced before Celery enqueue (E8)",
                "observed": media_jobs,
                "capacity": float(cfg.image_catalog_max_concurrent_per_principal),
                "pressure_ratio": _ratio(media_jobs, cfg.image_catalog_max_concurrent_per_principal),
            }
        )
    else:
        image_gap_severity = cast(BottleneckSeverity, "low")
        if media_jobs >= cfg.companion_concurrency * 10:
            image_gap_severity = "high"
        elif media_jobs > 0:
            image_gap_severity = "medium"
        bottlenecks.append(
            {
                "id": "image_capacity_enforcement",
                "severity": image_gap_severity,
                "related_vuln_ids": ["V-M1"],
                "summary": "Catalog advertises image max_concurrent_per_principal but enforcement remains a residual gap",
                "observed": media_jobs,
                "capacity": float(cfg.image_catalog_max_concurrent_per_principal),
                "pressure_ratio": _ratio(media_jobs, cfg.image_catalog_max_concurrent_per_principal),
            }
        )
    bottlenecks.append(
        {
            "id": "beat_spof_residual",
            "severity": "medium",
            "related_vuln_ids": ["V-H2", "E6"],
            "summary": "Metrics expose beat heartbeat, but a single beat process still owns reaper scheduling",
            "observed": 1.0,
            "capacity": 1.0,
            "pressure_ratio": 1.0,
        }
    )
    return bottlenecks


def _pressure_severity(pressure_ratio: float) -> BottleneckSeverity:
    if pressure_ratio >= 10.0:
        return "high"
    if pressure_ratio >= 1.0:
        return "medium"
    return "low"


def _rate_limit_severity(rate_limit: RateLimitReport) -> BottleneckSeverity:
    utilization = rate_limit["utilization_ratio"]
    if utilization > 1.0:
        return "high"
    if utilization >= 0.9:
        return "medium"
    return "low"


def _reaper_severity(time_to_clear_hours: float) -> BottleneckSeverity:
    if time_to_clear_hours >= 2.0:
        return "high"
    if time_to_clear_hours >= 0.5:
        return "medium"
    return "low"


def _verdict(bottlenecks: list[BottleneckReport]) -> CapacityVerdict:
    severities = {item["severity"] for item in bottlenecks}
    if "high" in severities:
        return "blocked"
    if "medium" in severities:
        return "at_risk"
    return "ok"


__all__ = [
    "BottleneckReport",
    "CapacityConfig",
    "CapacityReport",
    "CapacityVerdict",
    "evaluate_capacity",
    "evaluate_capacity_matrix",
]
