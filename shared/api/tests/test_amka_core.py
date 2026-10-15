# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for the standalone AMKA core, reference mock driver, and driver catalog metadata.
# The tests protect the new component boundary without touching marketing-cabinet storage.
# Invariants:
# - Tests assert lifecycle behavior and policy outcomes, not private implementation details.
# - The mock driver is the boundary; no database, RAG, IMC, or live UGS snapshot calls in mock-only tests.
# Related:
# - shared/api/services/amka_core/
# - documentation/product/amka-seed-album/RFC-001-amka-driver-contract.md
# ---
from __future__ import annotations

import asyncio

import pytest

from api.services.amka_core import (
    AmkaCoreEngine,
    AmkaCoreRunStatus,
    AmkaDriver,
    AmkaPlanOperation,
    AmkaPlanTask,
    AmkaRiskLevel,
    AmkaRunStore,
    AmkaSubjectRef,
    InMemoryAmkaRunStore,
    ReferenceMockAmkaDriver,
    StaticReadOnlyAmkaDriver,
    build_amka_core_run_projection,
    get_amka_driver_catalog_entry,
    list_amka_driver_catalog,
    serialize_amka_driver_catalog,
)


def _subject() -> AmkaSubjectRef:
    return AmkaSubjectRef(
        driver_key="reference_mock",
        domain_profile="mock",
        subject_id="subject-1",
        display_name="Reference subject",
    )


@pytest.mark.unit
def test_reference_mock_driver_satisfies_core_protocol() -> None:
    driver = ReferenceMockAmkaDriver()
    assert isinstance(driver, AmkaDriver)


@pytest.mark.unit
def test_core_run_completes_with_no_change_pulse_when_driver_has_no_tasks() -> None:
    async def _run() -> None:
        result = await AmkaCoreEngine(ReferenceMockAmkaDriver()).run_once(_subject())

        assert result.status == AmkaCoreRunStatus.COMPLETED
        assert result.tasks == ()
        assert result.pulse is not None
        assert result.pulse.recommends_no_change is True
        assert "No action" in result.pulse.agreements[0]

    asyncio.run(_run())


@pytest.mark.unit
def test_core_run_waits_for_approval_when_execute_flag_is_false() -> None:
    async def _run() -> None:
        task = AmkaPlanTask(task_key="improve", title="Improve subject")
        driver = ReferenceMockAmkaDriver(planned_tasks=[task])

        result = await AmkaCoreEngine(driver).run_once(_subject(), execute=False)

        assert result.status == AmkaCoreRunStatus.AWAITING_APPROVAL
        assert driver.executed_task_keys == []
        assert result.policy is not None
        assert result.policy.allowed is True

    asyncio.run(_run())


@pytest.mark.unit
def test_core_run_executes_allowed_tasks_when_requested() -> None:
    async def _run() -> None:
        task = AmkaPlanTask(
            task_key="safe-task",
            title="Safe task",
            operations=(
                AmkaPlanOperation(
                    operation_key="safe-op",
                    kind="update",
                    title="Safe update",
                    risk=AmkaRiskLevel.LOW,
                ),
            ),
        )
        driver = ReferenceMockAmkaDriver(planned_tasks=[task])

        result = await AmkaCoreEngine(driver).run_once(_subject(), execute=True)

        assert result.status == AmkaCoreRunStatus.COMPLETED
        assert driver.executed_task_keys == ["safe-task"]
        assert result.observations["executed_task_keys"] == ["safe-task"]

    asyncio.run(_run())


@pytest.mark.unit
def test_core_run_blocks_destructive_operations_at_policy_gate() -> None:
    async def _run() -> None:
        task = AmkaPlanTask(
            task_key="danger",
            title="Dangerous task",
            risk=AmkaRiskLevel.DESTRUCTIVE,
            operations=(
                AmkaPlanOperation(
                    operation_key="delete-1",
                    kind="delete",
                    title="Delete something",
                    risk=AmkaRiskLevel.DESTRUCTIVE,
                    reversible=False,
                ),
            ),
        )
        driver = ReferenceMockAmkaDriver(planned_tasks=[task])

        result = await AmkaCoreEngine(driver).run_once(_subject(), execute=True)

        assert result.status == AmkaCoreRunStatus.AWAITING_APPROVAL
        assert driver.executed_task_keys == []
        assert result.policy is not None
        assert result.policy.denied_operation_keys == ("delete-1",)

    asyncio.run(_run())


