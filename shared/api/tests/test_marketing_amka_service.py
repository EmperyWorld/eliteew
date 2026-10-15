from __future__ import annotations

import asyncio
import sys
import types
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest


def _stub_minio_module() -> None:
    if "minio" in sys.modules:
        return
    module = types.ModuleType("minio")
    module.__path__ = []  # type: ignore[attr-defined]
    error_module = types.ModuleType("minio.error")
    sseconfig_module = types.ModuleType("minio.sseconfig")

    class _DummyMinio:  # noqa: D401
        """Test stub for optional Minio dependency."""

        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

    class _DummyS3Error(Exception):
        pass

    class _DummyRule:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

    class _DummySSEConfig:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

    setattr(module, "Minio", _DummyMinio)
    setattr(error_module, "S3Error", _DummyS3Error)
    setattr(sseconfig_module, "Rule", _DummyRule)
    setattr(sseconfig_module, "SSEConfig", _DummySSEConfig)
    sys.modules["minio"] = module
    sys.modules["minio.error"] = error_module
    sys.modules["minio.sseconfig"] = sseconfig_module


_stub_minio_module()

from api.services.marketing_cabinet.amka_service import (
    AMKA_ALERTS_HEURISTIC_CREATE_CAP,
    AMKA_AUDIT_ONLY_SECTIONS,
    AmkaService,
    _amka_candidate_dependency_dag_edges,
    _amka_pipeline_snapshot,
    _amka_render_final_execution_facts_markdown,
    _amka_summarize_execute_step_for_final,
    _sanitize_amka_imc_plan_tasks,
    _toposort_amka_plan_tasks,
    expand_amka_section_subset,
    format_recent_amka_runs_digest_markdown,
)


class _Acquire:
    def __init__(self, conn: MagicMock) -> None:
        self._conn = conn

    async def __aenter__(self) -> MagicMock:
        return self._conn

    async def __aexit__(self, exc_type, exc, tb) -> None:  # type: ignore[no-untyped-def]
        return None


def _step_row(*, started_at: datetime | None, completed_at: datetime | None) -> dict[str, object]:
    return {
        "id": uuid4(),
        "run_id": uuid4(),
        "ordinal": 1,
        "stage_kind": "execute_section",
        "section_key": "analysis",
        "title": "Step",
        "status": "running",
        "plan_payload": {},
        "report_markdown": None,
        "report_payload": {},
        "applied_entities": [],
        "metrics_before": {},
        "metrics_after": {},
        "error_payload": {},
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
        "started_at": started_at,
        "completed_at": completed_at,
    }


@pytest.mark.unit
def test_update_step_preserves_existing_started_at() -> None:
    async def _run() -> None:
        db_pool = MagicMock()
        conn = MagicMock()
        db_pool.acquire.return_value = _Acquire(conn)
        existing_started_at = datetime(2026, 4, 14, 10, 0, tzinfo=UTC)
        existing = _step_row(started_at=existing_started_at, completed_at=None)
        conn.fetchrow = AsyncMock(return_value=existing)
        conn.execute = AsyncMock(return_value=None)

        service = AmkaService(db_pool)
        completed_at = datetime(2026, 4, 14, 10, 15, tzinfo=UTC)
        await service._update_step(
            uuid4(),
            status="completed",
            completed_at=completed_at,
            report_payload={"ok": True},
        )

        execute_args = conn.execute.await_args.args
        assert execute_args[-2] == existing_started_at
        assert execute_args[-1] == completed_at

    asyncio.run(_run())


@pytest.mark.unit
def test_toposort_amka_plan_tasks_orders_dependencies_before_dependents() -> None:
    """jtbd depends on evidence; wrong input order must be corrected."""
    tasks = [
        {
            "step_key": "execute_jtbd",
            "section_key": "jtbd",
            "title": "JTBD",
            "depends_on": ["evidence"],
            "write_policy": "apply_if_empty",
            "operations": [],
        },
        {
            "step_key": "execute_evidence",
            "section_key": "evidence",
            "title": "Evidence",
            "depends_on": [],
            "write_policy": "operation_based",
            "operations": [],
        },
    ]
    shuffled = [tasks[0], tasks[1]]
    ordered = _toposort_amka_plan_tasks(shuffled)
    assert [t["section_key"] for t in ordered] == ["evidence", "jtbd"]


@pytest.mark.unit
def test_execute_section_step_reports_applied_count_per_target() -> None:
    async def _run() -> None:
        service = AmkaService(MagicMock())
        project_id = uuid4()
        run_id = uuid4()
        user_id = uuid4()

        async def _async_step(*args: object, **kwargs: object) -> dict[str, object]:
            return {
                "report_markdown": "## async",
                "report_payload": {
                    "mode": "apply_if_empty",
                    "execution_mode": "project_generate_async",
                    "child_jobs": [
                        {
                            "kind": "marketing_ai_run",
                            "external_id": "a",
                            "target_section": "swot",
                            "status": "completed",
                        },
                        {
                            "kind": "marketing_ai_run",
                            "external_id": "b",
                            "target_section": "competitors",
                            "status": "completed",
                        },
                    ],
                },
                "applied_entities": [
                    {"entity_type": "swot", "title": "saved:swot"},
                    {"entity_type": "competitors", "title": "saved:competitors"},
                ],
                "metrics_before": {"score": 42},
                "metrics_after": {"applied_count": 2, "child_jobs_count": 2},
            }

        service._get_run_checked = AsyncMock(return_value={"project_id": str(project_id)})  # type: ignore[method-assign]
        service._build_run_snapshot = AsyncMock(  # type: ignore[method-assign]
            return_value={"project_context_text": "ctx", "extras": {}}
        )
        service._fetch_run_value = AsyncMock(  # type: ignore[method-assign]
            return_value={"section_audits": [{"section_key": "analysis", "score": 42}]}
        )
        service._run_project_generate_async_for_section = AsyncMock(side_effect=_async_step)  # type: ignore[method-assign]

        result = await service._execute_section_step(
            run_id=run_id,
            user_id=user_id,
            step={
                "id": str(uuid4()),
                "section_key": "analysis",
                "title": "Этап: Анализ",
                "plan_payload": {
                    "write_policy": "apply_if_empty",
                    "rationale": "Нужно обновить SWOT и конкурентов.",
                    "autofill_targets": ["swot", "competitors"],
                },
            },
        )

        assert len(result["applied_entities"]) == 2
        child = result["report_payload"]["child_jobs"]
        assert len(child) == 2
        assert child[0]["target_section"] == "swot"
        assert result["metrics_after"]["applied_count"] == 2

    asyncio.run(_run())


@pytest.mark.unit
def test_merge_section_audit_payload_downgrades_optimistic_healthy_score() -> None:
    service = AmkaService(MagicMock())

    merged = service._merge_section_audit_payload(
        {
            "section_key": "analysis",
            "label": "SWOT и конкуренты",
            "kind": "actionable",
            "status": "healthy",
            "score": 100,
            "current_state": ["SWOT: 5.", "Конкурентов: 2."],
            "work_needed": [],
            "dependencies": ["evidence"],
        },
        {
            "section_key": "analysis",
            "score": 92,
            "current_state": ["SWOT и конкуренты есть, но выводы слишком общие."],
            "work_needed": ["Сделать конкретные выводы по дифференциации и рискам."],
            "dependencies": ["evidence"],
        },
    )

    assert merged["score"] == 74
    assert merged["status"] == "attention"
    assert merged["current_state"] == ["SWOT и конкуренты есть, но выводы слишком общие."]
    assert merged["work_needed"] == ["Сделать конкретные выводы по дифференциации и рискам."]


