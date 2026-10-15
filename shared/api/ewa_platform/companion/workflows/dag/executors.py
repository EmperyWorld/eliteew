# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Node executors for synchronous DAG runs and Celery ``dag_node`` steps.
# Invariants:
# - Tool-backed node types delegate to ``execute_tool_backed_node`` → ``tool_registry_adapter``.
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_tool_bindings.py
# - api/ewa_platform/companion/workflows/dag/runner.py
# ---

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.workflows.dag.errors import NodeExecutionError
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowNodeV2

NodeExecutorFn = Callable[
    [CompanionWorkflowNodeV2, Mapping[str, Any], ToolContext],
    Awaitable["NodeExecutionResult"],
]


@dataclass(frozen=True, slots=True)
class NodeExecutionResult:
    status: Literal["ok", "failed", "skipped_due_to_error", "accepted", "needs_confirm"] = "ok"
    outputs: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    skipped_due_to_error: bool = False
    attempts: int = 1


class NodeExecutor(Protocol):
    async def __call__(
        self,
        node: CompanionWorkflowNodeV2,
        resolved_inputs: Mapping[str, Any],
        ctx: ToolContext,
    ) -> NodeExecutionResult: ...


async def execute_echo_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    _ = ctx
    if str(resolved_inputs.get("_fail") or "").strip().lower() in {"1", "true", "yes"}:
        raise NodeExecutionError(node_id=str(node.id), message="forced failure")
    text = str(resolved_inputs.get("text") or resolved_inputs.get("prompt") or "")
    return NodeExecutionResult(status="ok", outputs={"reply": text, "text": text})


async def execute_constant_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    _ = node, ctx
    value = resolved_inputs.get("value", "")
    return NodeExecutionResult(status="ok", outputs={"value": value})


async def execute_logic_filter_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    _ = ctx
    source = str(resolved_inputs.get("text") or resolved_inputs.get("input") or "")
    needle = str(resolved_inputs.get("contains") or "")
    matched = needle == "" or needle in source
    return NodeExecutionResult(status="ok", outputs={"matched": matched, "text": source})


async def execute_prompt_gen_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    _ = ctx
    prompt = str(resolved_inputs.get("prompt") or resolved_inputs.get("text") or "")
    return NodeExecutionResult(
        status="ok",
        outputs={
            "prompt": prompt,
            "reply": f"[prompt_gen stub] {prompt}",
            "temperature": node.config.temperature,
            "max_tokens": node.config.max_tokens,
        },
    )


