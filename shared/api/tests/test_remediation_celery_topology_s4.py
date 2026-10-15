#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for Celery queue topology, worker healthcheck policy, and companion payload shrinking.
# Invariants:
# - Prod-baked E0: general / agentic / companion workers isolate queues (no collapse).
# - Long EWA companion workloads route to dedicated Celery queues with prefetch multiplier 1.
# - Companion Celery enqueue payloads do not carry rich request payloads when canonical step input is stored in Postgres.
# - Celery worker compose healthchecks use process pgrep, not inspect ping or RabbitMQ aio_pika smoke.
# Related:
# - api/tasks/celery_app.py
# - api/ewa_platform/companion/jobs/enqueue.py
# - docker/stack/stack0_b.prod-baked.override.yml
# - documentation/platform/CELERY-BEAT-AND-QUEUES.md
# ---
"""Celery topology regression tests."""

from __future__ import annotations

from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.unit
def test_celery_topology_declares_dedicated_workload_queues() -> None:
    source = (API_ROOT / "tasks" / "celery_app.py").read_text(encoding="utf-8")
    for queue_name in (
        "short",
        "maintenance",
        "broadcast",
        "ewa_companion",
        "ewa_agentic",
        "ewa_agentic_step",
        "ewa_reembed",
    ):
        assert f'"{queue_name}"' in source
    assert 'CELERY_WORKER_PREFETCH_MULTIPLIER", 1' in source
    assert '"api.ewa_platform.workers.companion_task_runner.companion_run_task"' in source
    assert '"queue": "ewa_companion"' in source
    assert '"api.ewa_platform.workers.agentic_step_runner.agentic_step_task"' in source
    assert '"queue": "ewa_agentic_step"' in source


@pytest.mark.unit
def test_stack0_worker_topology_splits_agentic_step_queue() -> None:
    stack_path = API_ROOT.parents[1] / "docker" / "stack" / "stack0_b.yml"
    if not stack_path.exists():
        pytest.skip("docker/stack is not mounted in immutable API test image")
    source = stack_path.read_text(encoding="utf-8")
    assert "eliteew-celery-agentic-worker-prod:" in source
    assert "ewa_agentic,ewa_agentic_step" in source
    assert "short,maintenance,broadcast,ewa_companion,ewa_agentic,ewa_reembed" not in source
    for service_name in (
        "eliteew-celery-worker-prod:",
        "eliteew-celery-agentic-worker-prod:",
        "eliteew-celery-companion-worker-prod:",
    ):
        block_start = source.index(service_name)
        next_service = source.find("\n  eliteew-", block_start + 1)
        next_comment = source.find("\n  # Ровно один", block_start + 1)
        block_end_candidates = [idx for idx in (next_service, next_comment) if idx != -1]
        block_end = min(block_end_candidates) if block_end_candidates else len(source)
        block = source[block_start:block_end]
        assert "POSTGRES_EXTERNAL_PORT=30000" in block
        assert "REDIS_EXTERNAL_PORT=30001" in block


@pytest.mark.unit
def test_celery_worker_healthcheck_is_process_liveness_not_inspect_ping() -> None:
    """Container health must stay cheap; inspect ping is on-demand only."""

    stack_path = API_ROOT.parents[1] / "docker" / "stack" / "stack0_b.yml"
    lan_path = API_ROOT.parents[1] / "docker" / "stack" / "stack0_b_workers_lan.yml"
    if not stack_path.exists():
        pytest.skip("docker/stack is not mounted in immutable API test image")

    pgrep_worker = "pgrep -f '[c]elery.*worker'"
    celery_service_names = (
        "eliteew-celery-worker-prod:",
        "eliteew-celery-agentic-worker-prod:",
        "eliteew-celery-companion-worker-prod:",
        "eliteew-celery-worker-lan141:",
    )
    for path in (stack_path, lan_path):
        if not path.exists():
            continue
        source = path.read_text(encoding="utf-8")
        assert 'inspect", "ping' not in source, f"{path.name}: celery inspect ping must not be an interval healthcheck"
        celery_blocks: list[str] = []
        for service_name in celery_service_names:
            if service_name not in source:
                continue
            block_start = source.index(service_name)
            next_service = source.find("\n  eliteew-", block_start + 1)
            next_comment = source.find("\n  # Ровно один", block_start + 1)
            block_end_candidates = [idx for idx in (next_service, next_comment) if idx != -1]
            block_end = min(block_end_candidates) if block_end_candidates else len(source)
            block = source[block_start:block_end]
            celery_blocks.append(block)
            assert pgrep_worker in block, f"{path.name}:{service_name} missing pgrep healthcheck"
            assert "smoke_queue_worker_boot.py" not in block, (
                f"{path.name}:{service_name} must not reuse RabbitMQ aio_pika smoke"
            )
        assert celery_blocks, f"{path.name}: no celery worker service blocks found"


@pytest.mark.unit
def test_prod_baked_split_workers_isolate_agentic_and_companion_queues() -> None:
    """E0: prod-baked must not collapse agentic/companion onto the general worker."""

    stack_path = API_ROOT.parents[1] / "docker" / "stack" / "stack0_b.prod-baked.override.yml"
    if not stack_path.exists():
        pytest.skip("docker/stack is not mounted in immutable API test image")
    source = stack_path.read_text(encoding="utf-8")

    general_start = source.index("eliteew-celery-worker-prod:")
    agentic_start = source.index("eliteew-celery-agentic-worker-prod:")
    companion_start = source.index("eliteew-celery-companion-worker-prod:")
    beat_start = source.index("eliteew-celery-beat-prod:")

    general_block = source[general_start:agentic_start]
    agentic_block = source[agentic_start:companion_start]
    companion_block = source[companion_start:beat_start]

    assert "short,maintenance,broadcast,ewa_reembed" in general_block
    assert "ewa_companion" not in general_block
    assert "ewa_agentic" not in general_block

    assert "ewa_agentic,ewa_agentic_step" in agentic_block
    assert "profiles: !override []" in agentic_block
    assert "prod-baked-split-workers-disabled" not in agentic_block
    assert "--time-limit=960" in agentic_block
    assert "STACK0_CELERY_AGENTIC_CONCURRENCY" in agentic_block

    assert "-Q\n      - ewa_companion" in companion_block or "- ewa_companion\n" in companion_block
    assert "profiles: !override []" in companion_block
    assert "prod-baked-split-workers-disabled" not in companion_block
    assert "STACK0_CELERY_COMPANION_CONCURRENCY" in companion_block
    assert "--time-limit=600" in companion_block


@pytest.mark.unit
def test_companion_executor_merges_canonical_step_input_before_queue_payload() -> None:
    source = (API_ROOT / "ewa_platform" / "companion" / "jobs" / "executor.py").read_text(encoding="utf-8")
    assert 'step.get("input_payload")' in source
    assert "payload.update(dict(job_payload or {}))" in source