@pytest.mark.unit
def test_build_section_audits_uses_llm_enrichment_for_deeper_findings() -> None:
    async def _run() -> None:
        pid = uuid4()
        uid = uuid4()
        service = AmkaService(MagicMock())

        async def _llm_side_effect(*args: object, **kwargs: object) -> dict[str, object]:
            prompt = str(kwargs.get("prompt") or (args[0] if args else ""))
            if "analysis" in prompt and "Baseline раздела" in prompt:
                return {
                    "sections": [
                        {
                            "section_key": "analysis",
                            "score": 58,
                            "current_state": ["SWOT и конкуренты есть, но выводы не привязаны к evidence."],
                            "work_needed": ["Связать SWOT с документами проекта и добавить выводы по конкурентам."],
                            "dependencies": ["evidence"],
                        }
                    ]
                }
            return {"sections": []}

        service._llm_json = AsyncMock(side_effect=_llm_side_effect)  # type: ignore[method-assign]

        with (
            patch(
                "api.services.marketing_cabinet.amka_phase_audit.build_project_context",
                new_callable=AsyncMock,
                return_value={"project": {"name": "Project"}},
            ),
            patch(
                "api.services.marketing_cabinet.amka_phase_audit.merge_project_context_text_with_rag",
                new_callable=AsyncMock,
                return_value="section ctx",
            ),
        ):
            audits = await service._build_section_audits(
                {
                    "run": {"id": "run-1", "project_id": str(pid), "created_by_user_id": str(uid)},
                    "operator_amka": {
                        "section_llm_audit": {"require_work_needed_quotes": False},
                    },
                    "health": {
                        "readiness_score": 91,
                        "strategy_integrity_score": 87,
                        "counts": {
                            "jtbd": 1,
                            "value_propositions": 1,
                            "swot": 5,
                            "competitors": 2,
                            "researches": 2,
                            "content": 5,
                            "segments": 1,
                            "campaigns": 1,
                            "funnels": 1,
                            "tasks": 1,
                            "alerts": 1,
                        },
                        "coverage": [],
                        "strategy_integrity": [],
                        "freshness": [{"key": "swot", "state": "fresh"}],
                        "gaps": [],
                    },
                    "project_context": {
                        "project": {
                            "name": "Project",
                            "company_name": "Company",
                            "company_industry": "SaaS",
                            "company_description": "Company description",
                            "company_website": "https://example.com",
                            "description": "Project description",
                            "goals": "Project goals",
                            "key_tasks": "Project tasks",
                            "category": "B2B",
                        }
                    },
                    "extras": {
                        "team_count": 3,
                        "imc_count": 1,
                        "imc_recent": [],
                        "customer_summary_exists": True,
                        "diagnostic_enabled": True,
                        "diagnostic_progress": 55,
                        "qdrant_points_count": 10,
                        "vault_documents_with_text": 4,
                        "weak_rag_coverage": False,
                    },
                    "user_instruction": "",
                    "project_context_formatted_text": "Компания: Company\nПроект: Project\n",
                    "project_context_text": "SWOT перечисляет факты, но в проекте нет явных выводов по конкуренции и дифференциации.",
                }
            )

        analysis_audit = next(item for item in audits if item["section_key"] == "analysis")
        assert analysis_audit["report_payload"]["score"] == 58
        assert analysis_audit["report_payload"]["status"] == "attention"
        assert analysis_audit["report_payload"]["current_state"] == [
            "SWOT и конкуренты есть, но выводы не привязаны к evidence."
        ]
        assert analysis_audit["report_payload"]["work_needed"] == [
            "Связать SWOT с документами проекта и добавить выводы по конкурентам."
        ]

    asyncio.run(_run())


@pytest.mark.unit
def test_section_audit_llm_single_result_coerces_wrong_section_key() -> None:
    from api.services.marketing_cabinet.amka_phase_audit import _normalize_llm_section_override

    override, parse_reason = _normalize_llm_section_override(
        [
            {
                "section_key": "Проекты",
                "score": 64,
                "current_state": ["Проект описан общими словами."],
                "work_needed": ["Уточнить ICP через цитату «ICP — B2B SaaS»."],
                "dependencies": ["companies"],
            }
        ],
        section_key="projects",
        ctx_for_prompt="ICP — B2B SaaS / продуктовые компании 200–2000 сотрудников",
        require_quotes=True,
    )

    assert override is not None
    assert override["section_key"] == "projects"
    assert override["work_needed"] == ["Уточнить ICP через цитату «ICP — B2B SaaS»."]
    assert parse_reason == "section_key_coerced_single_result"


@pytest.mark.unit
def test_section_audit_llm_direct_object_without_sections_is_used() -> None:
    from api.services.marketing_cabinet.amka_phase_audit import _normalize_llm_section_override

    override, parse_reason = _normalize_llm_section_override(
        None,
        section_key="segments",
        ctx_for_prompt="ICP — B2B SaaS / продуктовые компании 200–2000 сотрудников",
        require_quotes=True,
        raw_payload={
            "score": 61,
            "current_state": ["Сегменты описаны, но без evidence."],
            "work_needed": ["Привязать ICP к цитате «ICP — B2B SaaS»."],
            "dependencies": ["evidence"],
        },
    )

    assert override is not None
    assert override["section_key"] == "segments"
    assert override["score"] == 61
    assert override["work_needed"] == ["Привязать ICP к цитате «ICP — B2B SaaS»."]
    assert parse_reason == "direct_section_object"


@pytest.mark.unit
def test_section_audit_llm_sections_dict_instead_of_list_is_coerced() -> None:
    from api.services.marketing_cabinet.amka_phase_audit import _normalize_llm_section_override

    override, parse_reason = _normalize_llm_section_override(
        {
            "section_key": "companies",
            "score": 48,
            "current_state": ["Компания без сайта."],
            "work_needed": ["Добавить сайт через цитату «https://example.com»."],
            "dependencies": [],
        },
        section_key="companies",
        ctx_for_prompt="Сайт: https://example.com",
        require_quotes=True,
    )

    assert override is not None
    assert override["section_key"] == "companies"
    assert override["score"] == 48
    assert parse_reason == "sections_dict_coerced"


@pytest.mark.unit
def test_section_audit_llm_work_needed_kept_when_quotes_relaxed() -> None:
    from api.services.marketing_cabinet.amka_phase_audit import _normalize_llm_section_override

    override, parse_reason = _normalize_llm_section_override(
        [
            {
                "section_key": "tasks",
                "score": 70,
                "current_state": ["Задачи есть."],
                "work_needed": ["Уточнить приоритеты без цитаты в тексте."],
                "dependencies": ["campaigns"],
            }
        ],
        section_key="tasks",
        ctx_for_prompt="Задач: 2.",
        require_quotes=True,
    )

    assert override is not None
    assert override["work_needed"] == ["Уточнить приоритеты без цитаты в тексте."]
    assert parse_reason.endswith("_work_needed_quotes_relaxed")