@pytest.mark.unit
def test_static_read_only_driver_executes_without_marketing_state_or_mutations() -> None:
    async def _run() -> None:
        subject = AmkaSubjectRef(
            driver_key="static_read_only",
            domain_profile="read_only_audit",
            subject_id="doc-1",
            display_name="Read-only subject",
        )
        driver = StaticReadOnlyAmkaDriver(
            context_text="Standalone AMKA should read this subject.",
            findings=["Missing owner", "Needs clearer next step"],
        )

        result = await AmkaCoreEngine(driver).run_once(subject, execute=True)

        assert result.status == AmkaCoreRunStatus.COMPLETED
        assert driver.reviewed_task_keys == ["review-1", "review-2"]
        assert result.snapshot is not None
        assert result.snapshot.metadata["read_only"] is True
        assert result.pulse is not None
        assert "read-only" in result.pulse.summary
        assert result.observations["read_only"] is True

    asyncio.run(_run())


@pytest.mark.unit
def test_core_run_projection_serializes_result_without_marketing_tables() -> None:
    async def _run() -> None:
        subject = AmkaSubjectRef(
            driver_key="static_read_only",
            domain_profile="read_only_audit",
            subject_id="doc-2",
            display_name="Read-only doc",
        )
        driver = StaticReadOnlyAmkaDriver(
            context_text="Projection should be portable.",
            findings=["Missing decision log"],
        )

        result = await AmkaCoreEngine(driver).run_once(subject, execute=True)
        projection = build_amka_core_run_projection(result)

        assert projection["driver_key"] == "static_read_only"
        assert projection["domain_profile"] == "read_only_audit"
        assert projection["subject"]["subject_id"] == "doc-2"
        assert projection["status"] == "completed"
        assert projection["current_stage"] == "final"
        assert projection["contract"]["read"] is True
        assert projection["contract"]["act"] is True
        assert projection["policy"]["allowed"] is True
        assert projection["step_status_counts"] == {"completed": 1}
        assert projection["task_status_counts"] == {"completed": 1}
        assert projection["stage_counts"]["snapshot"] >= 2
        assert projection["trace_events"][-1]["event"] == "pulse.ready"

    asyncio.run(_run())


@pytest.mark.unit
def test_driver_catalog_lists_unique_known_profiles_without_instantiation() -> None:
    catalog = list_amka_driver_catalog()
    keys = {(entry.driver_key, entry.domain_profile) for entry in catalog}

    assert len(keys) == len(catalog)
    assert ("marketing_cabinet", "marketing") in keys
    assert ("reference_mock", "mock") in keys
    assert ("static_read_only", "read_only_audit") in keys
    assert ("ugs_admin", "model_routing") in keys
    assert ("ugs_admin", "generation_inventory") in keys

    marketing = get_amka_driver_catalog_entry("marketing_cabinet", "marketing")

    assert marketing is not None
    assert marketing.supports_write_actions is True
    assert marketing.status == "production_adapter"
    assert "AMKA tab" in marketing.entrypoint

    serialized = serialize_amka_driver_catalog()

    assert serialized[0]["driver_key"] == "marketing_cabinet"
    assert serialized[0]["supports_write_actions"] is True
    assert "capabilities" in serialized[0]


@pytest.mark.unit
def test_in_memory_run_store_saves_core_projection_by_subject() -> None:
    async def _run() -> None:
        subject = AmkaSubjectRef(
            driver_key="static_read_only",
            domain_profile="read_only_audit",
            subject_id="doc-store",
            display_name="Stored subject",
        )
        driver = StaticReadOnlyAmkaDriver(
            context_text="Store should persist a neutral projection.",
            findings=["Missing store test"],
        )
        result = await AmkaCoreEngine(driver).run_once(subject, execute=True)
        store = InMemoryAmkaRunStore()

        assert isinstance(store, AmkaRunStore)

        stored = await store.save_result("run-store-1", result, metadata={"source": "unit"})
        fetched = await store.get_run("run-store-1")
        subject_runs = await store.list_runs_for_subject(subject)

        assert fetched == stored
        assert stored.metadata["source"] == "unit"
        assert stored.projection["driver_key"] == "static_read_only"
        assert stored.projection["step_status_counts"] == {"completed": 1}
        assert subject_runs == (stored,)

    asyncio.run(_run())


@pytest.mark.unit
def test_core_run_once_and_persist_saves_neutral_projection() -> None:
    async def _run() -> None:
        subject = _subject()
        driver = ReferenceMockAmkaDriver()
        store = InMemoryAmkaRunStore()
        result, stored = await AmkaCoreEngine(driver).run_once_and_persist(
            subject,
            run_id="run-persist-1",
            store=store,
            execute=False,
        )

        assert result.status == AmkaCoreRunStatus.COMPLETED
        assert stored.run_id == "run-persist-1"
        assert stored.projection["driver_key"] == "reference_mock"
        fetched = await store.get_run("run-persist-1")
        assert fetched is not None
        assert fetched.subject.subject_id == subject.subject_id

    asyncio.run(_run())
