# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Trust T6 / V-C1 lock: line B (dev-bind) Celery queue isolation must match baked A.
# Invariants:
# - General worker must not consume ``ewa_companion`` / ``ewa_agentic`` queues.
# - Agentic and companion workers must be declared with isolated ``-Q`` lists.
# Related:
# - docker/stack/stack0_b.dev-bind.override.yml
# - documentation/platform/PROD-CORE-DEV-BIND-LINE.md
# ---

from __future__ import annotations

from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parents[1]


def _resolve_stack_file(name: str) -> Path | None:
    """Locate compose override on host monorepo or skip when not mounted in test image."""

    candidates: list[Path] = []
    # Host layout: …/shared/api → parents[1] = shared, parents[2] = monorepo root.
    # Container layout: /app/api → parents[1] = /app (no docker/stack mount → skip).
    if len(API_ROOT.parents) > 1:
        candidates.append(API_ROOT.parents[1] / "docker" / "stack" / name)
    if len(API_ROOT.parents) > 2:
        candidates.append(API_ROOT.parents[2] / "docker" / "stack" / name)
    for path in candidates:
        if path.is_file():
            return path
    return None


def _queue_line_after(text: str, service_marker: str) -> str:
    idx = text.find(service_marker)
    assert idx >= 0, f"missing service marker {service_marker}"
    chunk = text[idx : idx + 1200]
    q_idx = chunk.find("-Q")
    assert q_idx >= 0, f"missing -Q in {service_marker}"
    after = chunk[q_idx:]
    for line in after.splitlines():
        stripped = line.strip()
        if stripped.startswith("-Q"):
            continue
        if stripped.startswith("-"):
            return stripped.lstrip("-").strip()
    raise AssertionError(f"queue list not found after -Q for {service_marker}")


@pytest.mark.unit
def test_dev_bind_celery_queues_match_baked_isolation() -> None:
    """Trust T6: line B must not collapse agentic/companion onto the general worker."""

    dev_path = _resolve_stack_file("stack0_b.dev-bind.override.yml")
    baked_path = _resolve_stack_file("stack0_b.prod-baked.override.yml")
    if dev_path is None or baked_path is None:
        pytest.skip("docker/stack is not mounted in immutable API test image")

    dev = dev_path.read_text(encoding="utf-8")
    baked = baked_path.read_text(encoding="utf-8")

    assert "eliteew-celery-agentic-worker-prod:" in dev
    assert "eliteew-celery-companion-worker-prod:" in dev

    general_dev = _queue_line_after(dev, "eliteew-celery-worker-prod:")
    general_baked = _queue_line_after(baked, "eliteew-celery-worker-prod:")
    assert "ewa_companion" not in general_dev
    assert "ewa_agentic" not in general_dev
    assert general_dev == general_baked

    agentic_dev = _queue_line_after(dev, "eliteew-celery-agentic-worker-prod:")
    companion_dev = _queue_line_after(dev, "eliteew-celery-companion-worker-prod:")
    assert agentic_dev == "ewa_agentic,ewa_agentic_step"
    assert companion_dev == "ewa_companion"