@pytest.mark.unit
def test_build_candidate_tasks_includes_operation_payloads() -> None:
    service = AmkaService(MagicMock())

    tasks = service._build_candidate_tasks(
        [
            {
                "report_payload": {
                    "section_key": "analysis",
                    "score": 52,
                    "count": 2,
                    "work_needed": ["SWOT и конкуренты слишком общие."],
                }
            },
            {
                "report_payload": {
                    "section_key": "evidence",
                    "score": 30,
                    "count": 0,
                    "work_needed": ["Нужно подтянуть completed IMC runs и включить документы в RAG."],
                }
            },
        ],
        {
            "section_entities": {
                "analysis": [
                    {
                        "entity_type": "swot_analysis",
                        "entity_id": "swot-1",
                        "title": "Existing SWOT",
                        "summary": "Generic SWOT",
                    }
                ]
            },
            "source_catalog": {
                "pending_imports": [
                    {
                        "type": "imc_run",
                        "id": "run-1",
                        "title": "IMC SWOT report",
                    }
                ],
                "documents": [
                    {
                        "id": "doc-1",
                        "name": "Research brief",
                        "marketing_rag_included": False,
                    }
                ],
                "source_refs": [
                    {
                        "type": "imc_run",
                        "id": "run-1",
                        "title": "IMC SWOT report",
                    }
                ],
            },
        },
    )

    analysis_task = next(item for item in tasks if item["section_key"] == "analysis")
    evidence_task = next(item for item in tasks if item["section_key"] == "evidence")
    assert analysis_task["execution_mode"] == "project_generate_async"
    assert evidence_task["execution_mode"] == "mutation_service"
    assert analysis_task["operations"][0]["kind"] == "replace"
    assert analysis_task["operations"][0]["entity_id"] == "swot-1"
    assert analysis_task["operations"][0]["destructive"] is True
    assert evidence_task["operations"][0]["kind"] == "import_analysis_artifact"
    assert evidence_task["operations"][1]["kind"] == "attach_content_source"


@pytest.mark.unit
def test_auto_heuristic_candidate_tasks_skip_destructive_replace_for_existing_entities() -> None:
    service = AmkaService(MagicMock())

    tasks = service._build_candidate_tasks(
        [
            {
                "report_payload": {
                    "section_key": "segments",
                    "score": 45,
                    "count": 1,
                    "work_needed": ["Сегмент слишком общий."],
                }
            },
        ],
        {
            "run_mode": "auto",
            "section_entities": {
                "segments": [
                    {
                        "entity_type": "segment",
                        "entity_id": "segment-1",
                        "title": "Existing ICP",
                    }
                ]
            },
            "source_catalog": {},
        },
    )

    segment_task = next(item for item in tasks if item["section_key"] == "segments")
    assert segment_task["write_policy"] == "report_only"
    assert segment_task["operations"] == []


@pytest.mark.unit
def test_execute_section_step_prefers_operation_runtime() -> None:
    async def _run() -> None:
        service = AmkaService(MagicMock())
        project_id = uuid4()
        run_id = uuid4()
        user_id = uuid4()

        service._get_run_checked = AsyncMock(return_value={"project_id": str(project_id)})  # type: ignore[method-assign]
        service._build_run_snapshot = AsyncMock(  # type: ignore[method-assign]
            return_value={
                "project_context_text": "ctx",
                "extras": {},
            }
        )
        service._fetch_run_value = AsyncMock(  # type: ignore[method-assign]
            return_value={"section_audits": [{"section_key": "segments", "score": 37}]}
        )
        service._mutation_service.execute_operations = AsyncMock(  # type: ignore[attr-defined]
            return_value={
                "operation_trail": [
                    {
                        "kind": "replace",
                        "entity_type": "segment",
                        "entity_id": "segment-1",
                        "title": "Replace segment",
                        "destructive": True,
                        "before_snapshot": {"title": "Old ICP"},
                        "after_snapshot": {"title": "New ICP"},
                        "result": {
                            "status": "completed",
                            "mutated_entity_ids": ["segment-2"],
                        },
                        "source_refs": [{"type": "imc_run", "id": "run-1", "title": "IMC"}],
                    }
                ],
                "applied_entities": [{"entity_type": "segment", "title": "New ICP"}],
                "metrics_after": {
                    "applied_count": 1,
                    "operations_count": 1,
                    "destructive_count": 1,
                    "imported_sources_count": 0,
                },
            }
        )

        result = await service._execute_section_step(
            run_id=run_id,
            user_id=user_id,
            step={
                "id": str(uuid4()),
                "section_key": "segments",
                "title": "Этап: Сегменты",
                "plan_payload": {
                    "operations": [
                        {
                            "kind": "replace",
                            "entity_type": "segment",
                            "entity_id": "segment-1",
                            "title": "Replace segment",
                            "replacement_payload": {
                                "mode": "project_autofill",
                                "autofill_target": "segments",
                            },
                        }
                    ]
                },
            },
        )

        assert result["report_payload"]["mode"] == "operations"
        assert len(result["report_payload"]["operation_trail"]) == 1
        assert result["metrics_after"]["destructive_count"] == 1
        assert "Операций выполнено: 1" in result["report_markdown"]

    asyncio.run(_run())


@pytest.mark.unit
def test_imc_section_is_actionable_not_audit_only() -> None:
    assert "imc" not in AMKA_AUDIT_ONLY_SECTIONS


@pytest.mark.unit
def test_dashboard_is_audit_only() -> None:
    assert "dashboard" in AMKA_AUDIT_ONLY_SECTIONS


@pytest.mark.unit
def test_expand_amka_section_subset_adds_dependencies() -> None:
    expanded = expand_amka_section_subset(["imc"])
    assert "imc" in expanded
    assert "evidence" in expanded


@pytest.mark.unit
def test_expand_amka_section_subset_empty_means_full_scope() -> None:
    expanded = expand_amka_section_subset(None)
    assert "jtbd" in expanded
    assert "dashboard" in expanded


@pytest.mark.unit
def test_summarize_imc_completed_is_data_effective() -> None:
    step: dict[str, object] = {
        "ordinal": 3,
        "title": "ИМК",
        "section_key": "imc",
        "status": "completed",
        "report_payload": {"mode": "apply_if_empty", "execution_mode": "imc_research"},
        "applied_entities": [],
        "metrics_after": {"imc_terminal_status": "completed"},
    }
    summary = _amka_summarize_execute_step_for_final(step)  # type: ignore[arg-type]
    assert summary["data_effective"] is True
    assert summary["imc_terminal_status"] == "completed"


@pytest.mark.unit
def test_render_final_facts_contains_pipeline_heading() -> None:
    pipeline = _amka_pipeline_snapshot([])
    md = _amka_render_final_execution_facts_markdown(pipeline, [])
    assert "Фактический результат" in md
    assert "Пайплайн" in md


@pytest.mark.unit
def test_sanitize_amka_imc_plan_tasks_replaces_report_only() -> None:
    out = _sanitize_amka_imc_plan_tasks(
        [
            {"section_key": "imc", "write_policy": "report_only", "execution_mode": "imc_research"},
            {"section_key": "jtbd", "write_policy": "report_only"},
        ]
    )
    assert out[0]["write_policy"] == "apply_if_empty"
    assert out[1]["write_policy"] == "apply_if_empty"


@pytest.mark.unit
def test_summarize_imc_report_only_hint_mentions_plan() -> None:
    step: dict[str, object] = {
        "ordinal": 29,
        "title": "ИМК",
        "section_key": "imc",
        "status": "completed",
        "report_payload": {"mode": "report_only", "execution_mode": "imc_research"},
        "applied_entities": [],
        "metrics_after": {},
    }
    summary = _amka_summarize_execute_step_for_final(step)  # type: ignore[arg-type]
    assert summary["data_effective"] is False
    assert "write_policy=report_only" in (summary.get("hint_ru") or "")


@pytest.mark.unit
def test_format_recent_amka_runs_digest_markdown_empty() -> None:
    assert format_recent_amka_runs_digest_markdown([]) == ""


@pytest.mark.unit
def test_format_recent_amka_runs_digest_markdown_nonempty() -> None:
    md = format_recent_amka_runs_digest_markdown(
        [
            {
                "id": "r1",
                "status": "completed",
                "completed_at": "2026-01-01T00:00:00Z",
                "master_plan_summary": "Краткий план",
                "final_summary_excerpt": "Итог",
                "assessment": {"readiness_score": 80, "gaps_count": 2},
            }
        ]
    )
    assert "История AMKA" in md
    assert "r1" in md
    assert "readiness_score" in md or "80" in md


