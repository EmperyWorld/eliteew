# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Regression tests for the production Marketing Cabinet AMKA pulse artifact.
# The tests assert user-visible pulse behavior without external AI, RAG, or database dependencies.
# Invariants:
# - Pulse is derived only from persisted run/step-like dictionaries.
# - A completed no-op remains a successful, explainable AMKA outcome.
# Related:
# - shared/api/services/marketing_cabinet/amka_pulse.py
# - shared/api/services/marketing_cabinet/amka_run_export_markdown.py
# - documentation/product/amka-seed-album/PULSE-ARTIFACT.md
# - documentation/product/amka-seed-album/AMKA-TRACE-EXPORT-GUIDELINES.md
# ---
from __future__ import annotations

from pathlib import Path

import pytest

from api.services.marketing_cabinet.amka_pulse import build_marketing_amka_pulse
from api.services.marketing_cabinet.amka_run_export_markdown import (
    build_amka_run_export_markdown,
    save_amka_run_reports_to_generated_files,
)
from api.services.marketing_cabinet.amka_standalone_projection import (
    build_marketing_amka_standalone_projection,
)


@pytest.mark.unit
def test_marketing_amka_pulse_explains_completed_noop() -> None:
    pulse = build_marketing_amka_pulse(
        {
            "id": "run-1",
            "status": "completed",
            "master_plan": [],
            "audit_llm_stats": {"total": 4, "fallback": 0},
        },
        [
            {
                "ordinal": 1,
                "title": "Audit",
                "status": "completed",
                "applied_entities": [],
                "operation_trail": [],
                "report_payload": {},
                "metrics_after": {},
            }
        ],
    )

    assert pulse["no_change_reason"]
    assert pulse["next_safe_step"]
    assert pulse["metrics"]["changed_steps"] == 0
    assert pulse["preserved"]


@pytest.mark.unit
def test_marketing_amka_pulse_tracks_changes_and_doubts() -> None:
    pulse = build_marketing_amka_pulse(
        {
            "id": "run-2",
            "status": "completed",
            "plan_llm_status": "heuristic_fallback",
            "audit_llm_stats": {"total": 10, "fallback": 4},
            "master_plan": [{"operations": [{"operation_key": "delete-old", "kind": "delete", "destructive": True}]}],
        },
        [
            {
                "ordinal": 2,
                "title": "Apply evidence",
                "status": "completed",
                "applied_entities": [{"entity_type": "research", "id": "r1"}],
                "operation_trail": [],
                "report_payload": {},
                "metrics_after": {},
            }
        ],
    )

    assert pulse["changed"] == ["#2 Apply evidence"]
    assert pulse["metrics"]["destructive_operations"] == 1
    assert any("baseline fallback" in item for item in pulse["doubts"])
    assert any("эвристикой" in item for item in pulse["doubts"])


@pytest.mark.unit
def test_marketing_amka_pulse_dedupes_destructive_count_between_plan_and_steps() -> None:
    pulse = build_marketing_amka_pulse(
        {
            "id": "run-2b",
            "status": "awaiting_approval",
            "master_plan": [
                {
                    "operations": [
                        {
                            "operation_key": "replace-jtbd-1",
                            "kind": "replace",
                            "destructive": True,
                        }
                    ]
                }
            ],
        },
        [
            {
                "ordinal": 1,
                "title": "Master plan",
                "status": "completed",
                "plan_payload": {
                    "operations": [
                        {
                            "operation_key": "replace-jtbd-1",
                            "kind": "replace",
                            "destructive": True,
                        }
                    ]
                },
            }
        ],
    )

    assert pulse["metrics"]["destructive_operations"] == 1


