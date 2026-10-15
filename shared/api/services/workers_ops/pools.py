# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Expected Celery / RabbitMQ worker pools for Admin overview and online matching.
# Invariants:
# - Hostname prefixes match stack0 baked --hostname=…@%h (general / agentic / companion).
# - Queue coverage from inspect.active_queues is a secondary online signal.
# Related:
# - documentation/platform/docker-re_doc/ADMIN-WORKERS-OPS.md
# - docker/stack/stack0_b.prod-baked.override.yml
# ---
"""Expected worker pool catalog and online heuristics."""

from __future__ import annotations

from typing import Any

# Prod-core baked container names (stack0_b.prod-baked.override.yml) — Overview KPIs.
EXPECTED_WORKER_POOLS: tuple[dict[str, Any], ...] = (
    {
        "id": "celery-general",
        "label": "Celery general",
        "container": "stack0-eliteew-celery-worker-prod-baked",
        "queues": ("short", "maintenance", "broadcast", "ewa_reembed"),
        "hostname_prefixes": ("worker@",),
    },
    {
        "id": "celery-agentic",
        "label": "Celery agentic",
        "container": "stack0-eliteew-celery-agentic-worker-prod-baked",
        "queues": ("ewa_agentic", "ewa_agentic_step", "ewa_factory"),
        "hostname_prefixes": ("agentic-worker@",),
    },
    {
        "id": "celery-companion",
        "label": "Celery companion",
        "container": "stack0-eliteew-celery-companion-worker-prod-baked",
        "queues": ("ewa_companion",),
        "hostname_prefixes": ("companion-worker@",),
    },
    {
        "id": "celery-beat",
        "label": "Celery beat (SPOF)",
        "container": "stack0-eliteew-celery-beat-prod-baked",
        "queues": (),
        "role": "beat",
    },
    {
        "id": "queue-worker",
        "label": "RabbitMQ queue-worker",
        "container": "stack0-eliteew-api-worker-prod-baked",
        "queues": (),
        "role": "rabbitmq",
    },
)


def covered_queues_from_active(active_queues: Any) -> set[str]:
    covered: set[str] = set()
    if not isinstance(active_queues, dict):
        return covered
    for _worker, queues in active_queues.items():
        if not isinstance(queues, list):
            continue
        for q in queues:
            if isinstance(q, dict):
                name = q.get("name")
                if isinstance(name, str) and name.strip():
                    covered.add(name.strip())
            elif isinstance(q, str) and q.strip():
                covered.add(q.strip())
    return covered


def workers_matching_prefixes(
    workers_online: list[str] | set[str] | tuple[str, ...],
    prefixes: tuple[str, ...],
) -> list[str]:
    """Match Celery node names to pool hostname prefixes (most-specific pools use longer prefixes)."""
    if not prefixes:
        return []
    # Prefer longer prefixes first so agentic-worker@ does not fall under worker@.
    ordered = sorted(prefixes, key=len, reverse=True)
    matched: list[str] = []
    for worker in sorted({str(w) for w in workers_online}):
        lower = worker.lower()
        for prefix in ordered:
            pref = prefix.lower()
            if lower.startswith(pref):
                # General pool uses worker@ — exclude agentic/companion hostnames.
                if pref == "worker@" and (lower.startswith("agentic-worker@") or lower.startswith("companion-worker@")):
                    continue
                matched.append(worker)
                break
    return matched


def match_expected_pools(celery_slice: dict[str, Any], beat_slice: dict[str, Any]) -> list[dict[str, Any]]:
    """Mark expected pools online/offline from inspect hostnames, queues, and beat health."""
    covered_queues = covered_queues_from_active(celery_slice.get("active_queues"))
    workers_online = [str(w) for w in (celery_slice.get("workers_online") or [])]

    beat_ok = False
    if isinstance(beat_slice, dict):
        beat_status = str(beat_slice.get("status") or "").lower()
        stale = bool(beat_slice.get("stale"))
        beat_ok = beat_status in ("ok", "healthy", "up") and not stale
        if beat_slice.get("last_success_unix") is not None and not stale:
            beat_ok = True

    rows: list[dict[str, Any]] = []
    for pool in EXPECTED_WORKER_POOLS:
        role = pool.get("role")
        queues = tuple(pool.get("queues") or ())
        prefixes = tuple(pool.get("hostname_prefixes") or ())
        matched_workers = workers_matching_prefixes(workers_online, prefixes)
        queue_hit = any(q in covered_queues for q in queues) if queues else False

        if role == "beat":
            online: bool | None = beat_ok
            reason = "beat_health" if beat_ok else "beat_stale_or_missing"
        elif role == "rabbitmq":
            online = None  # filled by snapshot from rabbitmq plane
            reason = "rabbitmq_pending"
        else:
            online = bool(matched_workers) or queue_hit
            if matched_workers and queue_hit:
                reason = "hostname+queues"
            elif matched_workers:
                reason = "hostname"
            elif queue_hit:
                reason = "queues"
            else:
                reason = "no_inspect_reply"

        rows.append(
            {
                "id": pool["id"],
                "label": pool["label"],
                "container": pool["container"],
                "queues": list(queues),
                "role": role or "celery",
                "online": online,
                "matched_workers": matched_workers,
                "online_reason": reason,
            }
        )
    return rows