@pytest.mark.unit
def test_normalize_plan_tasks_accepts_marketing_tool_agent() -> None:
    service = AmkaService(MagicMock())
    candidates = [
        {
            "step_key": "execute_campaigns",
            "section_key": "campaigns",
            "title": "Кампании",
            "depends_on": [],
            "write_policy": "report_only",
            "rationale": "base",
            "execution_mode": "project_generate_async",
            "autofill_targets": ["campaigns"],
            "operations": [],
        }
    ]
    out = service._normalize_plan_tasks(
        [
            {
                "section_key": "campaigns",
                "title": "Исследование",
                "rationale": "Нужен tool-agent",
                "depends_on": [],
                "write_policy": "report_only",
                "execution_mode": "marketing_tool_agent",
                "operations": [],
            }
        ],
        candidates,
    )
    assert len(out) == 1
    assert out[0]["execution_mode"] == "marketing_tool_agent"


@pytest.mark.unit
def test_normalize_plan_tasks_keeps_multiple_imc_with_distinct_types() -> None:
    service = AmkaService(MagicMock())
    ev_base = {
        "step_key": "execute_evidence",
        "section_key": "evidence",
        "title": "Evidence",
        "depends_on": [],
        "write_policy": "operation_based",
        "rationale": "e",
        "execution_mode": "mutation_service",
        "autofill_targets": [],
        "operations": [],
    }
    imc_base = {
        "step_key": "execute_imc",
        "section_key": "imc",
        "title": "IMC",
        "depends_on": ["evidence"],
        "write_policy": "apply_if_empty",
        "rationale": "base",
        "execution_mode": "imc_research",
        "autofill_targets": [],
        "operations": [],
    }
    candidates = [ev_base, imc_base]
    out = service._normalize_plan_tasks(
        [
            {
                "section_key": "evidence",
                "title": "E",
                "rationale": "r",
                "depends_on": [],
                "operations": [],
            },
            {
                "section_key": "imc",
                "imc_type_key": "imc_rag_swot",
                "title": "S",
                "rationale": "r1",
                "depends_on": ["evidence"],
                "operations": [],
            },
            {
                "section_key": "imc",
                "imc_type_key": "imc_rag_jtbd",
                "title": "J",
                "rationale": "r2",
                "depends_on": ["evidence"],
                "operations": [],
            },
        ],
        candidates,
    )
    assert len(out) == 3
    imc_rows = [t for t in out if t["section_key"] == "imc"]
    assert len(imc_rows) == 2
    assert {t.get("imc_type_key") for t in imc_rows} == {"imc_rag_swot", "imc_rag_jtbd"}
    assert all(str(t.get("plan_task_uid") or "").strip() for t in out)


@pytest.mark.unit
def test_amka_candidate_dependency_dag_edges_two_imc_tasks_share_section_node() -> None:
    """Section-level DAG for LLM prompt: one imc node, evidence→imc and jtbd→segments."""
    tasks = [
        {"section_key": "imc", "depends_on": ["evidence"]},
        {"section_key": "imc", "depends_on": ["evidence", "jtbd"]},
        {"section_key": "evidence", "depends_on": []},
        {"section_key": "jtbd", "depends_on": ["evidence"]},
        {"section_key": "segments", "depends_on": ["jtbd", "evidence"]},
    ]
    edges = _amka_candidate_dependency_dag_edges(tasks)
    assert ("evidence", "imc") in edges
    assert ("evidence", "jtbd") in edges
    assert ("jtbd", "segments") in edges
    assert ("evidence", "segments") in edges
    imc_outgoing = [e for e in edges if e[0] == "imc"]
    assert imc_outgoing == []


@pytest.mark.unit
def test_summarize_execute_step_import_only_counts_as_data_effective() -> None:
    step: dict[str, object] = {
        "ordinal": 5,
        "title": "Анализ",
        "section_key": "analysis",
        "status": "completed",
        "report_payload": {"mode": "apply_if_empty", "execution_mode": "project_generate_async"},
        "applied_entities": [],
        "metrics_after": {"imported_sources_count": 3},
    }
    summary = _amka_summarize_execute_step_for_final(step)  # type: ignore[arg-type]
    assert summary["data_effective"] is True
    assert summary["imported_sources_count"] == 3
    assert summary["hint_ru"] == ""


@pytest.mark.unit
def test_toposort_amka_plan_tasks_orders_evidence_before_two_imc() -> None:
    ev = {
        "section_key": "evidence",
        "title": "E",
        "depends_on": [],
        "write_policy": "operation_based",
        "operations": [],
    }
    imc_a = {
        "section_key": "imc",
        "imc_type_key": "imc_rag_jtbd",
        "title": "J",
        "depends_on": ["evidence"],
        "write_policy": "apply_if_empty",
        "operations": [],
    }
    imc_b = {
        "section_key": "imc",
        "imc_type_key": "imc_rag_swot",
        "title": "S",
        "depends_on": ["evidence"],
        "write_policy": "apply_if_empty",
        "operations": [],
    }
    shuffled = [imc_a, ev, imc_b]
    ordered = _toposort_amka_plan_tasks(shuffled)
    assert [t["section_key"] for t in ordered] == ["evidence", "imc", "imc"]
    assert ordered[1]["imc_type_key"] == "imc_rag_jtbd"
    assert ordered[2]["imc_type_key"] == "imc_rag_swot"


@pytest.mark.unit
def test_normalize_operation_payloads_keeps_update_with_entity_id() -> None:
    service = AmkaService(MagicMock())
    ops = service._normalize_operation_payloads(
        [
            {
                "kind": "update",
                "entity_type": "job_story",
                "entity_id": "js-1",
                "payload": {"title": "Обновлённый JTBD"},
            }
        ],
        section_key="jtbd",
        base_operations=[],
    )
    assert len(ops) == 1
    assert ops[0]["kind"] == "update"
    assert ops[0]["entity_id"] == "js-1"


@pytest.mark.unit
def test_baseline_jtbd_value_zero_link_no_score_floor_and_work_needed() -> None:
    """0% JTBD↔VP integrity must not inflate score to 60 or hide gaps in work_needed."""
    service = AmkaService(MagicMock())
    snapshot: dict[str, object] = {
        "allowed_sections": ["jtbd", "value"],
        "health": {
            "readiness_score": 50,
            "strategy_integrity_score": 0,
            "gaps": [],
            "counts": {"jtbd": 1, "value_propositions": 1},
            "coverage": [],
            "strategy_integrity": [
                {"key": "jtbd_covered_by_value_props", "percentage": 0},
                {"key": "value_props_linked_to_jtbd", "percentage": 0},
            ],
            "freshness": [],
        },
        "project_context": {
            "project": {
                "company_name": "Co",
                "company_industry": "Ind",
                "company_description": "Desc",
                "company_website": "https://example.com",
                "name": "Proj",
                "description": "d",
                "goals": "g",
                "key_tasks": "k",
                "category": "c",
            }
        },
        "extras": {},
    }
    baseline = service._build_section_audits_baseline(snapshot)  # type: ignore[arg-type]
    by_key = {a["section_key"]: a["report_payload"] for a in baseline}
    jtbd = by_key["jtbd"]
    value = by_key["value"]
    assert jtbd["score"] == 0
    assert value["score"] == 0
    assert any("60%" in line or "ниже 60%" in line for line in jtbd["work_needed"])
    assert any("60%" in line or "ниже 60%" in line for line in value["work_needed"])


