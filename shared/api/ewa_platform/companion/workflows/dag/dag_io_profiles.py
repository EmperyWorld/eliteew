# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Declarative input/output profiles for DAG tool-backed nodes (Phase 2.6.2).
# Invariants:
# - Profiles only map shapes; tool business logic stays in ``tool_registry``.
# Related:
# - api/ewa_platform/companion/workflows/dag/dag_tool_bindings.py
# - api/ewa_platform/companion/workflows/dag/tool_registry_adapter.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.orchestration.tool_registry import ToolContext
from api.ewa_platform.companion.orchestration.tool_result_utils import tool_result_data
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import (
    CompanionWorkflowNodeV2,
    CompanionWorkflowOutputSpecV2,
    CompanionWorkflowOutputTypeV2,
)

InputProfileName = str
OutputProfileName = str

INPUT_PROFILES: dict[InputProfileName, dict[str, CompanionWorkflowOutputTypeV2]] = {
    "generic": {},
    "prompt_text": {"prompt": "text", "text": "text", "user_line": "text"},
    "paperless_import": {"paperless_id": "number"},
    "document_source": {
        "unified_content_id": "string",
        "document_id": "string",
        "paperless_id": "number",
        "filename": "string",
        "mime_type": "string",
        "file_base64": "text",
    },
    "presentation": {
        "topic": "text",
        "title": "text",
        "num_slides": "number",
        "extra_context": "text",
        "prompt": "text",
        "text": "text",
    },
    "telegram_send": {
        "message_text": "text",
        "text": "text",
        "reply": "text",
        "body": "text",
        "chat_id": "string",
    },
    "email_dispatch": {
        "to": "string",
        "subject": "text",
        "body": "text",
        "text": "text",
        "reply": "text",
        "html": "text",
    },
    "vision_analyze": {
        "image_url": "image_url",
        "attachment_id": "string",
        "prompt": "text",
        "question": "text",
        "data_base64": "text",
        "mime_type": "string",
    },
    "long_text": {
        "text": "text",
        "body": "text",
        "reply": "text",
        "prompt": "text",
        "instruction": "text",
    },
    "classifier": {
        "text": "text",
        "body": "text",
        "reply": "text",
        "categories": "text",
        "labels": "text",
        "rules": "text",
        "contains": "string",
    },
}

OUTPUT_PROFILES: dict[OutputProfileName, dict[str, CompanionWorkflowOutputTypeV2]] = {
    "text_reply": {"reply": "text", "text": "text"},
    "document_catalog": {
        "reply": "text",
        "text": "text",
        "unified_content_id": "string",
        "document_id": "string",
        "paperless_id": "number",
    },
    "async_pdf": {
        "reply": "text",
        "run_id": "string",
        "task_run_id": "string",
        "task_run_status": "string",
        "url": "string",
        "pdf_url": "string",
    },
    "delivery_status": {
        "reply": "text",
        "delivery_status": "string",
        "chat_id": "string",
        "message_id": "number",
        "to": "string",
        "error": "string",
    },
    "vision_analysis": {
        "reply": "text",
        "analysis_text": "text",
        "text": "text",
    },
    "llm_summary": {
        "reply": "text",
        "summary_text": "text",
        "analysis_text": "text",
        "text": "text",
    },
    "llm_classification": {
        "reply": "text",
        "category": "string",
        "matched": "boolean",
        "analysis_text": "text",
        "text": "text",
    },
    "document_extract": {
        "reply": "text",
        "text": "text",
        "extracted_text": "text",
        "filename": "string",
        "mime_type": "string",
        "char_count": "number",
        "page_count": "number",
        "error": "string",
    },
    "transform_value": {
        "reply": "text",
        "text": "text",
        "value": "json",
    },
}

