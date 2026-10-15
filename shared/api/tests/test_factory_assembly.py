# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave F7/G3 — assembly flag + Gate T∧C∧S evaluate + kill-all.
# Invariants:
# - ELITEEW_FACTORY_ASSEMBLY default false; evaluate endpoint 403 when off.
# - Gate S cannot rescue T/C fail; T∧C pass + S fail → verdict FAILED.
# Related:
# - api.ewa_platform.factory.assembly_gates
# ---

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from api.ewa_platform.factory.assembly_gates import (
    apply_authoritative_assembly_verdict,
    evaluate_assembly_gates,
)
from api.ewa_platform.factory.config import factory_assembly_enabled
from api.ewa_platform.factory.service import reset_factory_service_for_tests
from api.routers import desktop_admin_factory as factory_router


def test_factory_assembly_default_off(monkeypatch: pytest.MonkeyPatch) -> None:
    # Explicit OFF — staging/prod may set ELITEEW_FACTORY_ASSEMBLY=1 in dotenv.
    monkeypatch.setenv("ELITEEW_FACTORY_ENABLED", "1")
    monkeypatch.setenv("ELITEEW_FACTORY_ASSEMBLY", "0")
    assert factory_assembly_enabled() is False


def test_factory_assembly_env_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_FACTORY_ENABLED", "1")
    monkeypatch.setenv("ELITEEW_FACTORY_ASSEMBLY", "1")
    assert factory_assembly_enabled() is True


def test_evaluate_assembly_gates_notifications_pack() -> None:
    result = evaluate_assembly_gates(["notifications"])
    assert result["authoritative"] is True
    assert "gate_t" in result and "gate_c" in result and "gate_s" in result
    assert result["verdict"] in {"PASSED", "FAILED"}
    assert "tc_passed" in result


def test_gate_s_skipped_without_packs() -> None:
    result = evaluate_assembly_gates([])
    assert result["gate_s"]["status"] == "SKIPPED"
    assert result["tc_passed"] is True or result["gate_t"]["status"] in {
        "PASSED",
        "FAILED",
    }


def test_gate_s_fails_on_intent_pack_mismatch() -> None:
    result = evaluate_assembly_gates(
        ["notifications"],
        intent="completely unrelated music video pipeline",
    )
    assert result["gate_s"]["status"] == "FAILED"
    if result["tc_passed"]:
        assert result["verdict"] == "FAILED"
        assert result["passed"] is False


def test_gate_s_cannot_rescue_tc_fail() -> None:
    assert (
        apply_authoritative_assembly_verdict(
            gate_t="FAILED",
            gate_c="PASSED",
            gate_s="PASSED",
        )
        == "FAILED"
    )
    assert (
        apply_authoritative_assembly_verdict(
            gate_t="PASSED",
            gate_c="PASSED",
            gate_s="FAILED",
        )
        == "FAILED"
    )
    assert (
        apply_authoritative_assembly_verdict(
            gate_t="PASSED",
            gate_c="PASSED",
            gate_s="SKIPPED",
        )
        == "PASSED"
    )


@pytest.mark.asyncio
async def test_status_reports_assembly_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_FACTORY_ENABLED", "1")
    monkeypatch.setenv("ELITEEW_FACTORY_ASSEMBLY", "0")
    out = await factory_router.factory_status(_admin=SimpleNamespace(id=uuid4()))
    assert out["assembly"] is False
    assert "max_fix_loops" in out


@pytest.mark.asyncio
async def test_evaluate_forbidden_when_assembly_off(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ELITEEW_FACTORY_ENABLED", "1")
    monkeypatch.setenv("ELITEEW_FACTORY_ASSEMBLY", "0")
    with pytest.raises(HTTPException) as exc:
        await factory_router.evaluate_assembly(
            body=factory_router.FactoryAssemblyEvaluateBody(pack_stems=["notifications"]),
            _admin=SimpleNamespace(id=uuid4()),
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_evaluate_ok_when_assembly_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_FACTORY_ENABLED", "1")
    monkeypatch.setenv("ELITEEW_FACTORY_ASSEMBLY", "1")
    out = await factory_router.evaluate_assembly(
        body=factory_router.FactoryAssemblyEvaluateBody(
            pack_stems=["notifications"],
            intent="notifications pack",
        ),
        _admin=SimpleNamespace(id=uuid4()),
    )
    assert out["assembly"] is True
    assert out["result"]["authoritative"] is True
    assert "gate_s" in out["result"]


@pytest.mark.asyncio
async def test_kill_all_cancels_active(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELITEEW_FACTORY_ENABLED", "1")
    monkeypatch.setenv("ELITEEW_FACTORY_AUTONOMOUS", "0")
    svc = reset_factory_service_for_tests()
    svc.enqueue(title="kill me", pack_stems=["notifications"], run_ticks=0)
    out = await factory_router.kill_all_intentions(
        body=factory_router.FactoryKillAllBody(mode="cancel"),
        _admin=SimpleNamespace(id=uuid4()),
    )
    assert out["affected"] >= 1
    assert len(out["cancelled"]) >= 1
    items = svc.list_intentions()
    assert all(i["status"] == "cancelled" for i in items)