@pytest.mark.unit
def test_candidate_operations_skips_alert_create_when_many_open_alerts() -> None:
    service = AmkaService(MagicMock())
    audit = {"score": 40, "work_needed": ["Нужно внимание"], "status": "attention"}
    snapshot = {
        "health": {"counts": {"alerts": AMKA_ALERTS_HEURISTIC_CREATE_CAP + 5}},
        "section_entities": {"alerts": []},
    }
    ops = service._build_candidate_operations(
        section_key="alerts",
        audit_payload=audit,
        snapshot=snapshot,  # type: ignore[arg-type]
        rationale="r",
    )
    assert ops == []

    snapshot_ok = {
        "health": {"counts": {"alerts": 2}},
        "section_entities": {"alerts": []},
    }
    ops_ok = service._build_candidate_operations(
        section_key="alerts",
        audit_payload=audit,
        snapshot=snapshot_ok,  # type: ignore[arg-type]
        rationale="r",
    )
    assert len(ops_ok) == 1
    assert ops_ok[0]["kind"] == "create"


@pytest.mark.unit
def test_baseline_segments_strategy_integrity_issues_drop_score_floor() -> None:
    """Segments with 0% links must not get artificial 60 when Overview reports integrity issues."""
    service = AmkaService(MagicMock())
    snapshot: dict[str, object] = {
        "allowed_sections": ["segments", "jtbd", "evidence"],
        "health": {
            "readiness_score": 70,
            "strategy_integrity_score": 40,
            "gaps": [],
            "counts": {"segments": 3},
            "coverage": [],
            "strategy_integrity": [
                {"key": "segments_linked_to_evidence", "percentage": 0},
                {"key": "segments_linked_to_jtbd", "percentage": 0},
            ],
            "strategy_integrity_issues": [
                {
                    "code": "segments_without_context",
                    "severity": "high",
                    "title": "Есть сегменты без JTBD и evidence",
                    "description": "Проблема связности.",
                    "target_view": "segments",
                    "metric_value": 2,
                }
            ],
            "freshness": [],
        },
        "project_context": {
            "project": {
                "company_name": "Co",
                "company_industry": "Ind",
                "company_description": "Desc",
                "company_website": "https://example.com",
                "name": "Proj",
                "description": "d",
                "goals": "g",
                "key_tasks": "k",
                "category": "c",
            }
        },
        "extras": {},
    }
    baseline = service._build_section_audits_baseline(snapshot)  # type: ignore[arg-type]
    seg = next(a["report_payload"] for a in baseline if a["section_key"] == "segments")
    assert seg["score"] == 0
    assert seg["work_needed"]
    assert "segments_without_context" in (seg.get("integrity_issue_codes") or [])
    assert "jtbd" in seg["dependencies"] and "evidence" in seg["dependencies"]


@pytest.mark.unit
def test_baseline_campaigns_strategy_integrity_issues_and_dependencies() -> None:
    service = AmkaService(MagicMock())
    snapshot: dict[str, object] = {
        "allowed_sections": ["campaigns", "value", "segments"],
        "health": {
            "readiness_score": 70,
            "strategy_integrity_score": 50,
            "gaps": [],
            "counts": {"campaigns": 2},
            "coverage": [{"key": "campaigns_linked_to_strategy", "percentage": 0, "total": 2}],
            "strategy_integrity": [{"key": "campaigns_fully_linked", "percentage": 0}],
            "strategy_integrity_issues": [
                {
                    "code": "campaigns_partially_linked",
                    "severity": "medium",
                    "title": "Часть кампаний связана только наполовину",
                    "description": "Нужны VP и сегменты.",
                    "target_view": "campaigns",
                    "metric_value": 1,
                }
            ],
            "freshness": [],
        },
        "project_context": {
            "project": {
                "company_name": "Co",
                "company_industry": "Ind",
                "company_description": "Desc",
                "company_website": "https://example.com",
                "name": "Proj",
                "description": "d",
                "goals": "g",
                "key_tasks": "k",
                "category": "c",
            }
        },
        "extras": {},
    }
    baseline = service._build_section_audits_baseline(snapshot)  # type: ignore[arg-type]
    camp = next(a["report_payload"] for a in baseline if a["section_key"] == "campaigns")
    assert camp["score"] == 0
    assert camp["work_needed"]
    assert "value" in camp["dependencies"] and "segments" in camp["dependencies"]


@pytest.mark.unit
def test_candidate_tasks_keeps_section_when_integrity_issues_even_high_score() -> None:
    service = AmkaService(MagicMock())
    audits = [
        {
            "report_payload": {
                "section_key": "segments",
                "kind": "actionable",
                "score": 90,
                "count": 5,
                "work_needed": [],
                "dependencies": ["jtbd", "evidence"],
            }
        }
    ]
    snapshot = {
        "health": {
            "strategy_integrity_issues": [
                {
                    "code": "segments_without_jtbd_link",
                    "target_view": "segments",
                    "title": "t",
                    "severity": "medium",
                }
            ]
        }
    }
    tasks = service._build_candidate_tasks(audits, snapshot)  # type: ignore[arg-type]
    assert len(tasks) == 1
    assert tasks[0]["section_key"] == "segments"


@pytest.mark.unit
def test_normalize_plan_tasks_filters_unknown_addresses_issue_codes() -> None:
    service = AmkaService(MagicMock())
    candidates = [
        {
            "step_key": "execute_segments",
            "section_key": "segments",
            "title": "Сегменты",
            "depends_on": ["jtbd"],
            "write_policy": "operation_based",
            "rationale": "r",
            "execution_mode": "project_generate_async",
            "autofill_targets": ["segments"],
            "operations": [],
        }
    ]
    health = {
        "strategy_integrity_issues": [
            {"code": "segments_without_context", "target_view": "segments", "title": "x", "severity": "high"}
        ]
    }
    out = service._normalize_plan_tasks(
        [
            {
                "section_key": "segments",
                "title": "t",
                "rationale": "r",
                "depends_on": ["jtbd"],
                "write_policy": "operation_based",
                "execution_mode": "project_generate_async",
                "operations": [],
                "addresses_issue_codes": ["segments_without_context", "made_up_code"],
            }
        ],
        candidates,
        health=health,
    )
    assert out[0].get("addresses_issue_codes") == ["segments_without_context"]


@pytest.mark.unit
def test_amka_log_line_stable_prefix_and_sorted_extra() -> None:
    from api.services.marketing_cabinet.amka_logging import amka_log_line

    line = amka_log_line("audit.section_fallback", run_id="r1", section="jtbd", z=9, a=1)
    assert line.startswith("[AMKA] event=audit.section_fallback")
    assert "run_id=r1" in line
    assert "section=jtbd" in line
    assert line.index("a=1") < line.index("z=9")


@pytest.mark.unit
def test_apply_plan_and_start_execute_spawns_execute_background() -> None:
    async def _run() -> None:
        run_id = uuid4()
        user_id = uuid4()
        svc = AmkaService(MagicMock())
        svc._get_run_checked = AsyncMock(return_value={"id": str(run_id), "progress": 30})
        svc._skip_execute_section_steps = AsyncMock()
        svc._apply_skip_operation_keys = AsyncMock()
        svc._update_run = AsyncMock(return_value={"id": str(run_id)})
        svc._run_execute_background = AsyncMock()
        captured: dict[str, object] = {}

        def fake_spawn(key: str, coro: object) -> None:
            captured["key"] = key
            captured["coro"] = coro

        with patch("api.services.marketing_cabinet.amka_background_tasks._spawn_background", fake_spawn):
            out = await svc._apply_plan_and_start_execute(
                run_id=run_id,
                user_id=user_id,
                skip_section_keys=[],
                skip_operation_keys=[],
            )
        assert out["ok"] is True
        assert captured["key"] == f"amka-exec:{run_id}"
        assert captured["coro"] is not None

    asyncio.run(_run())