DEFAULT_NODE_OUTPUTS: dict[str, dict[str, CompanionWorkflowOutputSpecV2]] = {
    "document_import": {
        key: CompanionWorkflowOutputSpecV2(type=type_name)
        for key, type_name in OUTPUT_PROFILES["document_catalog"].items()
    },
    "pdf_generate": {
        key: CompanionWorkflowOutputSpecV2(type=type_name) for key, type_name in OUTPUT_PROFILES["async_pdf"].items()
    },
    "telegram_sender": {
        key: CompanionWorkflowOutputSpecV2(type=type_name)
        for key, type_name in OUTPUT_PROFILES["delivery_status"].items()
    },
    "email_dispatcher": {
        key: CompanionWorkflowOutputSpecV2(type=type_name)
        for key, type_name in OUTPUT_PROFILES["delivery_status"].items()
    },
    "vision_analyzer": {
        key: CompanionWorkflowOutputSpecV2(type=type_name)
        for key, type_name in OUTPUT_PROFILES["vision_analysis"].items()
    },
    "llm_summarizer": {
        key: CompanionWorkflowOutputSpecV2(type=type_name) for key, type_name in OUTPUT_PROFILES["llm_summary"].items()
    },
    "llm_classifier": {
        key: CompanionWorkflowOutputSpecV2(type=type_name)
        for key, type_name in OUTPUT_PROFILES["llm_classification"].items()
    },
    "pdf_parser": {
        key: CompanionWorkflowOutputSpecV2(type=type_name)
        for key, type_name in OUTPUT_PROFILES["document_extract"].items()
    },
    "document_extractor": {
        key: CompanionWorkflowOutputSpecV2(type=type_name)
        for key, type_name in OUTPUT_PROFILES["document_extract"].items()
    },
    "data_transformer": {
        key: CompanionWorkflowOutputSpecV2(type=type_name)
        for key, type_name in OUTPUT_PROFILES["transform_value"].items()
    },
}


def default_input_types_for_profile(profile: str) -> dict[str, CompanionWorkflowOutputTypeV2]:
    return dict(INPUT_PROFILES.get(profile, INPUT_PROFILES["generic"]))


def default_output_types_for_profile(profile: str) -> dict[str, CompanionWorkflowOutputTypeV2]:
    return dict(OUTPUT_PROFILES.get(profile, OUTPUT_PROFILES["text_reply"]))


def _first_text(*values: Any) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def _coerce_paperless_id(raw: Any) -> int | None:
    if raw is None:
        return None
    try:
        paperless_id = int(raw)
    except TypeError, ValueError:
        return None
    return paperless_id if paperless_id >= 1 else None


def apply_input_profile(
    profile: str,
    *,
    resolved_inputs: Mapping[str, Any],
    ctx: ToolContext,
    args: dict[str, Any],
) -> dict[str, Any]:
    """Merge profile-specific tool args onto the generic dispatch args dict."""

    merged = dict(args)
    if profile == "paperless_import":
        paperless_id = _coerce_paperless_id(resolved_inputs.get("paperless_id"))
        if paperless_id is not None:
            merged["paperless_id"] = paperless_id
        return merged

    if profile == "presentation":
        topic = _first_text(
            resolved_inputs.get("topic"),
            resolved_inputs.get("prompt"),
            resolved_inputs.get("text"),
            resolved_inputs.get("reply"),
        )
        if topic:
            merged["topic"] = topic
        title = _first_text(resolved_inputs.get("title"), topic)
        if title:
            merged["title"] = title
        extra_context = _first_text(resolved_inputs.get("extra_context"), resolved_inputs.get("body"))
        if extra_context:
            merged["extra_context"] = extra_context
        num_slides = resolved_inputs.get("num_slides")
        if num_slides is not None:
            merged["num_slides"] = num_slides
        return merged

    if profile == "telegram_send":
        message_text = _first_text(
            resolved_inputs.get("message_text"),
            resolved_inputs.get("text"),
            resolved_inputs.get("reply"),
            resolved_inputs.get("body"),
        )
        if message_text:
            merged["message_text"] = message_text
        chat_id = _first_text(resolved_inputs.get("chat_id"))
        if chat_id:
            merged["chat_id"] = chat_id
        return merged

    if profile == "email_dispatch":
        to = _first_text(resolved_inputs.get("to"), resolved_inputs.get("email"))
        if to:
            merged["to"] = to
        subject = _first_text(resolved_inputs.get("subject"))
        if subject:
            merged["subject"] = subject
        body = _first_text(
            resolved_inputs.get("body"),
            resolved_inputs.get("text"),
            resolved_inputs.get("reply"),
        )
        if body:
            merged["body"] = body
        html = _first_text(resolved_inputs.get("html"))
        if html:
            merged["html"] = html
        return merged

    if profile == "vision_analyze":
        image_url = _first_text(resolved_inputs.get("image_url"), resolved_inputs.get("url"))
        if image_url:
            merged["image_url"] = image_url
        attachment_id = _first_text(resolved_inputs.get("attachment_id"))
        if attachment_id:
            merged["attachment_id"] = attachment_id
        prompt = _first_text(
            resolved_inputs.get("prompt"),
            resolved_inputs.get("question"),
            ctx.user_line,
        )
        if prompt:
            merged["prompt"] = prompt
        data_base64 = _first_text(resolved_inputs.get("data_base64"))
        if data_base64:
            merged["data_base64"] = data_base64
        mime_type = _first_text(resolved_inputs.get("mime_type"))
        if mime_type:
            merged["mime_type"] = mime_type
        attachment = resolved_inputs.get("attachment")
        if isinstance(attachment, Mapping):
            merged["attachment"] = dict(attachment)
        return merged

    if profile == "long_text":
        text = _first_text(
            resolved_inputs.get("text"),
            resolved_inputs.get("body"),
            resolved_inputs.get("reply"),
            resolved_inputs.get("prompt"),
        )
        if text:
            merged["text"] = text
        instruction = _first_text(resolved_inputs.get("instruction"))
        if instruction:
            merged["instruction"] = instruction
        return merged

    if profile == "classifier":
        text = _first_text(
            resolved_inputs.get("text"),
            resolved_inputs.get("body"),
            resolved_inputs.get("reply"),
        )
        if text:
            merged["text"] = text
        categories = _first_text(resolved_inputs.get("categories"), resolved_inputs.get("labels"))
        if categories:
            merged["categories"] = categories
        rules = _first_text(resolved_inputs.get("rules"), resolved_inputs.get("contains"))
        if rules:
            merged["rules"] = rules
        return merged

    if profile == "prompt_text":
        prompt = _first_text(resolved_inputs.get("prompt"), resolved_inputs.get("text"), ctx.user_line)
        if prompt:
            merged.setdefault("prompt", prompt)
            merged.setdefault("user_line", prompt)
        return merged

    if profile == "document_source":
        for key in (
            "unified_content_id",
            "document_id",
            "paperless_id",
            "filename",
            "mime_type",
            "file_base64",
        ):
            if key in resolved_inputs and resolved_inputs[key] is not None:
                merged[key] = resolved_inputs[key]
        return merged

    return merged