def _stub_tool_backed_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
) -> NodeExecutionResult:
    from api.ewa_platform.companion.workflows.dag.dag_tool_bindings import get_tool_binding

    binding = get_tool_binding(str(node.type))
    tool_hint = str(node.config.tool_name or (binding.default_tool if binding else "") or "").strip()
    if str(node.type) == "image_gen":
        prompt = str(resolved_inputs.get("prompt") or "")
        return NodeExecutionResult(
            status="ok",
            outputs={
                "prompt": prompt,
                "image_url": f"stub://image/{node.id}",
                "reply": f"[image_gen stub] {prompt}",
            },
        )
    if str(node.type) == "document_import":
        paperless_id = resolved_inputs.get("paperless_id")
        return NodeExecutionResult(
            status="ok",
            outputs={
                "reply": f"[document_import stub] paperless_id={paperless_id}",
                "text": f"Imported document #{paperless_id}",
                "unified_content_id": f"stub-uc-{node.id}",
                "document_id": f"stub-doc-{node.id}",
                "paperless_id": paperless_id,
            },
        )
    if str(node.type) == "pdf_generate":
        topic = str(resolved_inputs.get("topic") or resolved_inputs.get("prompt") or resolved_inputs.get("text") or "")
        return NodeExecutionResult(
            status="accepted",
            outputs={
                "reply": f"[pdf_generate stub] topic={topic}",
                "run_id": f"stub-run-{node.id}",
                "task_run_id": f"stub-run-{node.id}",
                "task_run_status": "running",
                "url": f"stub://pdf/{node.id}",
                "pdf_url": f"stub://pdf/{node.id}",
            },
        )
    if str(node.type) == "telegram_sender":
        message = str(
            resolved_inputs.get("message_text") or resolved_inputs.get("text") or resolved_inputs.get("reply") or ""
        )
        chat_id = str(resolved_inputs.get("chat_id") or "stub-chat")
        return NodeExecutionResult(
            status="ok",
            outputs={
                "reply": f"[telegram_sender stub] {message[:80]}",
                "delivery_status": "sent",
                "chat_id": chat_id,
                "message_id": 1,
            },
        )
    if str(node.type) == "email_dispatcher":
        to = str(resolved_inputs.get("to") or "stub@example.com")
        subject = str(resolved_inputs.get("subject") or "stub")
        return NodeExecutionResult(
            status="ok",
            outputs={
                "reply": f"[email_dispatcher stub] to={to}",
                "delivery_status": "sent",
                "to": to,
                "subject": subject,
            },
        )
    if str(node.type) == "vision_analyzer":
        prompt = str(resolved_inputs.get("prompt") or resolved_inputs.get("question") or "")
        image_url = str(resolved_inputs.get("image_url") or "stub://image")
        analysis = f"[vision_analyzer stub] {prompt or image_url}"
        return NodeExecutionResult(
            status="ok",
            outputs={
                "reply": analysis,
                "analysis_text": analysis,
                "text": analysis,
            },
        )
    if str(node.type) == "llm_summarizer":
        source = str(resolved_inputs.get("text") or resolved_inputs.get("body") or resolved_inputs.get("reply") or "")
        summary = f"[llm_summarizer stub] {source[:120]}"
        return NodeExecutionResult(
            status="ok",
            outputs={
                "reply": summary,
                "summary_text": summary,
                "analysis_text": summary,
                "text": summary,
            },
        )
    if str(node.type) == "llm_classifier":
        source = str(resolved_inputs.get("text") or resolved_inputs.get("body") or resolved_inputs.get("reply") or "")
        category = str(resolved_inputs.get("categories") or "neutral").split(",")[0].strip() or "neutral"
        analysis = f"[llm_classifier stub] category={category}; text={source[:80]}"
        return NodeExecutionResult(
            status="ok",
            outputs={
                "reply": analysis,
                "category": category,
                "matched": True,
                "analysis_text": analysis,
                "text": analysis,
            },
        )
    if str(node.type) == "pdf_parser":
        unified_content_id = str(
            resolved_inputs.get("unified_content_id") or resolved_inputs.get("document_id") or ""
        ).strip()
        paperless_id = resolved_inputs.get("paperless_id")
        source_hint = unified_content_id or paperless_id or "unknown"
        extracted = f"[pdf_parser stub] source={source_hint}; extracted PDF text for downstream summarization."
        return NodeExecutionResult(
            status="ok",
            outputs={
                "reply": extracted,
                "text": extracted,
                "extracted_text": extracted,
                "filename": "stub.pdf",
                "mime_type": "application/pdf",
                "char_count": len(extracted),
            },
        )
    if str(node.type) == "document_extractor":
        unified_content_id = str(
            resolved_inputs.get("unified_content_id") or resolved_inputs.get("document_id") or ""
        ).strip()
        paperless_id = resolved_inputs.get("paperless_id")
        source_hint = unified_content_id or paperless_id or "unknown"
        extracted = f"[document_extractor stub] source={source_hint}; extracted document text."
        return NodeExecutionResult(
            status="ok",
            outputs={
                "reply": extracted,
                "text": extracted,
                "extracted_text": extracted,
                "filename": "stub.docx",
                "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "char_count": len(extracted),
            },
        )
    url = str(resolved_inputs.get("url") or "")
    label = tool_hint or url or "no-tool"
    return NodeExecutionResult(
        status="ok",
        outputs={"url": url, "reply": f"[api_call stub] {label}"},
    )