@pytest.mark.unit
def test_continue_step_run_spawns_execute_background() -> None:
    async def _run() -> None:
        run_id = uuid4()
        user_id = uuid4()
        svc = AmkaService(MagicMock())
        svc._get_run_checked = AsyncMock(return_value={"id": str(run_id), "status": "awaiting_step_approval"})
        svc._update_run = AsyncMock(return_value={"id": str(run_id)})
        svc._run_execute_background = AsyncMock()
        captured: dict[str, object] = {}

        def fake_spawn(key: str, coro: object) -> None:
            captured["key"] = key

        with patch("api.services.marketing_cabinet.amka_background_tasks._spawn_background", fake_spawn):
            out = await svc.continue_step_run(run_id=run_id, user_id=user_id)
        assert out["ok"] is True
        assert captured["key"] == f"amka-exec:{run_id}"

    asyncio.run(_run())


@pytest.mark.unit
def test_skip_execute_section_steps_marks_pending_as_skipped() -> None:
    async def _run() -> None:
        rid = uuid4()
        sid = uuid4()
        svc = AmkaService(MagicMock())
        svc._list_steps = AsyncMock(
            return_value=[
                {
                    "id": str(sid),
                    "stage_kind": "execute_section",
                    "status": "pending",
                    "section_key": "analysis",
                },
            ]
        )
        svc._update_step = AsyncMock()
        await svc._skip_execute_section_steps(run_id=rid, skip_section_keys={"analysis"})
        svc._update_step.assert_awaited()

    asyncio.run(_run())


@pytest.mark.unit
def test_skip_execute_section_steps_marks_pending_by_step_id_only() -> None:
    async def _run() -> None:
        rid = uuid4()
        sid_keep = uuid4()
        sid_skip = uuid4()
        svc = AmkaService(MagicMock())
        svc._list_steps = AsyncMock(
            return_value=[
                {
                    "id": str(sid_keep),
                    "stage_kind": "execute_section",
                    "status": "pending",
                    "section_key": "imc",
                },
                {
                    "id": str(sid_skip),
                    "stage_kind": "execute_section",
                    "status": "pending",
                    "section_key": "imc",
                },
            ]
        )
        svc._update_step = AsyncMock()
        await svc._skip_execute_section_steps(run_id=rid, skip_section_keys=set(), skip_step_ids={sid_skip})
        assert svc._update_step.await_count == 1
        step_call = svc._update_step.await_args
        assert step_call is not None
        called_id = step_call.args[0]
        assert called_id == sid_skip

    asyncio.run(_run())


@pytest.mark.unit
def test_merge_preset_tasks_inserts_after_anchor_section() -> None:
    from api.schemas.marketing_cabinet.amka_preset import AmkaPresetConfigV1, AmkaPresetExtraPlanTaskIn
    from api.services.marketing_cabinet.amka_preset_merge import merge_preset_tasks_into_plan_tasks

    base = [
        {
            "section_key": "evidence",
            "title": "Evidence",
            "step_key": "exec_evidence",
            "depends_on": [],
            "write_policy": "operation_based",
            "operations": [],
        },
    ]
    preset = AmkaPresetConfigV1(
        extra_plan_tasks=[
            AmkaPresetExtraPlanTaskIn(
                insert_after_section_key="evidence",
                task={
                    "section_key": "analysis",
                    "title": "Analysis preset",
                    "execution_mode": "mutation_service",
                    "write_policy": "operation_based",
                    "depends_on": [],
                    "operations": [],
                },
            ),
        ],
    )
    merged = merge_preset_tasks_into_plan_tasks(base, preset)
    assert [t["section_key"] for t in merged] == ["evidence", "analysis"]


@pytest.mark.unit
def test_strategy_graph_reconcile_best_fuzzy_match() -> None:
    from api.services.marketing_cabinet.amka_strategy_graph_reconcile import _best_fuzzy_match

    u_evidence = UUID(int=50)
    u_other = UUID(int=51)
    choices = [(u_other, "Other entity"), (u_evidence, "Research evidence pack")]
    picked, score = _best_fuzzy_match("evidence pack", choices)
    assert picked == u_evidence
    assert score >= 0.38


@pytest.mark.unit
def test_strategy_graph_reconcile_matches_segment_against_content_excerpt() -> None:
    from api.services.marketing_cabinet.amka_strategy_graph_reconcile import _best_fuzzy_match, _content_choice_text

    u_generic = UUID(int=60)
    u_relevant = UUID(int=61)
    choices = [
        (u_generic, "SWOT-анализ — RAG"),
        (
            u_relevant,
            _content_choice_text(
                "Позиционирование и сообщения — RAG",
                "Для ICP B2B SaaS продуктовые компании 200–2000 сотрудников важны исследования, сегментация и запуск фич.",
            ),
        ),
    ]

    picked, score = _best_fuzzy_match("ICP B2B SaaS продуктовые компании 200–2000 сотрудников", choices)

    assert picked == u_relevant
    assert score >= 0.42


@pytest.mark.unit
def test_strategy_graph_reconcile_llm_confirms_segment_content_candidate() -> None:
    async def _run() -> None:
        from api.services.marketing_cabinet.amka_strategy_graph_reconcile import _llm_confirm_segment_content_link

        llm_json = AsyncMock(return_value={"confirmed": True, "reason": "Evidence describes the ICP segment."})
        confirmed = await _llm_confirm_segment_content_link(
            llm_json,
            segment={
                "id": str(UUID(int=70)),
                "name": "ICP B2B SaaS",
                "description": "Продуктовые компании 200–2000 сотрудников.",
            },
            content={
                "id": str(UUID(int=71)),
                "title": "Voice of customer research",
                "excerpt": "Исследование ICP B2B SaaS продуктовых компаний 200–2000 сотрудников.",
            },
            fuzzy_confidence=0.48,
        )

        assert confirmed is True
        llm_call = llm_json.await_args
        assert llm_call is not None
        prompt = str(llm_call.kwargs["prompt"])
        assert "confirmed" in prompt
        assert str(UUID(int=70)) in prompt

    asyncio.run(_run())


@pytest.mark.unit
def test_strategy_graph_reconcile_norm_text_collapses_whitespace() -> None:
    from api.services.marketing_cabinet.amka_strategy_graph_reconcile import _norm_text

    assert _norm_text("  Foo\tBAR  ") == "foo bar"


@pytest.mark.unit
def test_snapshot_value_prop_ids_with_jtbd_links_queries_pool() -> None:
    async def _run() -> None:
        from api.services.marketing_cabinet.amka_strategy_graph_reconcile import (
            snapshot_value_prop_ids_with_jtbd_links,
        )

        pid = uuid4()
        u1, u2 = uuid4(), uuid4()
        mock_conn = AsyncMock()
        mock_conn.fetch = AsyncMock(return_value=[{"id": u1}, {"id": u2}])
        acq = MagicMock()
        acq.__aenter__ = AsyncMock(return_value=mock_conn)
        acq.__aexit__ = AsyncMock(return_value=None)
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(return_value=acq)

        out = await snapshot_value_prop_ids_with_jtbd_links(mock_pool, pid)
        assert out == frozenset({u1, u2})
        mock_conn.fetch.assert_awaited_once()

    asyncio.run(_run())


@pytest.mark.unit
def test_filter_plan_tasks_operations_removes_skipped_keys() -> None:
    svc = AmkaService(MagicMock())
    tasks = [
        {
            "section_key": "analysis",
            "operations": [
                {"operation_key": "keep_me", "kind": "replace"},
                {"operation_key": "skip_me", "kind": "delete"},
            ],
        }
    ]
    out = svc._filter_plan_tasks_operations(tasks, {"skip_me"})
    assert len(out) == 1
    assert len(out[0]["operations"]) == 1
    assert out[0]["operations"][0]["operation_key"] == "keep_me"


