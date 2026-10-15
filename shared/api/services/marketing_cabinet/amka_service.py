from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.services.marketing_cabinet import amka_run_lifecycle as amka_lc
from api.services.marketing_cabinet import amka_service_digest as amka_digest
from api.services.marketing_cabinet.amka_execute_async_helpers import (
    poll_imc_research_row as amka_poll_imc_research_row,
)
from api.services.marketing_cabinet.amka_execute_async_helpers import (
    reconcile_child_ai_run_until_terminal as amka_reconcile_child_ai_run_until_terminal,
)
from api.services.marketing_cabinet.amka_execute_async_helpers import (
    run_imc_research_for_section as amka_run_imc_research_for_section,
)
from api.services.marketing_cabinet.amka_execute_async_helpers import (
    run_project_generate_async_for_section as amka_run_project_generate_async_for_section,
)
from api.services.marketing_cabinet.amka_execute_operation_sources import (
    materialize_operation_sources as amka_materialize_operation_sources,
)
from api.services.marketing_cabinet.amka_llm_plan import run_llm_plan_json
from api.services.marketing_cabinet.amka_llm_runtime import amka_llm_json, amka_llm_text
from api.services.marketing_cabinet.amka_markdown_render import (
    describe_operation_snapshot as amka_describe_operation_snapshot,
)
from api.services.marketing_cabinet.amka_markdown_render import (
    render_audit_markdown as amka_render_audit_markdown,
)
from api.services.marketing_cabinet.amka_markdown_render import (
    render_autofill_report as amka_render_autofill_report,
)
from api.services.marketing_cabinet.amka_markdown_render import (
    render_fallback_final_markdown as amka_render_fallback_final_markdown,
)
from api.services.marketing_cabinet.amka_markdown_render import (
    render_master_plan_markdown as amka_render_master_plan_markdown,
)
from api.services.marketing_cabinet.amka_markdown_render import (
    render_operation_execution_report as amka_render_operation_execution_report,
)
from api.services.marketing_cabinet.amka_markdown_render import (
    render_report_only_execution as amka_render_report_only_execution,
)
from api.services.marketing_cabinet.amka_mutation_service import AmkaMutationService
from api.services.marketing_cabinet.amka_operator_config import (
    fetch_stored_operator_config,
    merge_effective_operator_config,
)
from api.services.marketing_cabinet.amka_phases import (
    amka_build_master_plan,
    amka_build_section_audits,
    amka_build_section_audits_baseline,
    amka_enrich_section_audits_with_llm,
    amka_enrich_single_section_audit_llm,
    merge_section_audit_payload,
    run_execute_background,
    run_execute_section_step,
    run_final_assessment,
    run_plan_background,
)
from api.services.marketing_cabinet.amka_plan_candidates import (
    build_candidate_operations as amka_build_candidate_operations,
)
from api.services.marketing_cabinet.amka_plan_candidates import (
    build_candidate_tasks as amka_build_candidate_tasks,
)
from api.services.marketing_cabinet.amka_plan_candidates import (
    ensure_operation_keys_on_ops as amka_ensure_operation_keys_on_ops,
)
from api.services.marketing_cabinet.amka_plan_candidates import (
    normalize_operation_payloads as amka_normalize_operation_payloads,
)
from api.services.marketing_cabinet.amka_plan_candidates import (
    normalize_plan_tasks as amka_normalize_plan_tasks,
)
from api.services.marketing_cabinet.amka_plan_candidates import (
    normalize_source_refs as amka_normalize_source_refs,
)
from api.services.marketing_cabinet.amka_plan_candidates import (
    preferred_source_refs as amka_preferred_source_refs,
)
from api.services.marketing_cabinet.amka_run_snapshot import (
    build_run_snapshot as amka_build_run_snapshot,
)
from api.services.marketing_cabinet.amka_run_snapshot import (
    fetch_project_extras as amka_fetch_project_extras,
)
from api.services.marketing_cabinet.amka_run_store import (
    fetch_run_value as amka_fetch_run_value,
)
from api.services.marketing_cabinet.amka_run_store import (
    get_run_checked as amka_get_run_checked,
)
from api.services.marketing_cabinet.amka_run_store import (
    insert_step as amka_insert_step,
)
from api.services.marketing_cabinet.amka_run_store import (
    list_steps as amka_list_steps,
)
from api.services.marketing_cabinet.amka_run_store import (
    replace_steps as amka_replace_steps,
)
from api.services.marketing_cabinet.amka_run_store import (
    reset_failed_or_running_steps as amka_reset_failed_or_running_steps,
)
from api.services.marketing_cabinet.amka_run_store import (
    update_run as amka_update_run,
)
from api.services.marketing_cabinet.amka_run_store import (
    update_step as amka_update_step,
)
from api.services.marketing_cabinet.amka_service_support import *  # noqa: F403
from api.services.marketing_cabinet.amka_source_resolver import AmkaSourceResolver
from api.services.marketing_cabinet_ai_service import MarketingCabinetAIService


