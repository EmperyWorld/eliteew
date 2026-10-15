#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# pyright: reportAttributeAccessIssue=false
# Mixin/composed attrs resolved on facade class at runtime.
# Purpose:
# Legacy workflow execution orchestration and detached background runner.
# Invariants:
# - Child module of WorkflowService decomposition; must not import workflow_service.
# Related:
# - api/services/ugs/workflow_service.py
# ---

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import bindparam, text  # type: ignore[import-not-found]
from sqlalchemy.dialects.postgresql import JSONB  # type: ignore[import-not-found]

logger = logging.getLogger(__name__)


class WorkflowLegacyExecutionRunnerMixin:
    """Mixin for WorkflowService."""

    async def execute_workflow(
        self,
        workflow_id: str,
        user_id: str,
        execution_name: str | None = None,
        input_data: dict[str, Any] | None = None,
        trigger_type: str = "manual",
        ugs_service: Any | None = None,
    ) -> dict[str, Any]:
        """
        Execute a workflow

        Args:
            workflow_id: ID of the workflow to execute
            user_id: ID of the user triggering execution
            execution_name: Optional name for this execution
            input_data: Optional input data for the workflow
            trigger_type: Type of trigger (manual, api, schedule, etc.)

        Returns:
            (dict[str, Any]) with execution details
        """
        catalog_slug = self._parse_catalog_workflow_id(workflow_id)
        if catalog_slug is not None:
            return await self._execute_catalog_workflow(
                workflow_slug=catalog_slug,
                user_id=user_id,
                execution_name=execution_name,
                input_data=input_data,
                trigger_type=trigger_type,
                ugs_service=ugs_service,
            )

        try:
            # Check if workflow exists and user has access
            workflow = await self.get_workflow(workflow_id, user_id)
            if not workflow:
                msg = "Воркфлоу не найден или недоступен."
                raise ValueError(msg)  # noqa: TRY301

            workflow_data = workflow.get("workflow_data")
            if not isinstance(workflow_data, dict):
                msg = "Воркфлоу не содержит корректной схемы для запуска."
                raise ValueError(msg)

            self._build_legacy_execution_plan(workflow_data)

            # Start execution using database function
            query = text("""
                SELECT start_workflow_execution(
                    :workflow_id,
                    :user_id,
                    :execution_name,
                    :trigger_type,
                    :input_data
                ) as execution_id
            """).bindparams(bindparam("input_data", type_=JSONB))

            result = await self.db.execute(
                query,
                {
                    "workflow_id": workflow_id,
                    "user_id": user_id,
                    "execution_name": execution_name,
                    "trigger_type": trigger_type,
                    "input_data": input_data or {},
                },
            )

            row = result.fetchone()
            if not row:
                msg = "Не удалось запустить выполнение воркфлоу."
                raise ValueError(msg)  # noqa: TRY301
            execution_id = str(row[0])

            await self.db.execute(
                text("""
                    UPDATE workflows
                    SET last_executed_at = NOW(), updated_at = NOW()
                    WHERE id = :workflow_id
                """),
                {"workflow_id": workflow_id},
            )
            await self.db.commit()

            asyncio.create_task(
                self._run_detached_legacy_workflow_execution(
                    execution_id=execution_id,
                    workflow_id=workflow_id,
                    user_id=user_id,
                    workflow_data=workflow_data,
                    input_data=input_data or {},
                    execution_name=execution_name,
                    trigger_type=trigger_type,
                )
            )

            logger.info(
                "Started workflow execution %s for workflow %s by user %s",
                execution_id,
                workflow_id,
                user_id,
            )
        except Exception:
            logger.exception("Failed to execute workflow %s", workflow_id)
            raise
        else:
            return {
                "execution_id": execution_id,
                "status": "started",
                "message": "Выполнение воркфлоу успешно запущено.",
            }

    async def _update_workflow_execution(
        self,
        execution_id: str,
        *,
        status: str,
        completed_at: datetime | None = None,
        total_duration_ms: int | None = None,
        success_count: int | None = None,
        error_count: int | None = None,
        output_data: dict[str, Any] | None = None,
        error_message: str | None = None,
        execution_metadata: dict[str, Any] | None = None,
    ) -> None:
        update_fields = ["status = :status", "updated_at = NOW()"]
        params: dict[str, Any] = {
            "execution_id": execution_id,
            "status": status,
        }

        if completed_at is not None:
            update_fields.append("completed_at = :completed_at")
            params["completed_at"] = completed_at
        if total_duration_ms is not None:
            update_fields.append("total_duration_ms = :total_duration_ms")
            params["total_duration_ms"] = total_duration_ms
        if success_count is not None:
            update_fields.append("success_count = :success_count")
            params["success_count"] = success_count
        if error_count is not None:
            update_fields.append("error_count = :error_count")
            params["error_count"] = error_count
        if output_data is not None:
            update_fields.append("output_data = :output_data")
            params["output_data"] = output_data
        if error_message is not None:
            update_fields.append("error_message = :error_message")
            params["error_message"] = error_message
        if execution_metadata is not None:
            update_fields.append("execution_metadata = :execution_metadata")
            params["execution_metadata"] = execution_metadata

        query = text(f"""
            UPDATE workflow_executions
            SET {", ".join(update_fields)}
            WHERE id = :execution_id
        """)  # noqa: S608

        if "output_data" in params:
            query = query.bindparams(bindparam("output_data", type_=JSONB))
        if "execution_metadata" in params:
            query = query.bindparams(bindparam("execution_metadata", type_=JSONB))

        await self.db.execute(query, params)
        await self.db.commit()

    async def _run_detached_legacy_workflow_execution(
        self,
        *,
        execution_id: str,
        workflow_id: str,
        user_id: str,
        workflow_data: dict[str, Any],
        input_data: dict[str, Any],
        execution_name: str | None,
        trigger_type: str,
    ) -> None:
        from api.core.database_manager import get_database_manager  # noqa: PLC0415
        from api.services.ugs.result_handling import sanitize_generation_result  # noqa: PLC0415
        from api.services.ugs.workflow_service import WorkflowService  # noqa: PLC0415

        manager = await get_database_manager()
        started_at = datetime.now(UTC)
        node_results: dict[str, Any] = {}
        final_preview: Any = None

        async with manager.get_postgres_session() as detached_db:
            service = WorkflowService(detached_db)
            ugs_service = None
            try:
                plan = service._build_legacy_execution_plan(workflow_data)
                await service._update_workflow_execution(
                    execution_id,
                    status="running",
                    execution_metadata={
                        "runner": "legacy_builder_runtime",
                        "workflow_id": workflow_id,
                        "trigger_type": trigger_type,
                        "execution_name": execution_name,
                        "total_nodes": len(plan["ordered_node_ids"]),
                        "completed_nodes": 0,
                    },
                )
                ugs_service = await service._create_detached_ugs_service(detached_db)

                node_outputs: dict[str, Any] = {}
                completed_nodes = 0
                for node_id in plan["ordered_node_ids"]:
                    node = plan["nodes_by_id"][node_id]
                    node_type = str(node.get("type") or "").strip()

                    if node_type == "input":
                        input_output = service._build_input_node_output(
                            node=node,
                            execution_input_data=input_data,
                        )
                        node_outputs[node_id] = input_output
                        node_results[node_id] = {
                            "node_type": "input",
                            "status": "completed",
                            "result_preview": sanitize_generation_result(input_output),
                        }
                    elif node_type == "condition":
                        condition_output = service._evaluate_condition_node(
                            node=node,
                            edges=plan["edges"],
                            nodes_by_id=plan["nodes_by_id"],
                            node_outputs=node_outputs,
                        )
                        node_outputs[node_id] = condition_output
                        node_results[node_id] = {
                            "node_type": "condition",
                            "status": "completed",
                            "result_preview": sanitize_generation_result(condition_output),
                        }
                    elif node_type == "transform":
                        transform_output = service._apply_transform_node(
                            node=node,
                            edges=plan["edges"],
                            nodes_by_id=plan["nodes_by_id"],
                            node_outputs=node_outputs,
                        )
                        node_outputs[node_id] = transform_output
                        node_results[node_id] = {
                            "node_type": "transform",
                            "status": "completed",
                            "result_preview": sanitize_generation_result(transform_output),
                        }
                    elif node_type == "section":
                        section_payload = {
                            "__result__": None,
                            "__skipped__": "section",
                        }
                        node_outputs[node_id] = section_payload
                        node_results[node_id] = {
                            "node_type": "section",
                            "status": "completed",
                            "result_preview": {"section": True},
                        }
                    elif node_type == "constant":
                        constant_output = service._build_constant_node_output(node=node)
                        node_outputs[node_id] = constant_output
                        node_results[node_id] = {
                            "node_type": "constant",
                            "status": "completed",
                            "result_preview": sanitize_generation_result(constant_output),
                        }
                    elif node_type == "merge":
                        merge_output = service._apply_merge_node(
                            node=node,
                            edges=plan["edges"],
                            nodes_by_id=plan["nodes_by_id"],
                            node_outputs=node_outputs,
                        )
                        node_outputs[node_id] = merge_output
                        node_results[node_id] = {
                            "node_type": "merge",
                            "status": "completed",
                            "result_preview": sanitize_generation_result(merge_output),
                        }
                    elif node_type == "delay":
                        delay_output = await service._apply_delay_node(
                            node=node,
                            edges=plan["edges"],
                            nodes_by_id=plan["nodes_by_id"],
                            node_outputs=node_outputs,
                        )
                        node_outputs[node_id] = delay_output
                        node_results[node_id] = {
                            "node_type": "delay",
                            "status": "completed",
                            "result_preview": sanitize_generation_result(delay_output),
                        }
                    elif node_type == "split":
                        split_output = service._apply_split_node(
                            node=node,
                            edges=plan["edges"],
                            nodes_by_id=plan["nodes_by_id"],
                            node_outputs=node_outputs,
                        )
                        node_outputs[node_id] = split_output
                        node_results[node_id] = {
                            "node_type": "split",
                            "status": "completed",
                            "result_preview": sanitize_generation_result(split_output),
                        }
                    elif node_type == "pick":
                        pick_output = service._apply_pick_node(
                            node=node,
                            edges=plan["edges"],
                            nodes_by_id=plan["nodes_by_id"],
                            node_outputs=node_outputs,
                        )
                        node_outputs[node_id] = pick_output
                        node_results[node_id] = {
                            "node_type": "pick",
                            "status": "completed",
                            "result_preview": sanitize_generation_result(pick_output),
                        }
                    elif node_type == "wrap":
                        wrap_output = service._apply_wrap_node(
                            node=node,
                            edges=plan["edges"],
                            nodes_by_id=plan["nodes_by_id"],
                            node_outputs=node_outputs,
                        )
                        node_outputs[node_id] = wrap_output
                        node_results[node_id] = {
                            "node_type": "wrap",
                            "status": "completed",
                            "result_preview": sanitize_generation_result(wrap_output),
                        }
                    elif node_type == "json_encode":
                        je = service._apply_json_encode_node(
                            node=node,
                            edges=plan["edges"],
                            nodes_by_id=plan["nodes_by_id"],
                            node_outputs=node_outputs,
                        )
                        node_outputs[node_id] = je
                        node_results[node_id] = {
                            "node_type": "json_encode",
                            "status": "completed",
                            "result_preview": sanitize_generation_result(je),
                        }
                    elif node_type == "json_decode":
                        jd = service._apply_json_decode_node(
                            node=node,
                            edges=plan["edges"],
                            nodes_by_id=plan["nodes_by_id"],
                            node_outputs=node_outputs,
                        )
                        node_outputs[node_id] = jd
                        node_results[node_id] = {
                            "node_type": "json_decode",
                            "status": "completed",
                            "result_preview": sanitize_generation_result(jd),
                        }
                    elif node_type == "text_case":
                        tc = service._apply_text_case_node(
                            node=node,
                            edges=plan["edges"],
                            nodes_by_id=plan["nodes_by_id"],
                            node_outputs=node_outputs,
                        )
                        node_outputs[node_id] = tc
                        node_results[node_id] = {
                            "node_type": "text_case",
                            "status": "completed",
                            "result_preview": sanitize_generation_result(tc),
                        }
                    elif node_type == "text_join":
                        tj = service._apply_text_join_node(
                            node=node,
                            edges=plan["edges"],
                            nodes_by_id=plan["nodes_by_id"],
                            node_outputs=node_outputs,
                        )
                        node_outputs[node_id] = tj
                        node_results[node_id] = {
                            "node_type": "text_join",
                            "status": "completed",
                            "result_preview": sanitize_generation_result(tj),
                        }
                    elif node_type == "output":
                        output_context = service._build_output_node_result(
                            node_id=node_id,
                            edges=plan["edges"],
                            nodes_by_id=plan["nodes_by_id"],
                            node_outputs=node_outputs,
                        )
                        node_outputs[node_id] = output_context
                        if output_context is not None:
                            final_preview = sanitize_generation_result(output_context)
                        node_results[node_id] = {
                            "node_type": "output",
                            "status": "completed",
                            "result_preview": sanitize_generation_result(output_context),
                        }
                    else:
                        node_info = plan["generation_nodes"][node_id]
                        runtime_type = str(node_info["runtime_type"])
                        legacy_type = str(node_info["legacy_type"])
                        should_execute = service._should_execute_generation_node(
                            node_id=node_id,
                            edges=plan["edges"],
                            nodes_by_id=plan["nodes_by_id"],
                            node_outputs=node_outputs,
                        )
                        if not should_execute:
                            node_outputs[node_id] = {"__skipped__": True}
                            node_results[node_id] = {
                                "legacy_type": legacy_type,
                                "runtime_type": runtime_type,
                                "status": "skipped",
                                "result_preview": {"skipped": True},
                            }
                            completed_nodes += 1
                            await service._update_workflow_execution(
                                execution_id,
                                status="running",
                                success_count=completed_nodes,
                                error_count=0,
                                execution_metadata={
                                    "runner": "legacy_builder_runtime",
                                    "workflow_id": workflow_id,
                                    "trigger_type": trigger_type,
                                    "execution_name": execution_name,
                                    "total_nodes": len(plan["ordered_node_ids"]),
                                    "completed_nodes": completed_nodes,
                                    "current_node_id": node_id,
                                    "current_runtime_type": runtime_type,
                                    "current_node_status": "skipped",
                                },
                            )
                            continue

                        payload = service._build_generation_node_payload(
                            node=node,
                            runtime_type=runtime_type,
                            edges=plan["edges"],
                            nodes_by_id=plan["nodes_by_id"],
                            node_outputs=node_outputs,
                            execution_input_data=input_data,
                        )
                        node_execution = await service._execute_legacy_generation_node(
                            ugs_service=ugs_service,
                            user_id=user_id,
                            runtime_type=runtime_type,
                            payload=payload,
                        )
                        raw_result = node_execution.get("result")
                        preview_result = node_execution.get("result_preview")
                        sanitized_preview = (
                            preview_result if preview_result is not None else sanitize_generation_result(raw_result)
                        )
                        final_preview = sanitized_preview
                        node_outputs[node_id] = service._build_generation_output_bindings(node, raw_result)
                        node_results[node_id] = {
                            "legacy_type": legacy_type,
                            "runtime_type": runtime_type,
                            "request_id": node_execution.get("request_id"),
                            "status": node_execution.get("status"),
                            "input_preview": sanitize_generation_result(payload),
                            "result_preview": sanitized_preview,
                        }

                    completed_nodes += 1
                    await service._update_workflow_execution(
                        execution_id,
                        status="running",
                        success_count=completed_nodes,
                        error_count=0,
                        execution_metadata={
                            "runner": "legacy_builder_runtime",
                            "workflow_id": workflow_id,
                            "trigger_type": trigger_type,
                            "execution_name": execution_name,
                            "total_nodes": len(plan["ordered_node_ids"]),
                            "completed_nodes": completed_nodes,
                            "current_node_id": node_id,
                            "current_runtime_type": node_results[node_id].get("runtime_type"),
                            "current_node_type": node_type,
                        },
                    )

                finished_at = datetime.now(UTC)
                total_duration_ms = int((finished_at - started_at).total_seconds() * 1000)
                await service._update_workflow_execution(
                    execution_id,
                    status="completed",
                    completed_at=finished_at,
                    total_duration_ms=total_duration_ms,
                    success_count=len(node_results),
                    error_count=0,
                    output_data={
                        "final_output": sanitize_generation_result(final_preview),
                        "node_results": node_results,
                    },
                    execution_metadata={
                        "runner": "legacy_builder_runtime",
                        "workflow_id": workflow_id,
                        "trigger_type": trigger_type,
                        "execution_name": execution_name,
                        "total_nodes": len(plan["ordered_node_ids"]),
                        "completed_nodes": len(node_results),
                    },
                )
                logger.info(
                    "Legacy workflow execution %s completed for workflow %s",
                    execution_id,
                    workflow_id,
                )
            except Exception as error:
                finished_at = datetime.now(UTC)
                total_duration_ms = int((finished_at - started_at).total_seconds() * 1000)
                logger.exception(
                    "Legacy workflow execution %s failed for workflow %s",
                    execution_id,
                    workflow_id,
                )
                await service._update_workflow_execution(
                    execution_id,
                    status="failed",
                    completed_at=finished_at,
                    total_duration_ms=total_duration_ms,
                    success_count=len(node_results),
                    error_count=1,
                    error_message=str(error)[:4000],
                    output_data={
                        "final_output": sanitize_generation_result(final_preview),
                        "node_results": node_results,
                    },
                    execution_metadata={
                        "runner": "legacy_builder_runtime",
                        "workflow_id": workflow_id,
                        "trigger_type": trigger_type,
                        "execution_name": execution_name,
                        "total_nodes": len(plan["ordered_node_ids"]) if "plan" in locals() else len(node_results),
                        "completed_nodes": len(node_results),
                        "error": str(error)[:1000],
                    },
                )
            finally:
                if ugs_service is not None:
                    await ugs_service.close()