async def execute_tool_backed_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    from api.ewa_platform.companion.workflows.config import companion_dag_tool_registry_adapter_enabled
    from api.ewa_platform.companion.workflows.dag.dag_outbound_policy import check_outbound_runtime_guard
    from api.ewa_platform.companion.workflows.dag.dag_tool_bindings import get_tool_binding
    from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry
    from api.ewa_platform.companion.workflows.dag.tool_registry_adapter import execute_tool_registry_node
    from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowDefinitionV2

    if get_tool_binding(str(node.type)) is None:
        return NodeExecutionResult(
            status="failed",
            outputs={},
            error=f"no tool binding for node type {node.type!r}",
        )

    registry = resolved_inputs.get("_dag_registry")
    definition = resolved_inputs.get("_dag_definition")
    node_id = str(resolved_inputs.get("_dag_node_id") or node.id)
    guard_error = check_outbound_runtime_guard(
        node=node,
        node_id=node_id,
        definition=definition if isinstance(definition, CompanionWorkflowDefinitionV2) else None,
        registry=registry if isinstance(registry, WorkflowStateRegistry) else None,
    )
    if guard_error:
        return NodeExecutionResult(status="failed", outputs={}, error=guard_error)

    if companion_dag_tool_registry_adapter_enabled():
        return await execute_tool_registry_node(node, resolved_inputs, ctx)

    return _stub_tool_backed_node(node, resolved_inputs)


async def execute_api_call_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    return await execute_tool_backed_node(node, resolved_inputs, ctx)


async def execute_image_gen_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    return await execute_tool_backed_node(node, resolved_inputs, ctx)


async def execute_document_import_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    return await execute_tool_backed_node(node, resolved_inputs, ctx)


async def execute_pdf_generate_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    return await execute_tool_backed_node(node, resolved_inputs, ctx)


async def execute_telegram_sender_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    return await execute_tool_backed_node(node, resolved_inputs, ctx)


async def execute_email_dispatcher_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    return await execute_tool_backed_node(node, resolved_inputs, ctx)


async def execute_vision_analyzer_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    return await execute_tool_backed_node(node, resolved_inputs, ctx)


async def execute_llm_summarizer_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    return await execute_tool_backed_node(node, resolved_inputs, ctx)


async def execute_llm_classifier_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    return await execute_tool_backed_node(node, resolved_inputs, ctx)


async def execute_pdf_parser_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    return await execute_tool_backed_node(node, resolved_inputs, ctx)


async def execute_document_extractor_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    return await execute_tool_backed_node(node, resolved_inputs, ctx)


async def execute_decision_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    from api.ewa_platform.companion.workflows.dag.dag_branching import evaluate_decision
    from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry

    _ = ctx
    registry = resolved_inputs.get("_dag_registry")
    registry_obj = registry if isinstance(registry, WorkflowStateRegistry) else None
    result, branch = evaluate_decision(node, resolved_inputs, registry=registry_obj)
    field = str(node.config.condition_field or "text").strip() or "text"
    source_text = str(resolved_inputs.get(field) or resolved_inputs.get("text") or resolved_inputs.get("reply") or "")
    return NodeExecutionResult(
        status="ok",
        outputs={
            "result": result,
            "branch": branch,
            "reply": f"decision={branch}",
            "text": source_text,
        },
    )


async def execute_switch_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    from api.ewa_platform.companion.workflows.dag.dag_branching import evaluate_switch
    from api.ewa_platform.companion.workflows.dag.state_registry import WorkflowStateRegistry

    _ = ctx
    registry = resolved_inputs.get("_dag_registry")
    registry_obj = registry if isinstance(registry, WorkflowStateRegistry) else None
    matched_branch, branch = evaluate_switch(node, resolved_inputs, registry=registry_obj)
    return NodeExecutionResult(
        status="ok",
        outputs={
            "matched_branch": matched_branch,
            "branch": branch,
            "reply": f"switch={branch}",
        },
    )


async def execute_print_log_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    _ = ctx
    message = str(
        resolved_inputs.get("message")
        or resolved_inputs.get("text")
        or resolved_inputs.get("reply")
        or resolved_inputs.get("body")
        or ""
    )
    return NodeExecutionResult(
        status="ok",
        outputs={
            "reply": message,
            "log_text": message,
            "text": message,
        },
    )