class AmkaService:
    def __init__(self, db_pool: asyncpg.Pool) -> None:
        self._db_pool = db_pool
        self._mutation_service = AmkaMutationService(db_pool)
        self._source_resolver = AmkaSourceResolver(db_pool)

    async def _operator_effective_execute_max_wait_seconds(self) -> float:
        stored = await fetch_stored_operator_config(self._db_pool)
        eff = merge_effective_operator_config(stored)
        return float(eff.execute["max_wait_seconds"])

    async def _load_recent_amka_runs_digest(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        exclude_run_id: UUID | None,
        limit: int = 3,
    ) -> list[dict[str, Any]]:
        """Последние завершённые запуски AMKA по проекту (для промпта и UI)."""
        return await amka_digest.load_recent_amka_runs_digest(
            self,
            project_id=project_id,
            user_id=user_id,
            exclude_run_id=exclude_run_id,
            limit=limit,
        )

    def _apply_entity_edit_bias_to_audits(
        self,
        audits: list[dict[str, Any]],
        snapshot: dict[str, Any],
    ) -> None:
        amka_digest.apply_entity_edit_bias_to_audits(self, audits, snapshot)

    async def _reconcile_child_ai_run_until_terminal(
        self,
        *,
        child_run_id: UUID,
        max_wait_s: float,
        ai_service: MarketingCabinetAIService,
    ) -> dict[str, Any]:
        return await amka_reconcile_child_ai_run_until_terminal(
            self,
            child_run_id=child_run_id,
            max_wait_s=max_wait_s,
            ai_service=ai_service,
        )

    async def _run_project_generate_async_for_section(
        self,
        *,
        run_id: UUID,
        step: dict[str, Any],
        user_id: UUID,
        plan_payload: dict[str, Any],
        section_key: str,
        audit_payload: dict[str, Any],
    ) -> dict[str, Any]:
        return await amka_run_project_generate_async_for_section(
            self,
            run_id=run_id,
            step=step,
            user_id=user_id,
            plan_payload=plan_payload,
            section_key=section_key,
            audit_payload=audit_payload,
        )

    async def _poll_imc_research_row(
        self,
        *,
        research_id: UUID,
        user_id: UUID,
        max_wait_s: float,
    ) -> dict[str, Any]:
        """Ждём терминальный статус в БД. На каждой итерации тянем статус из UGS через ImcService (как кнопка «обновить» в UI)."""
        return await amka_poll_imc_research_row(
            self,
            research_id=research_id,
            user_id=user_id,
            max_wait_s=max_wait_s,
        )

    async def _run_imc_research_for_section(
        self,
        *,
        run_id: UUID,
        step: dict[str, Any],
        user_id: UUID,
        run: dict[str, Any],
        plan_payload: dict[str, Any],
        audit_payload: dict[str, Any],
        user_instruction: str,
        cabinet_audit_haystack: str = "",
        imc_haystack_sections: int = 0,
        operator_execute: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return await amka_run_imc_research_for_section(
            self,
            run_id=run_id,
            step=step,
            user_id=user_id,
            run=run,
            plan_payload=plan_payload,
            audit_payload=audit_payload,
            user_instruction=user_instruction,
            cabinet_audit_haystack=cabinet_audit_haystack,
            imc_haystack_sections=imc_haystack_sections,
            operator_execute=operator_execute,
        )

    async def list_runs(self, *, project_id: UUID, user_id: UUID, limit: int = 20) -> dict[str, Any]:
        return await amka_lc.list_runs(self, project_id=project_id, user_id=user_id, limit=limit)

    async def get_run_detail(self, *, run_id: UUID, user_id: UUID) -> dict[str, Any]:
        return await amka_lc.get_run_detail(self, run_id=run_id, user_id=user_id)

    async def get_run_progress_snapshot(self, *, run_id: UUID, user_id: UUID) -> dict[str, Any]:
        """Лёгкий снимок для SSE: без overview_health_preview и без лишних запросов."""
        run = await self._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=False)
        steps = await self._list_steps(run_id)
        active = next((s for s in steps if s.get("status") == "running"), None)
        pending_exec = next(
            (
                s
                for s in steps
                if s.get("stage_kind") in {"execute_section", "final_assessment"}
                and s.get("status") in {"pending", "failed"}
            ),
            None,
        )
        return {
            "run_id": str(run_id),
            "status": run.get("status"),
            "current_stage": run.get("current_stage"),
            "progress": run.get("progress"),
            "progress_message": run.get("progress_message"),
            "active_step_id": str(active["id"]) if active and active.get("id") else None,
            "active_step_ordinal": active.get("ordinal") if active else None,
            "next_pending_step_id": str(pending_exec["id"]) if pending_exec and pending_exec.get("id") else None,
            "next_pending_step_ordinal": pending_exec.get("ordinal") if pending_exec else None,
        }

    async def create_run(
        self,
        *,
        project_id: UUID,
        company_id: UUID,
        user_id: UUID,
        scope_key: str,
        user_instruction: str | None,
        section_keys: list[str] | None = None,
        imc_type_key: str | None = None,
        imc_focus: str | None = None,
        imc_max_wait_seconds: int | None = None,
        run_mode: str = "semi_auto",
        auto_cycle_total: int = 1,
        auto_cycle_index: int | None = None,
        auto_cycle_group_id: str | None = None,
        per_step_execution: bool = False,
        preset_id: UUID | None = None,
        use_web_search: bool = False,
        web_search_quality: str = "off",
    ) -> dict[str, Any]:
        return await amka_lc.create_run(
            self,
            project_id=project_id,
            company_id=company_id,
            user_id=user_id,
            scope_key=scope_key,
            user_instruction=user_instruction,
            section_keys=section_keys,
            imc_type_key=imc_type_key,
            imc_focus=imc_focus,
            imc_max_wait_seconds=imc_max_wait_seconds,
            run_mode=run_mode,
            auto_cycle_total=auto_cycle_total,
            auto_cycle_index=auto_cycle_index,
            auto_cycle_group_id=auto_cycle_group_id,
            per_step_execution=per_step_execution,
            preset_id=preset_id,
            use_web_search=use_web_search,
            web_search_quality=web_search_quality,
        )

    def _coerce_amka_skip_section_keys(self, raw: Any) -> set[str]:  # noqa: ANN401
        return amka_lc.coerce_amka_skip_section_keys(raw)

    def _coerce_amka_skip_operation_keys(self, raw: Any) -> set[str]:  # noqa: ANN401
        return amka_lc.coerce_amka_skip_operation_keys(raw)

    def _filter_plan_tasks_operations(
        self,
        tasks: list[dict[str, Any]],
        skip_operation_keys: set[str],
    ) -> list[dict[str, Any]]:
        return amka_lc.filter_plan_tasks_operations(tasks, skip_operation_keys)

    async def _apply_skip_operation_keys(
        self,
        *,
        run_id: UUID,
        user_id: UUID,
        skip_operation_keys: set[str],
    ) -> None:
        await amka_lc.apply_skip_operation_keys(
            self, run_id=run_id, user_id=user_id, skip_operation_keys=skip_operation_keys
        )

    async def _skip_execute_section_steps(
        self,
        *,
        run_id: UUID,
        skip_section_keys: set[str],
        skip_step_ids: set[UUID] | None = None,
    ) -> None:
        await amka_lc.skip_execute_section_steps(
            self,
            run_id=run_id,
            skip_section_keys=skip_section_keys,
            skip_step_ids=skip_step_ids,
        )

    async def _apply_plan_and_start_execute(
        self,
        *,
        run_id: UUID,
        user_id: UUID,
        skip_section_keys: list[str] | None,
        skip_operation_keys: list[str] | None = None,
        skip_step_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        return await amka_lc.apply_plan_and_start_execute(
            self,
            run_id=run_id,
            user_id=user_id,
            skip_section_keys=skip_section_keys,
            skip_operation_keys=skip_operation_keys,
            skip_step_ids=skip_step_ids,
        )

    async def approve_run(
        self,
        *,
        run_id: UUID,
        user_id: UUID,
        skip_section_keys: list[str] | None = None,
        skip_operation_keys: list[str] | None = None,
        skip_step_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        return await amka_lc.approve_run(
            self,
            run_id=run_id,
            user_id=user_id,
            skip_section_keys=skip_section_keys,
            skip_operation_keys=skip_operation_keys,
            skip_step_ids=skip_step_ids,
        )

    async def continue_step_run(self, *, run_id: UUID, user_id: UUID) -> dict[str, Any]:
        return await amka_lc.continue_step_run(self, run_id=run_id, user_id=user_id)

    async def resume_run(
        self,
        *,
        run_id: UUID,
        user_id: UUID,
        skip_section_keys: list[str] | None = None,
        skip_operation_keys: list[str] | None = None,
        skip_step_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        return await amka_lc.resume_run(
            self,
            run_id=run_id,
            user_id=user_id,
            skip_section_keys=skip_section_keys,
            skip_operation_keys=skip_operation_keys,
            skip_step_ids=skip_step_ids,
        )

    async def cancel_run(self, *, run_id: UUID, user_id: UUID) -> dict[str, Any]:
        return await amka_lc.cancel_run(self, run_id=run_id, user_id=user_id)

    async def _run_plan_background(self, *, run_id: UUID, user_id: UUID) -> None:
        await run_plan_background(self, run_id=run_id, user_id=user_id)

    async def _run_execute_background(self, *, run_id: UUID, user_id: UUID) -> None:
        await run_execute_background(self, run_id=run_id, user_id=user_id)

    async def _maybe_start_next_auto_amka_cycle(self, *, prev_run_id: UUID, user_id: UUID) -> None:
        await amka_lc.maybe_start_next_auto_amka_cycle(self, prev_run_id=prev_run_id, user_id=user_id)

    async def _build_run_snapshot(
        self,
        *,
        run_id: UUID,
        user_id: UUID,
        reuse_static: dict[str, Any] | None = None,
        reuse_merged_project_context: str | None = None,
    ) -> dict[str, Any]:
        return await amka_build_run_snapshot(
            self,
            run_id=run_id,
            user_id=user_id,
            reuse_static=reuse_static,
            reuse_merged_project_context=reuse_merged_project_context,
        )

    async def _fetch_project_extras(self, *, project_id: UUID, user_id: UUID) -> dict[str, Any]:
        return await amka_fetch_project_extras(self, project_id=project_id, user_id=user_id)

    async def _build_section_audits(self, snapshot: dict[str, Any]) -> list[dict[str, Any]]:
        return await amka_build_section_audits(self, snapshot)

    def _build_section_audits_baseline(self, snapshot: dict[str, Any]) -> list[dict[str, Any]]:
        return amka_build_section_audits_baseline(self, snapshot)

    async def _enrich_single_section_audit_llm(
        self,
        *,
        snapshot: dict[str, Any],
        audit: dict[str, Any],
        health_excerpt: dict[str, Any],
    ) -> tuple[dict[str, Any] | None, bool, str]:
        return await amka_enrich_single_section_audit_llm(
            self,
            snapshot=snapshot,
            audit=audit,
            health_excerpt=health_excerpt,
        )

    async def _enrich_section_audits_with_llm(
        self,
        *,
        snapshot: dict[str, Any],
        audits: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        return await amka_enrich_section_audits_with_llm(self, snapshot=snapshot, audits=audits)

    def _merge_section_audit_payload(
        self,
        base_payload: dict[str, Any],
        override_payload: dict[str, Any],
    ) -> dict[str, Any]:
        return merge_section_audit_payload(base_payload, override_payload)

    async def _build_master_plan(
        self, *, snapshot: dict[str, Any], audit_steps: list[dict[str, Any]]
    ) -> dict[str, Any]:
        return await amka_build_master_plan(self, snapshot=snapshot, audit_steps=audit_steps)

    def _build_candidate_tasks(
        self,
        audit_steps: list[dict[str, Any]],
        snapshot: dict[str, Any],
    ) -> list[dict[str, Any]]:
        return amka_build_candidate_tasks(audit_steps, snapshot)

    def _preferred_source_refs(self, snapshot: dict[str, Any], *, limit: int = 3) -> list[dict[str, Any]]:
        return amka_preferred_source_refs(snapshot, limit=limit)

    def _build_candidate_operations(
        self,
        *,
        section_key: str,
        audit_payload: dict[str, Any],
        snapshot: dict[str, Any],
        rationale: str,
    ) -> list[dict[str, Any]]:
        return amka_build_candidate_operations(
            section_key=section_key,
            audit_payload=audit_payload,
            snapshot=snapshot,
            rationale=rationale,
        )

    async def _llm_plan_json(
        self,
        *,
        snapshot: dict[str, Any],
        audit_steps: list[dict[str, Any]],
        candidate_tasks: list[dict[str, Any]],
    ) -> dict[str, Any]:
        return await run_llm_plan_json(
            snapshot=snapshot,
            audit_steps=audit_steps,
            candidate_tasks=candidate_tasks,
        )

    def _normalize_plan_tasks(
        self,
        raw_tasks: Any,
        candidate_tasks: list[dict[str, Any]],
        *,
        health: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        return amka_normalize_plan_tasks(raw_tasks, candidate_tasks, health=health)

    def _ensure_operation_keys_on_ops(self, ops: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return amka_ensure_operation_keys_on_ops(ops)

    def _normalize_operation_payloads(
        self,
        raw_operations: Any,
        *,
        section_key: str,
        base_operations: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        return amka_normalize_operation_payloads(
            raw_operations,
            section_key=section_key,
            base_operations=base_operations,
        )

    def _normalize_source_refs(self, raw_refs: Any) -> list[dict[str, Any]]:
        return amka_normalize_source_refs(raw_refs)

    async def _materialize_operation_sources(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        operations: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        return await amka_materialize_operation_sources(
            self,
            project_id=project_id,
            user_id=user_id,
            operations=operations,
        )

    def _describe_operation_snapshot(self, snapshot: Any) -> str | None:
        return amka_describe_operation_snapshot(snapshot)

    def _render_operation_execution_report(
        self,
        *,
        section_key: str,
        title: str,
        operation_trail: list[dict[str, Any]],
        metrics_after: dict[str, Any],
    ) -> str:
        return amka_render_operation_execution_report(
            section_key=section_key,
            title=title,
            operation_trail=operation_trail,
            metrics_after=metrics_after,
        )

    async def _execute_section_step(
        self,
        *,
        run_id: UUID,
        step: dict[str, Any],
        user_id: UUID,
        snapshot: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return await run_execute_section_step(
            self,
            run_id=run_id,
            step=step,
            user_id=user_id,
            snapshot=snapshot,
        )

    async def _execute_client_interaction_step(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        snapshot: dict[str, Any],
        step: dict[str, Any],
        audit_payload: dict[str, Any],
    ) -> dict[str, Any]:
        from api.services.marketing_cabinet import amka_phase_execute_misc

        return await amka_phase_execute_misc.execute_client_interaction_step(
            self,
            project_id=project_id,
            user_id=user_id,
            snapshot=snapshot,
            step=step,
            audit_payload=audit_payload,
        )

    async def _run_marketing_tool_agent_for_section(
        self,
        *,
        run_id: UUID,
        step: dict[str, Any],
        user_id: UUID,
        run: dict[str, Any],
        plan_payload: dict[str, Any],
        audit_payload: dict[str, Any],
        section_key: str,
    ) -> dict[str, Any]:
        from api.services.marketing_cabinet import amka_phase_execute_misc

        return await amka_phase_execute_misc.run_marketing_tool_agent_for_section(
            self,
            run_id=run_id,
            step=step,
            user_id=user_id,
            run=run,
            plan_payload=plan_payload,
            audit_payload=audit_payload,
            section_key=section_key,
        )

    async def _run_desktop_ensemble_for_section(
        self,
        *,
        run_id: UUID,
        step: dict[str, Any],
        user_id: UUID,
        run: dict[str, Any],
        plan_payload: dict[str, Any],
        audit_payload: dict[str, Any],
        section_key: str,
        snapshot: dict[str, Any],
    ) -> dict[str, Any]:
        from api.services.marketing_cabinet import amka_phase_execute_misc

        return await amka_phase_execute_misc.run_desktop_ensemble_for_section(
            self,
            run_id=run_id,
            step=step,
            user_id=user_id,
            run=run,
            plan_payload=plan_payload,
            audit_payload=audit_payload,
            section_key=section_key,
            snapshot=snapshot,
        )

    async def _execute_final_assessment(self, *, run_id: UUID, user_id: UUID) -> dict[str, Any]:
        return await run_final_assessment(self, run_id=run_id, user_id=user_id)

    async def _llm_json(self, *, prompt: str, max_tokens: int = 2200) -> dict[str, Any]:
        return await amka_llm_json(prompt=prompt, max_tokens=max_tokens)

    async def _llm_text(
        self,
        *,
        prompt: str,
        max_tokens: int = 3200,
        temperature: float = 0.2,
    ) -> str:
        return await amka_llm_text(prompt=prompt, max_tokens=max_tokens, temperature=temperature)

    def _render_audit_markdown(self, payload: dict[str, Any]) -> str:
        return amka_render_audit_markdown(payload)

    def _render_master_plan_markdown(
        self,
        tasks: list[dict[str, Any]],
        *,
        summary_text: str | None = None,
    ) -> str:
        return amka_render_master_plan_markdown(tasks, summary_text=summary_text)

    def _render_report_only_execution(self, *, section_key: str, title: str, rationale: str) -> str:
        return amka_render_report_only_execution(section_key=section_key, title=title, rationale=rationale)

    def _render_autofill_report(
        self,
        *,
        section_key: str,
        target_section: str,
        result_payload: dict[str, Any],
        applied_entities: list[dict[str, Any]],
    ) -> str:
        return amka_render_autofill_report(
            section_key=section_key,
            target_section=target_section,
            result_payload=result_payload,
            applied_entities=applied_entities,
        )

    def _render_fallback_final_markdown(
        self,
        *,
        metrics_before: dict[str, Any],
        metrics_after: dict[str, Any],
        completed_steps: list[dict[str, Any]],
    ) -> str:
        return amka_render_fallback_final_markdown(
            metrics_before=metrics_before,
            metrics_after=metrics_after,
            completed_steps=completed_steps,
        )

    async def _get_run_checked(
        self,
        *,
        run_id: UUID,
        user_id: UUID,
        for_mutation: bool,
    ) -> dict[str, Any]:
        return await amka_get_run_checked(self, run_id=run_id, user_id=user_id, for_mutation=for_mutation)

    async def _list_steps(self, run_id: UUID) -> list[dict[str, Any]]:
        return await amka_list_steps(self, run_id)

    async def _replace_steps(self, run_id: UUID, steps: list[dict[str, Any]]) -> None:
        await amka_replace_steps(self, run_id, steps)

    async def _insert_step(
        self,
        *,
        run_id: UUID,
        ordinal: int,
        stage_kind: str,
        section_key: str | None,
        title: str,
        status: str,
        plan_payload: dict[str, Any],
        report_markdown: str | None,
        report_payload: dict[str, Any],
        applied_entities: list[dict[str, Any]],
        metrics_before: dict[str, Any],
        metrics_after: dict[str, Any],
        error_payload: dict[str, Any],
    ) -> None:
        await amka_insert_step(
            self,
            run_id=run_id,
            ordinal=ordinal,
            stage_kind=stage_kind,
            section_key=section_key,
            title=title,
            status=status,
            plan_payload=plan_payload,
            report_markdown=report_markdown,
            report_payload=report_payload,
            applied_entities=applied_entities,
            metrics_before=metrics_before,
            metrics_after=metrics_after,
            error_payload=error_payload,
        )

    async def _update_step(
        self,
        step_id: UUID,
        *,
        status: str | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
        report_markdown: str | None = None,
        report_payload: dict[str, Any] | None = None,
        applied_entities: list[dict[str, Any]] | None = None,
        metrics_before: dict[str, Any] | None = None,
        metrics_after: dict[str, Any] | None = None,
        error_payload: dict[str, Any] | None = None,
    ) -> None:
        await amka_update_step(
            self,
            step_id,
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            report_markdown=report_markdown,
            report_payload=report_payload,
            applied_entities=applied_entities,
            metrics_before=metrics_before,
            metrics_after=metrics_after,
            error_payload=error_payload,
        )

    async def _update_run(
        self,
        run_id: UUID,
        *,
        status_value: str | None = None,
        current_stage: str | None = None,
        progress: int | None = None,
        progress_message: str | None = None,
        master_plan: list[dict[str, Any]] | None = None,
        master_plan_summary: str | None = None,
        final_summary_markdown: str | None = None,
        final_assessment: dict[str, Any] | None = None,
        metrics_before: dict[str, Any] | None = None,
        metrics_after: dict[str, Any] | None = None,
        error_payload: dict[str, Any] | None = None,
        context_payload: dict[str, Any] | None = None,
        approved_at: datetime | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
        clear_completed_at: bool = False,
    ) -> dict[str, Any]:
        return await amka_update_run(
            self,
            run_id,
            status_value=status_value,
            current_stage=current_stage,
            progress=progress,
            progress_message=progress_message,
            master_plan=master_plan,
            master_plan_summary=master_plan_summary,
            final_summary_markdown=final_summary_markdown,
            final_assessment=final_assessment,
            metrics_before=metrics_before,
            metrics_after=metrics_after,
            error_payload=error_payload,
            context_payload=context_payload,
            approved_at=approved_at,
            started_at=started_at,
            completed_at=completed_at,
            clear_completed_at=clear_completed_at,
        )

    async def _fetch_run_value(self, run_id: UUID, column_name: str) -> Any:  # noqa: ANN401
        return await amka_fetch_run_value(self, run_id, column_name)

    async def _reset_failed_or_running_steps(self, run_id: UUID) -> None:
        await amka_reset_failed_or_running_steps(self, run_id)
