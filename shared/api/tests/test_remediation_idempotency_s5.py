#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression checks for Phase 5 idempotency contracts in BI, EWRP and system GAF tasks.
# Invariants:
# - EWRP claims Idempotency-Key before billing side effects.
# - BI duplicate queue delivery is skipped by session claim and failures re-raise for retry/DLQ.
# - System GAF onboarding/broadcast use claim-before-send ledgers.
# Related:
# - api/routers/ewrp.py
# - api/routers/business_intelligence.py
# - api/tasks/onboarding_gaf.py
# - api/tasks/system_gaf_broadcast.py
# ---
"""Idempotency contract regression checks."""

from __future__ import annotations

from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parents[1]


def _read(rel_path: str) -> str:
    return (API_ROOT / rel_path).read_text(encoding="utf-8")


@pytest.mark.unit
def test_ewrp_claims_idempotency_before_billing_usage() -> None:
    source = _read("routers/ewrp.py")
    assert "async def _ewrp_claim_idempotency_key" in source
    assert 'redis.set(rkey, "in_progress", nx=True' in source
    create_source = source[source.index("async def create_ewrp") : source.index('router.post("/{job_id}/duplicate"')]
    assert create_source.index("_ewrp_claim_idempotency_key(user_id, idem_raw)") < create_source.index(
        "billing.record_usage"
    )


@pytest.mark.unit
def test_bi_generation_claims_session_and_reraises_failures() -> None:
    source = _read("routers/business_intelligence.py")
    assert 'claim_key = f"bi:generation:{session_id}"' in source
    assert 'redis.set(claim_key, "in_progress", nx=True' in source
    assert "raise RuntimeError(str(error))" in source


@pytest.mark.unit
def test_system_gaf_tasks_have_claim_before_send_ledgers() -> None:
    onboarding = _read("tasks/onboarding_gaf.py")
    broadcast = _read("tasks/system_gaf_broadcast.py")
    assert "UPDATE users" in onboarding and "RETURNING preferences" in onboarding
    assert "send_service_message_to_user" in onboarding
    assert onboarding.index("UPDATE users") < onboarding.index("send_service_message_to_user")
    assert 'redis.set(ledger_key, "in_progress", nx=True' in broadcast
    assert 'redis.set(ledger_key, "sent"' in broadcast