async def execute_data_transformer_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    from api.ewa_platform.companion.workflows.config import companion_wf_data_transformer_enabled
    from api.ewa_platform.companion.workflows.dag.dag_data_transform import DataTransformError, run_data_transform

    _ = ctx
    if not companion_wf_data_transformer_enabled():
        return NodeExecutionResult(
            status="failed",
            outputs={},
            error="data_transformer is disabled (EWA_COMPANION_WF_DATA_TRANSFORMER_ENABLED).",
        )
    op = str(node.config.transform_op or "").strip().lower()
    if not op:
        return NodeExecutionResult(status="failed", outputs={}, error="data_transformer requires config.transform_op")
    try:
        value, reply = run_data_transform(
            op,
            resolved_inputs=resolved_inputs,
            transform_args=node.config.transform_args,
        )
    except DataTransformError as exc:
        return NodeExecutionResult(status="failed", outputs={}, error=str(exc))
    text = reply if isinstance(value, str) else str(reply)
    return NodeExecutionResult(
        status="ok",
        outputs={
            "value": value,
            "text": text,
            "reply": reply,
        },
    )


async def execute_confirm_gate_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    _ = ctx, resolved_inputs
    message = str(node.config.confirm_message_ru or node.config.confirm_message_en or "Confirm to continue")
    return NodeExecutionResult(
        status="needs_confirm",
        outputs={"message": message, "confirmed": False},
    )


async def execute_delay_node(
    node: CompanionWorkflowNodeV2,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
) -> NodeExecutionResult:
    """Delay scheduling is handled in ``dag_node_executor``; executor is a no-op marker."""

    _ = ctx
    delay_sec = int(resolved_inputs.get("delay_sec") or node.config.delay_sec or 0)
    return NodeExecutionResult(status="ok", outputs={"delay_sec": max(0, min(delay_sec, 3600))})


DEFAULT_NODE_EXECUTOR_REGISTRY: dict[str, NodeExecutorFn] = {
    "prompt_gen": execute_prompt_gen_node,
    "api_call": execute_api_call_node,
    "image_gen": execute_image_gen_node,
    "document_import": execute_document_import_node,
    "pdf_generate": execute_pdf_generate_node,
    "telegram_sender": execute_telegram_sender_node,
    "email_dispatcher": execute_email_dispatcher_node,
    "vision_analyzer": execute_vision_analyzer_node,
    "llm_summarizer": execute_llm_summarizer_node,
    "llm_classifier": execute_llm_classifier_node,
    "pdf_parser": execute_pdf_parser_node,
    "document_extractor": execute_document_extractor_node,
    "logic_filter": execute_logic_filter_node,
    "decision": execute_decision_node,
    "switch": execute_switch_node,
    "print_log": execute_print_log_node,
    "data_transformer": execute_data_transformer_node,
    "confirm_gate": execute_confirm_gate_node,
    "delay": execute_delay_node,
    "echo": execute_echo_node,
    "constant": execute_constant_node,
}


__all__ = (
    "DEFAULT_NODE_EXECUTOR_REGISTRY",
    "NodeExecutionResult",
    "NodeExecutor",
    "NodeExecutorFn",
    "execute_api_call_node",
    "execute_confirm_gate_node",
    "execute_constant_node",
    "execute_data_transformer_node",
    "execute_decision_node",
    "execute_document_import_node",
    "execute_delay_node",
    "execute_email_dispatcher_node",
    "execute_echo_node",
    "execute_image_gen_node",
    "execute_llm_classifier_node",
    "execute_llm_summarizer_node",
    "execute_logic_filter_node",
    "execute_pdf_parser_node",
    "execute_document_extractor_node",
    "execute_pdf_generate_node",
    "execute_print_log_node",
    "execute_prompt_gen_node",
    "execute_switch_node",
    "execute_telegram_sender_node",
    "execute_tool_backed_node",
    "execute_vision_analyzer_node",
)