@pytest.mark.unit
def test_apply_skip_operation_keys_updates_run_and_pending_steps() -> None:
    async def _run() -> None:
        rid = uuid4()
        uid = uuid4()
        sid = uuid4()
        svc = AmkaService(MagicMock())
        svc._get_run_checked = AsyncMock(
            return_value={
                "id": str(rid),
                "master_plan": [
                    {
                        "section_key": "analysis",
                        "operations": [
                            {"operation_key": "op_keep", "kind": "replace"},
                            {"operation_key": "op_drop", "kind": "delete"},
                        ],
                    }
                ],
            }
        )
        svc._list_steps = AsyncMock(
            return_value=[
                {
                    "id": str(sid),
                    "stage_kind": "execute_section",
                    "status": "pending",
                    "plan_payload": {
                        "operations": [
                            {"operation_key": "op_keep", "kind": "replace"},
                            {"operation_key": "op_drop", "kind": "delete"},
                        ],
                    },
                }
            ]
        )
        conn = MagicMock()
        conn.execute = AsyncMock(return_value="UPDATE 1")
        acq = MagicMock()
        acq.__aenter__ = AsyncMock(return_value=conn)
        acq.__aexit__ = AsyncMock(return_value=None)
        svc._db_pool.acquire = MagicMock(return_value=acq)

        await svc._apply_skip_operation_keys(run_id=rid, user_id=uid, skip_operation_keys={"op_drop"})
        assert conn.execute.await_count == 2

    asyncio.run(_run())


@pytest.mark.unit
def test_execute_section_step_delegates_to_phase_module() -> None:
    async def _run() -> None:
        svc = AmkaService(MagicMock())
        with patch(
            "api.services.marketing_cabinet.amka_service.run_execute_section_step",
            new_callable=AsyncMock,
            return_value={"report_markdown": "## ok", "report_payload": {}, "applied_entities": []},
        ) as m:
            out = await svc._execute_section_step(
                run_id=uuid4(),
                user_id=uuid4(),
                step={
                    "id": str(uuid4()),
                    "section_key": "analysis",
                    "title": "T",
                    "plan_payload": {},
                },
            )
        assert out["report_markdown"] == "## ok"
        m.assert_awaited_once()

    asyncio.run(_run())


@pytest.mark.unit
def test_run_execute_background_per_step_pauses_with_remaining_sections() -> None:
    async def _run() -> None:
        from api.services.marketing_cabinet.amka_phases import run_execute_background

        rid = uuid4()
        uid = uuid4()
        s1 = str(uuid4())
        s2 = str(uuid4())
        sf = str(uuid4())
        svc = MagicMock()
        svc._fetch_run_value = AsyncMock(return_value={"per_step_execution": True})
        svc._get_run_checked = AsyncMock(return_value={"status": "running", "progress": 35, "started_at": None})
        pending_batch = [
            {
                "id": s1,
                "stage_kind": "execute_section",
                "status": "pending",
                "title": "A",
                "section_key": "analysis",
                "plan_payload": {},
            },
            {
                "id": s2,
                "stage_kind": "execute_section",
                "status": "pending",
                "title": "B",
                "section_key": "evidence",
                "plan_payload": {},
            },
            {
                "id": sf,
                "stage_kind": "final_assessment",
                "status": "pending",
                "title": "F",
                "plan_payload": {},
            },
        ]
        completed_batch = [
            {**pending_batch[0], "status": "completed"},
            {**pending_batch[1], "status": "pending"},
            pending_batch[2],
        ]
        calls = {"i": 0}

        async def list_steps(_rid: object) -> list[dict[str, object]]:
            i = calls["i"]
            calls["i"] += 1
            return pending_batch if i == 0 else completed_batch

        svc._list_steps = AsyncMock(side_effect=list_steps)
        svc._update_run = AsyncMock()
        svc._update_step = AsyncMock()
        svc._build_run_snapshot = AsyncMock(
            return_value={
                "project_context_text": "ctx",
                "operator_amka": {},
                "recent_amka_runs_digest": [],
                "recent_amka_runs_digest_markdown": "",
                "extras": {},
            }
        )
        svc._execute_section_step = AsyncMock(
            return_value={
                "report_markdown": "## x",
                "report_payload": {},
                "applied_entities": [],
                "metrics_before": {},
                "metrics_after": {},
            }
        )
        svc._execute_final_assessment = AsyncMock()

        await run_execute_background(svc, run_id=rid, user_id=uid)

        assert any(ca.kwargs.get("status_value") == "awaiting_step_approval" for ca in svc._update_run.await_args_list)

    asyncio.run(_run())


@pytest.mark.unit
def test_reconcile_child_ai_run_until_terminal_completes() -> None:
    async def _run() -> None:
        from api.services.marketing_cabinet.amka_execute_async_helpers import (
            reconcile_child_ai_run_until_terminal,
        )

        cid = uuid4()
        svc = MagicMock()
        ai = MagicMock()
        with (
            patch(
                "api.services.marketing_cabinet.amka_execute_async_helpers.fetch_marketing_ai_run_row",
                new_callable=AsyncMock,
                return_value={"id": cid, "status": "running"},
            ),
            patch(
                "api.services.marketing_cabinet.amka_execute_async_helpers.reconcile_marketing_ai_run",
                new_callable=AsyncMock,
                return_value={"status": "completed"},
            ),
        ):
            out = await reconcile_child_ai_run_until_terminal(svc, child_run_id=cid, max_wait_s=30.0, ai_service=ai)
        assert out["status"] == "completed"

    asyncio.run(_run())


@pytest.mark.unit
def test_reconcile_child_ai_run_until_terminal_times_out() -> None:
    async def _run() -> None:
        from api.services.marketing_cabinet.amka_execute_async_helpers import (
            reconcile_child_ai_run_until_terminal,
        )

        cid = uuid4()
        svc = MagicMock()
        ai = MagicMock()
        perf_vals = iter([0.0, 5.0, 100.0])

        def _perf() -> float:
            return next(perf_vals)

        with (
            patch(
                "api.services.marketing_cabinet.amka_execute_async_helpers.fetch_marketing_ai_run_row",
                new_callable=AsyncMock,
                return_value={"id": cid, "status": "running"},
            ),
            patch(
                "api.services.marketing_cabinet.amka_execute_async_helpers.reconcile_marketing_ai_run",
                new_callable=AsyncMock,
                return_value={"status": "running"},
            ),
            patch(
                "api.services.marketing_cabinet.amka_execute_async_helpers.perf_counter",
                side_effect=_perf,
            ),
            patch(
                "api.services.marketing_cabinet.amka_execute_async_helpers.asyncio.sleep",
                new_callable=AsyncMock,
            ),
        ):
            with pytest.raises(TimeoutError):
                await reconcile_child_ai_run_until_terminal(svc, child_run_id=cid, max_wait_s=10.0, ai_service=ai)

    asyncio.run(_run())


@pytest.mark.unit
def test_materialize_operation_sources_passthrough_non_import() -> None:
    async def _run() -> None:
        from api.services.marketing_cabinet.amka_execute_operation_sources import (
            materialize_operation_sources,
        )

        svc = AmkaService(MagicMock())
        svc._source_resolver = MagicMock()
        pid, uid = uuid4(), uuid4()
        ops: list[dict[str, object]] = [{"kind": "replace", "operation_key": "k1"}]
        out = await materialize_operation_sources(svc, project_id=pid, user_id=uid, operations=ops)
        assert out == ops
        svc._source_resolver.materialize_source_ref.assert_not_called()

    asyncio.run(_run())


