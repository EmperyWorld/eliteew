# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Default input type specs and inference helpers for DAG type safety validation.
# Related:
# - api/ewa_platform/companion/workflows/dag/validation.py
# ---

from __future__ import annotations

from api.ewa_platform.companion.workflows.dag.dag_io_profiles import (
    default_input_types_for_profile,
)
from api.ewa_platform.companion.workflows.dag.dag_tool_bindings import get_tool_binding
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowNodeTypeV2,
    CompanionWorkflowNodeV2,
    CompanionWorkflowOutputTypeV2,
)

_DEFAULT_INPUT_TYPES: dict[CompanionWorkflowNodeTypeV2, dict[str, CompanionWorkflowOutputTypeV2]] = {
    "prompt_gen": {"prompt": "text", "text": "text"},
    "api_call": {"url": "string", "body": "json"},
    "image_gen": {"prompt": "text"},
    "document_import": {"paperless_id": "number"},
    "pdf_generate": {
        "topic": "text",
        "title": "text",
        "num_slides": "number",
        "extra_context": "text",
        "prompt": "text",
        "text": "text",
    },
    "telegram_sender": {
        "message_text": "text",
        "text": "text",
        "reply": "text",
        "chat_id": "string",
    },
    "email_dispatcher": {
        "to": "string",
        "subject": "text",
        "body": "text",
        "text": "text",
        "reply": "text",
        "html": "text",
    },
    "vision_analyzer": {
        "image_url": "image_url",
        "attachment_id": "string",
        "prompt": "text",
        "question": "text",
        "data_base64": "text",
        "mime_type": "string",
    },
    "llm_summarizer": {
        "text": "text",
        "body": "text",
        "reply": "text",
        "prompt": "text",
        "instruction": "text",
    },
    "llm_classifier": {
        "text": "text",
        "body": "text",
        "reply": "text",
        "categories": "text",
        "labels": "text",
        "rules": "text",
        "contains": "string",
    },
    "pdf_parser": {
        "unified_content_id": "string",
        "document_id": "string",
        "paperless_id": "number",
        "filename": "string",
        "mime_type": "string",
        "file_base64": "text",
    },
    "document_extractor": {
        "unified_content_id": "string",
        "document_id": "string",
        "paperless_id": "number",
        "filename": "string",
        "mime_type": "string",
        "file_base64": "text",
    },
    "logic_filter": {"text": "text", "input": "text", "contains": "string"},
    "decision": {"text": "text", "body": "text", "reply": "text"},
    "switch": {"text": "text", "body": "text", "reply": "text", "category": "string"},
    "print_log": {"message": "text", "text": "text", "reply": "text", "body": "text"},
    "for_each": {"items": "json", "list": "json", "text": "text"},
    "data_transformer": {
        "value": "json",
        "text": "text",
        "input": "text",
        "body": "text",
        "reply": "text",
        "find": "string",
        "replace": "string",
        "needle": "string",
        "contains": "string",
        "field": "string",
        "start": "number",
        "end": "number",
    },
    "confirm_gate": {},
    "delay": {"delay_sec": "number"},
}


def expected_input_type(node: CompanionWorkflowNodeV2, input_key: str) -> CompanionWorkflowOutputTypeV2 | None:
    spec = node.input_specs.get(input_key)
    if spec is not None:
        return spec.type
    binding = get_tool_binding(str(node.type))
    if binding is not None:
        profile_defaults = default_input_types_for_profile(binding.input_profile)
        if input_key in profile_defaults:
            return profile_defaults[input_key]
    defaults = _DEFAULT_INPUT_TYPES.get(node.type, {})
    return defaults.get(input_key)


__all__ = ("expected_input_type",)
