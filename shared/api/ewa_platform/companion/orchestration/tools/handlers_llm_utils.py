# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# LLM/vision/document utility tools: summarize, classify, vision, PDF, extractor, paperless, social post.
# Invariants:
# - Handler module for EWA companion tool registry; behavior matches pre-split ``tool_registry.py``.
# Related:
# - api/ewa_platform/companion/orchestration/tools/registry_core.py
# - api/ewa_platform/companion/orchestration/tool_registry.py
# ---
"""EWA companion tool registry handlers — llm_utils."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Final

from api.ewa_platform.companion.orchestration.tools.registry_types import (
    ToolContext,
    ToolHandler,
    ToolResult,
)

logger = logging.getLogger(__name__)


async def _handle_vision_analyze(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    from api.ewa_platform.companion.workflows.config import companion_wf_vision_analyzer_enabled
    from api.ewa_platform.companion.workflows.dag.workflow_ai_services import run_vision_analysis

    if not companion_wf_vision_analyzer_enabled():
        return ToolResult(
            tool="vision_analyze",
            status="error",
            reply="Vision analyzer is disabled (EWA_COMPANION_WF_VISION_ANALYZER_ENABLED).",
            actions=[],
            data={"error": "feature_disabled"},
        )
    try:
        analysis_text = await run_vision_analysis(args, ctx)
    except ValueError as exc:
        return ToolResult(
            tool="vision_analyze",
            status="error",
            reply=str(exc),
            actions=[],
            data={"error": str(exc)},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] vision_analyze_failed err=%s", exc)
        return ToolResult(
            tool="vision_analyze",
            status="error",
            reply=f"Vision analysis failed: {exc}",
            actions=[],
            data={"error": str(exc)[:500]},
        )
    if not analysis_text:
        return ToolResult(
            tool="vision_analyze",
            status="error",
            reply="Vision model returned an empty analysis.",
            actions=[],
            data={},
        )
    return ToolResult(
        tool="vision_analyze",
        status="ok",
        reply=analysis_text,
        actions=[],
        data={"analysis_text": analysis_text, "text": analysis_text},
    )


async def _handle_llm_summarize(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    from api.ewa_platform.companion.workflows.config import companion_wf_llm_summarizer_enabled
    from api.ewa_platform.companion.workflows.dag.workflow_ai_services import run_llm_summarize

    if not companion_wf_llm_summarizer_enabled():
        return ToolResult(
            tool="llm_summarize",
            status="error",
            reply="LLM summarizer is disabled (EWA_COMPANION_WF_LLM_SUMMARIZER_ENABLED).",
            actions=[],
            data={"error": "feature_disabled"},
        )
    try:
        summary_text = await run_llm_summarize(args, ctx)
    except ValueError as exc:
        return ToolResult(
            tool="llm_summarize",
            status="error",
            reply=str(exc),
            actions=[],
            data={"error": str(exc)},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] llm_summarize_failed err=%s", exc)
        return ToolResult(
            tool="llm_summarize",
            status="error",
            reply=f"Summarization failed: {exc}",
            actions=[],
            data={"error": str(exc)[:500]},
        )
    from api.ewa_platform.agentic.kernel.visible_text import sanitize_agentic_visible_text

    summary_text = sanitize_agentic_visible_text(summary_text)
    if not summary_text:
        return ToolResult(
            tool="llm_summarize",
            status="error",
            reply="Summarization returned empty text after sanitizing model control tags.",
            actions=[],
            data={"error": "empty_summary_after_sanitize"},
        )
    return ToolResult(
        tool="llm_summarize",
        status="ok",
        reply=summary_text,
        actions=[],
        data={"summary_text": summary_text, "analysis_text": summary_text, "text": summary_text},
    )


async def _handle_llm_classify(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    from api.ewa_platform.companion.workflows.config import companion_wf_llm_classifier_enabled
    from api.ewa_platform.companion.workflows.dag.workflow_ai_services import run_llm_classify

    if not companion_wf_llm_classifier_enabled():
        return ToolResult(
            tool="llm_classify",
            status="error",
            reply="LLM classifier is disabled (EWA_COMPANION_WF_LLM_CLASSIFIER_ENABLED).",
            actions=[],
            data={"error": "feature_disabled"},
        )
    try:
        category, matched, analysis_text = await run_llm_classify(args, ctx)
    except ValueError as exc:
        return ToolResult(
            tool="llm_classify",
            status="error",
            reply=str(exc),
            actions=[],
            data={"error": str(exc)},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] llm_classify_failed err=%s", exc)
        return ToolResult(
            tool="llm_classify",
            status="error",
            reply=f"Classification failed: {exc}",
            actions=[],
            data={"error": str(exc)[:500]},
        )
    return ToolResult(
        tool="llm_classify",
        status="ok",
        reply=analysis_text,
        actions=[],
        data={
            "category": category,
            "matched": matched,
            "analysis_text": analysis_text,
            "text": analysis_text,
        },
    )


async def _handle_pdf_parser(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    from api.ewa_platform.companion.workflows.config import companion_wf_pdf_parser_enabled
    from api.ewa_platform.companion.workflows.dag.workflow_document_services import (
        resolve_workflow_document_bytes,
        run_pdf_text_extraction,
    )

    if not companion_wf_pdf_parser_enabled():
        return ToolResult(
            tool="pdf_parser",
            status="error",
            reply="PDF parser is disabled (EWA_COMPANION_WF_PDF_PARSER_ENABLED).",
            actions=[],
            data={"error": "feature_disabled"},
        )
    try:
        document = await resolve_workflow_document_bytes(ctx, args)
        extract_result = await run_pdf_text_extraction(document)
    except ValueError as exc:
        return ToolResult(
            tool="pdf_parser",
            status="error",
            reply=str(exc),
            actions=[],
            data={"error": str(exc)},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] pdf_parser_failed err=%s", exc)
        return ToolResult(
            tool="pdf_parser",
            status="error",
            reply=f"PDF extraction failed: {exc}",
            actions=[],
            data={"error": str(exc)[:500]},
        )

    payload = extract_result.as_dict()
    if not extract_result.ok:
        error = extract_result.error or "empty_pdf_text"
        return ToolResult(
            tool="pdf_parser",
            status="error",
            reply=error,
            actions=[],
            data={**payload, "error": error},
        )

    preview = extract_result.text[:500]
    if len(extract_result.text) > 500:
        preview = f"{preview}…"
    reply = preview or f"Extracted {extract_result.char_count} chars from {extract_result.filename}"
    return ToolResult(
        tool="pdf_parser",
        status="ok",
        reply=reply,
        actions=[],
        data=payload,
    )


async def _handle_document_extractor(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    from api.ewa_platform.companion.workflows.config import companion_wf_document_extractor_enabled
    from api.ewa_platform.companion.workflows.dag.workflow_document_services import (
        resolve_workflow_document_bytes,
        run_document_text_extraction,
    )

    if not companion_wf_document_extractor_enabled():
        return ToolResult(
            tool="document_extractor",
            status="error",
            reply=(
                "Чтение документов сейчас недоступно на сервере. "
                "Продолжите задачу без файлов или попросите оператора включить извлечение текста."
            ),
            actions=[],
            data={"error": "feature_disabled"},
        )

    has_source = any(
        str(args.get(key) or "").strip() for key in ("unified_content_id", "document_id", "paperless_id", "file_base64")
    )
    if not has_source:
        ru = any("\u0400" <= ch <= "\u04ff" for ch in str(args.get("user_line") or ctx.user_line or ""))
        return ToolResult(
            tool="document_extractor",
            status="error",
            reply=(
                "Сначала получите список файлов (catalog_list) или откройте файл (file_open), "
                "затем укажите unified_content_id для извлечения текста."
                if ru
                else "Run catalog_list or file_open first, then pass unified_content_id to document_extractor."
            ),
            actions=[{"type": "open_app", "app_component": "EwaFileManager"}],
            data={"error": "document_source_required"},
        )

    try:
        document = await resolve_workflow_document_bytes(ctx, args)
        extract_result = await run_document_text_extraction(document)
    except ValueError as exc:
        return ToolResult(
            tool="document_extractor",
            status="error",
            reply=str(exc),
            actions=[],
            data={"error": str(exc)},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] document_extractor_failed err=%s", exc)
        return ToolResult(
            tool="document_extractor",
            status="error",
            reply=f"Document extraction failed: {exc}",
            actions=[],
            data={"error": str(exc)[:500]},
        )

    payload = extract_result.as_dict()
    if not extract_result.ok:
        error = extract_result.error or "empty_document_text"
        return ToolResult(
            tool="document_extractor",
            status="error",
            reply=error,
            actions=[],
            data={**payload, "error": error},
        )

    preview = extract_result.text[:500]
    if len(extract_result.text) > 500:
        preview = f"{preview}…"
    reply = preview or f"Extracted {extract_result.char_count} chars from {extract_result.filename}"
    return ToolResult(
        tool="document_extractor",
        status="ok",
        reply=reply,
        actions=[],
        data=payload,
    )


async def _handle_paperless_import(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Import a Paperless-ngx document into unified_content (DocEditor V2 path)."""

    uid = (ctx.content_catalog_user_id or "").strip()
    if not uid:
        return None
    raw_id = args.get("paperless_id")
    try:
        paperless_id = int(raw_id) if raw_id is not None else 0
    except TypeError, ValueError:
        paperless_id = 0
    if paperless_id < 1:
        return ToolResult(
            tool="paperless_import",
            status="error",
            reply="Укажи номер документа Paperless (paperless_id).",
            actions=[],
            data={},
        )

    from api.core.database_manager import get_asyncpg_pool
    from api.schemas.doc_editor_v2 import DocEditorV2ImportRequest, DocEditorV2SourceFormat
    from api.services.doc_editor_v2 import DocumentEditorV2Service
    from api.services.stack4.paperless_gateway import (
        PaperlessGatewayError,
        PaperlessNotConfigured,
        get_paperless_gateway,
    )

    pool = ctx.main_pool
    if pool is None:
        pool = await get_asyncpg_pool()

    gateway = get_paperless_gateway()
    try:
        file_bytes, meta = await gateway.download_document_bytes(paperless_id)
    except PaperlessNotConfigured:
        return ToolResult(
            tool="paperless_import",
            status="error",
            reply="Paperless не настроен на сервере (нужен PAPERLESS_API_TOKEN).",
            actions=[],
            data={},
        )
    except PaperlessGatewayError as exc:
        return ToolResult(
            tool="paperless_import",
            status="error",
            reply=f"Не удалось загрузить документ из Paperless: {exc}",
            actions=[],
            data={"paperless_id": paperless_id},
        )

    import base64

    filename = meta.original_file_name or f"{meta.title}.pdf"
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else "pdf"
    try:
        source_format = DocEditorV2SourceFormat(suffix)
    except ValueError:
        source_format = DocEditorV2SourceFormat.PDF

    service = DocumentEditorV2Service(pool)
    request = DocEditorV2ImportRequest(
        filename=filename,
        source_format=source_format,
        content_base64=base64.b64encode(file_bytes).decode("ascii"),
        title=meta.title,
    )
    try:
        imported = await service.import_document(uid, request)
    except Exception as exc:  # noqa: BLE001
        logger.warning("paperless_import_failed paperless_id=%s err=%s", paperless_id, exc)
        return ToolResult(
            tool="paperless_import",
            status="error",
            reply=f"Импорт в редактор не удался: {exc}",
            actions=[],
            data={"paperless_id": paperless_id},
        )

    doc = imported.document
    uc_id = str(doc.document_id)
    return ToolResult(
        tool="paperless_import",
        status="ok",
        reply=f"Импортировала «{meta.title}» из Paperless (#{paperless_id}) в редактор.",
        actions=[
            {
                "type": "open_doc_editor_v2",
                "unified_content_id": uc_id,
                "document_id": str(doc.document_id),
                "title": doc.title,
            }
        ],
        data={
            "paperless_id": paperless_id,
            "unified_content_id": uc_id,
            "document_id": str(doc.document_id),
            "parse_warnings": imported.parse_warnings,
        },
    )


async def _handle_social_post_compose(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    from api.ewa_platform.companion.orchestration.companion_social_post_compose import (
        handle_social_post_compose,
    )

    return await handle_social_post_compose(args, ctx)


HANDLERS: Final[dict[str, ToolHandler]] = {
    "vision_analyze": _handle_vision_analyze,
    "llm_summarize": _handle_llm_summarize,
    "llm_classify": _handle_llm_classify,
    "pdf_parser": _handle_pdf_parser,
    "document_extractor": _handle_document_extractor,
    "paperless_import": _handle_paperless_import,
    "social_post_compose": _handle_social_post_compose,
}