@pytest.mark.unit
def test_materialize_operation_sources_resolves_import() -> None:
    async def _run() -> None:
        from api.services.marketing_cabinet.amka_execute_operation_sources import (
            materialize_operation_sources,
        )

        svc = AmkaService(MagicMock())
        svc._source_resolver = MagicMock()
        svc._source_resolver.materialize_source_ref = AsyncMock(return_value={"content_id": "c1", "type": "imc_run"})
        pid, uid = uuid4(), uuid4()
        ops = [
            {
                "kind": "import_analysis_artifact",
                "source_ref": {"type": "imc", "id": "x"},
            }
        ]
        out = await materialize_operation_sources(svc, project_id=pid, user_id=uid, operations=ops)
        assert out[0].get("entity_id") == "c1"
        assert (out[0].get("payload") or {}).get("content_id") == "c1"

    asyncio.run(_run())


@pytest.mark.unit
def test_execute_operations_import_analysis_artifact_soft_fails_without_content_id() -> None:
    async def _run() -> None:
        from api.services.marketing_cabinet.amka_mutation_service import AmkaMutationService

        async def llm_text(*_a: object, **_k: object) -> str:
            return ""

        svc = AmkaMutationService(MagicMock())
        rid = str(uuid4())
        out = await svc.execute_operations(
            project_id=uuid4(),
            user_id=uuid4(),
            operations=[
                {
                    "kind": "import_analysis_artifact",
                    "entity_type": "content_source",
                    "source_ref": {"type": "imc_run", "id": rid},
                },
            ],
            project_context_text="",
            llm_text=llm_text,
        )
        trail = out["operation_trail"]
        assert len(trail) == 1
        assert trail[0]["result"]["status"] == "failed"
        assert rid in str(trail[0]["result"].get("message") or "")

    asyncio.run(_run())


@pytest.mark.unit
def test_llm_plan_json_delegates_to_module() -> None:
    async def _run() -> None:
        svc = AmkaService(MagicMock())
        with patch(
            "api.services.marketing_cabinet.amka_service.run_llm_plan_json",
            new_callable=AsyncMock,
            return_value={"tasks": []},
        ) as m:
            out = await svc._llm_plan_json(
                snapshot={"run": {"id": uuid4()}},
                audit_steps=[],
                candidate_tasks=[],
            )
        assert out == {"tasks": []}
        m.assert_awaited_once()

    asyncio.run(_run())


@pytest.mark.unit
def test_poll_imc_research_row_returns_on_terminal_status() -> None:
    async def _run() -> None:
        from api.services.marketing_cabinet.amka_execute_async_helpers import poll_imc_research_row

        rid = uuid4()
        uid = uuid4()
        svc = MagicMock()
        conn = MagicMock()
        acquire = MagicMock()
        acquire.__aenter__ = AsyncMock(return_value=conn)
        acquire.__aexit__ = AsyncMock(return_value=None)
        svc._db_pool.acquire.return_value = acquire

        imc_svc = MagicMock()
        imc_svc.get_research_status = AsyncMock(return_value={"synced": True})

        @asynccontextmanager
        async def fake_session():
            yield imc_svc

        n = {"i": 0}

        async def fetchrow(*_a: object, **_k: object):
            n["i"] += 1
            if n["i"] == 1:
                return {"id": rid, "status": "running", "type_key": "t", "display_name": "d", "errors": None}
            return {"id": rid, "status": "completed", "type_key": "t", "display_name": "d", "errors": None}

        conn.fetchrow = AsyncMock(side_effect=fetchrow)

        with (
            patch(
                "api.services.marketing_cabinet.amka_execute_async_helpers._imc_service_ugs_session",
                fake_session,
            ),
            patch(
                "api.services.marketing_cabinet.amka_execute_async_helpers.asyncio.sleep",
                new_callable=AsyncMock,
            ),
        ):
            out = await poll_imc_research_row(svc, research_id=rid, user_id=uid, max_wait_s=30.0)
        assert out["status"] == "completed"

    asyncio.run(_run())


@pytest.mark.unit
def test_poll_imc_research_row_returns_last_row_when_deadline_passes() -> None:
    async def _run() -> None:
        from api.services.marketing_cabinet.amka_execute_async_helpers import poll_imc_research_row

        rid = uuid4()
        uid = uuid4()
        svc = MagicMock()
        conn = MagicMock()
        acquire = MagicMock()
        acquire.__aenter__ = AsyncMock(return_value=conn)
        acquire.__aexit__ = AsyncMock(return_value=None)
        svc._db_pool.acquire.return_value = acquire

        imc_svc = MagicMock()
        imc_svc.get_research_status = AsyncMock(return_value={"synced": True})

        @asynccontextmanager
        async def fake_session():
            yield imc_svc

        conn.fetchrow = AsyncMock(
            return_value={"id": rid, "status": "running", "type_key": "t", "display_name": "d", "errors": None}
        )

        perf_vals = iter([0.0, 0.0, 31.0])

        def _perf() -> float:
            return next(perf_vals)

        with (
            patch(
                "api.services.marketing_cabinet.amka_execute_async_helpers._imc_service_ugs_session",
                fake_session,
            ),
            patch(
                "api.services.marketing_cabinet.amka_execute_async_helpers.perf_counter",
                side_effect=_perf,
            ),
            patch(
                "api.services.marketing_cabinet.amka_execute_async_helpers.asyncio.sleep",
                new_callable=AsyncMock,
            ),
        ):
            out = await poll_imc_research_row(svc, research_id=rid, user_id=uid, max_wait_s=30.0)
        assert out["status"] == "running"

    asyncio.run(_run())


@pytest.mark.unit
def test_poll_imc_research_row_raises_when_imc_row_missing() -> None:
    async def _run() -> None:
        from api.services.marketing_cabinet.amka_execute_async_helpers import poll_imc_research_row

        rid = uuid4()
        uid = uuid4()
        svc = MagicMock()
        conn = MagicMock()
        acquire = MagicMock()
        acquire.__aenter__ = AsyncMock(return_value=conn)
        acquire.__aexit__ = AsyncMock(return_value=None)
        svc._db_pool.acquire.return_value = acquire

        imc_svc = MagicMock()
        imc_svc.get_research_status = AsyncMock(return_value={"synced": True})

        @asynccontextmanager
        async def fake_session():
            yield imc_svc

        conn.fetchrow = AsyncMock(return_value=None)

        with (
            patch(
                "api.services.marketing_cabinet.amka_execute_async_helpers._imc_service_ugs_session",
                fake_session,
            ),
            pytest.raises(RuntimeError, match="не найден"),
        ):
            await poll_imc_research_row(svc, research_id=rid, user_id=uid, max_wait_s=5.0)

    asyncio.run(_run())


@pytest.mark.unit
def test_normalize_source_refs_skips_empty_ids() -> None:
    from api.services.marketing_cabinet.amka_plan_candidates import normalize_source_refs

    refs = normalize_source_refs(
        [
            {"type": "vault", "id": "", "title": "x"},
            {"type": "vault", "id": "a1", "title": "ok"},
        ]
    )
    assert len(refs) == 1
    assert refs[0]["id"] == "a1"


@pytest.mark.unit
def test_normalize_operation_payloads_non_list_falls_back_to_base() -> None:
    from api.services.marketing_cabinet.amka_plan_candidates import normalize_operation_payloads

    base = [
        {
            "operation_key": "k1",
            "kind": "replace",
            "entity_type": "swot",
            "entity_id": None,
            "target_section": "swot",
            "title": "t",
            "reason": None,
            "expected_effect": None,
            "destructive": True,
            "requires_backup": True,
            "payload": {},
            "replacement_payload": {},
            "source_refs": [],
            "source_ref": {},
        }
    ]
    out = normalize_operation_payloads(None, section_key="swot", base_operations=base)
    assert len(out) == 1
    assert out[0]["kind"] == "replace"
    assert out[0].get("operation_key")