@pytest.mark.unit
def test_server_export_includes_pulse_before_step_details() -> None:
    md = build_amka_run_export_markdown(
        {"id": "run-3", "project_id": "p", "company_id": "c", "status": "completed"},
        [{"ordinal": 1, "title": "Step", "stage_kind": "master_plan", "status": "completed"}],
        pulse={
            "summary": "AMKA kept the current state.",
            "changed": [],
            "preserved": ["No confirmed changes."],
            "doubts": [],
            "agreements": ["No-op is valid."],
            "no_change_reason": "No useful operation was found.",
            "next_safe_step": "Wait for better evidence.",
        },
    )

    assert "## Пульс AMKA" in md
    assert md.index("## Пульс AMKA") < md.index("## Этапы")
    assert "No useful operation was found." in md


@pytest.mark.unit
def test_server_export_redacts_core_alignment_trace_payloads() -> None:
    md = build_amka_run_export_markdown(
        {"id": "run-redact", "project_id": "p", "company_id": "c", "status": "completed"},
        [],
        core_alignment={
            "status": "completed",
            "traces": [
                {
                    "stage": "snapshot",
                    "event": "demo",
                    "message": "",
                    "payload": {"operator_email": "secret@example.com", "ok": 1},
                }
            ],
        },
    )

    assert "secret@example.com" not in md
    assert "[redacted]" in md


@pytest.mark.unit
def test_server_export_includes_readable_core_alignment_trace() -> None:
    md = build_amka_run_export_markdown(
        {"id": "run-tr", "project_id": "p", "company_id": "c", "status": "completed"},
        [],
        core_alignment={
            "status": "completed",
            "traces": [{"stage": "snapshot", "event": "run.started", "message": "", "payload": {}}],
        },
    )

    assert "## AMKA core alignment" in md
    assert "## Трасса ядра AMKA" in md
    assert "run.started" in md


@pytest.mark.unit
def test_server_export_includes_ensemble_subset_metadata() -> None:
    md = build_amka_run_export_markdown(
        {"id": "run-ensemble", "project_id": "p", "company_id": "c", "status": "completed"},
        [
            {
                "ordinal": 19,
                "title": "Evidence synthesis",
                "stage_kind": "execute_section",
                "section_key": "evidence",
                "status": "completed",
                "plan_payload": {"execution_mode": "desktop_ensemble"},
                "report_payload": {
                    "mode": "operations",
                    "execution_mode": "desktop_ensemble",
                    "ensemble_subset": {
                        "mode": "desktop_ensemble",
                        "heroes": ["likiy_sorrento", "arlyqueen"],
                        "template_hint": "research_plan_v1",
                    },
                },
            }
        ],
    )

    assert "- Режим выполнения: `desktop_ensemble`" in md
    assert "- Blueprint: `research_plan_v1`" in md
    assert "likiy_sorrento" in md


@pytest.mark.unit
def test_server_export_includes_ensemble_plan_count_and_step_error() -> None:
    md = build_amka_run_export_markdown(
        {
            "id": "run-plan",
            "project_id": "p",
            "company_id": "c",
            "status": "failed",
            "master_plan": [
                {"section_key": "evidence", "execution_mode": "desktop_ensemble", "title": "E"},
            ],
        },
        [
            {
                "ordinal": 19,
                "title": "Evidence",
                "stage_kind": "execute_section",
                "section_key": "evidence",
                "status": "failed",
                "plan_payload": {"execution_mode": "desktop_ensemble"},
                "error_payload": {"message": "boom"},
            }
        ],
    )

    assert "Шагов «Команда» в плане: 1" in md
    assert "- Ошибка шага: boom" in md


@pytest.mark.unit
def test_server_export_includes_ensemble_terminal_error_field() -> None:
    md = build_amka_run_export_markdown(
        {"id": "run-err", "project_id": "p", "company_id": "c", "status": "failed"},
        [
            {
                "ordinal": 19,
                "title": "Evidence",
                "stage_kind": "execute_section",
                "section_key": "evidence",
                "status": "failed",
                "plan_payload": {"execution_mode": "desktop_ensemble"},
                "report_payload": {
                    "mode": "desktop_ensemble",
                    "execution_mode": "desktop_ensemble",
                    "error": "ensemble_empty_output",
                },
            }
        ],
    )

    assert "- Ошибка ensemble: ensemble_empty_output" in md