def apply_output_profile(
    profile: str,
    *,
    tool_result: Mapping[str, Any],
    outputs: dict[str, Any],
    node: CompanionWorkflowNodeV2,
) -> dict[str, Any]:
    """Augment projected node outputs using the binding output profile."""

    _ = node
    data = tool_result_data(tool_result)
    enriched = dict(outputs)

    if profile == "document_catalog":
        for key in ("unified_content_id", "document_id", "paperless_id"):
            if key in data and data[key] is not None:
                enriched[key] = data[key]
        return enriched

    if profile == "async_pdf":
        pdf_url = data.get("pdf_url") or data.get("url")
        if pdf_url:
            enriched["pdf_url"] = pdf_url
            enriched.setdefault("url", pdf_url)
        for key in ("title", "num_slides", "presentation_theme", "topic_preview"):
            if key in data and data[key] is not None:
                enriched[key] = data[key]
        return enriched

    if profile == "delivery_status":
        for key in ("delivery_status", "chat_id", "message_id", "to", "error"):
            if key in data and data[key] is not None:
                enriched[key] = data[key]
        return enriched

    if profile in {"vision_analysis", "llm_summary"}:
        for key in ("analysis_text", "summary_text", "text"):
            if key in data and data[key] is not None:
                enriched[key] = data[key]
        return enriched

    if profile == "llm_classification":
        for key in ("category", "matched", "analysis_text", "text"):
            if key in data and data[key] is not None:
                enriched[key] = data[key]
        return enriched

    if profile == "document_extract":
        for key in (
            "text",
            "extracted_text",
            "filename",
            "mime_type",
            "char_count",
            "page_count",
            "error",
        ):
            if key in data and data[key] is not None:
                enriched[key] = data[key]
        return enriched

    return enriched


__all__ = (
    "DEFAULT_NODE_OUTPUTS",
    "INPUT_PROFILES",
    "OUTPUT_PROFILES",
    "apply_input_profile",
    "apply_output_profile",
    "default_input_types_for_profile",
    "default_output_types_for_profile",
)