@pytest.mark.unit
def test_server_export_dedupes_identical_ensemble_and_step_errors() -> None:
    md = build_amka_run_export_markdown(
        {"id": "run-dedupe", "project_id": "p", "company_id": "c", "status": "failed"},
        [
            {
                "ordinal": 19,
                "title": "Evidence",
                "stage_kind": "execute_section",
                "section_key": "evidence",
                "status": "failed",
                "plan_payload": {"execution_mode": "desktop_ensemble"},
                "report_payload": {
                    "mode": "desktop_ensemble",
                    "execution_mode": "desktop_ensemble",
                    "error": "ensemble_empty_output",
                },
                "error_payload": {"message": "ensemble_empty_output"},
            }
        ],
    )

    assert md.count("ensemble_empty_output") == 1


@pytest.mark.unit
def test_server_export_user_mode_hides_technical_blocks() -> None:
    md = build_amka_run_export_markdown(
        {
            "id": "run-user",
            "project_id": "p",
            "company_id": "c",
            "status": "completed",
            "final_assessment": {
                "readiness_score": 72,
                "strategy_integrity_score": 68,
                "gaps_count": 4,
                "completed_steps_count": 7,
            },
        },
        [
            {
                "ordinal": 1,
                "title": "Step",
                "stage_kind": "execute_section",
                "status": "completed",
                "operation_trail": [{"kind": "replace"}],
                "report_markdown": "## Step\n\n- done",
            }
        ],
        standalone_projection={"driver_key": "marketing_cabinet", "domain_profile": "marketing"},
        core_alignment={"status": "completed", "traces": [{"stage": "snapshot", "event": "run.started"}]},
        technical_details=False,
    )

    assert "## Ключевые метрики" in md
    assert "## Финальная оценка (JSON)" not in md
    assert "## AMKA core alignment" not in md
    assert "#### Трасса операций" not in md


@pytest.mark.unit
def test_export_reports_saved_in_generated_files(tmp_path: Path) -> None:
    saved = save_amka_run_reports_to_generated_files(
        run_id="run-save-1",
        user_markdown="# user\n",
        technical_markdown="# technical\n",
        generated_files_base=str(tmp_path),
    )

    user_path = Path(saved["absolute_user_report"])
    technical_path = Path(saved["absolute_technical_report"])

    assert user_path.exists()
    assert technical_path.exists()
    assert user_path.read_text(encoding="utf-8") == "# user\n"
    assert technical_path.read_text(encoding="utf-8") == "# technical\n"
    assert saved["relative_technical_report"].endswith(
        "generated_files/marketing_cabinet/amka/run-save-1/report-technical.md"
    )


@pytest.mark.unit
def test_standalone_projection_maps_marketing_steps_to_core_trace() -> None:
    projection = build_marketing_amka_standalone_projection(
        {
            "id": "run-4",
            "project_id": "project-1",
            "company_id": "company-1",
            "status": "awaiting_approval",
            "current_stage": "approval",
            "master_plan": [{"section_key": "jtbd"}],
        },
        [
            {
                "id": "step-1",
                "ordinal": 1,
                "stage_kind": "section_audit",
                "section_key": "jtbd",
                "title": "Audit JTBD",
                "status": "completed",
                "applied_entities": [],
                "operation_trail": [],
            },
            {
                "id": "step-2",
                "ordinal": 2,
                "stage_kind": "master_plan",
                "title": "Master plan",
                "status": "completed",
            },
        ],
    )

    assert projection["driver_key"] == "marketing_cabinet"
    assert projection["domain_profile"] == "marketing"
    assert projection["subject"]["run_id"] == "run-4"
    assert projection["stage_counts"]["audit"] == 1
    assert projection["stage_counts"]["plan"] == 1
    assert any(event["event"] == "approval.waiting" for event in projection["trace_events"])
    assert projection["contract"]["plan"] is True
