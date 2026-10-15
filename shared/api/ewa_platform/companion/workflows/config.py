# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Feature flags for companion **action workflow engine** and admin catalog (WF-0). All OFF by default.
# Invariants:
# - Sub-flags require ``companion_workflow_engine_enabled()`` unless documented otherwise.
# Related:
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md §10
# ---

from __future__ import annotations

import os


def _env_truthy(raw: str | None) -> bool:
    return str(raw or "").strip().lower() in {"1", "true", "yes", "on"}


def companion_workflow_engine_enabled() -> bool:
    """Master switch for declarative action workflow engine (WF-1+)."""

    return _env_truthy(os.getenv("EWA_COMPANION_WF_ENGINE_ENABLED"))


def companion_workflow_music_full_v1_enabled() -> bool:
    if not companion_workflow_engine_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_WF_MUSIC_FULL_V1"))


def companion_workflow_doc_package_v1_enabled() -> bool:
    if not companion_workflow_engine_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_WF_DOC_PACKAGE_V1"))


def companion_workflow_catalog_list_file_create_dev_enabled() -> bool:
    """Dev-only 2-step pilot: ``catalog_list`` then ``file_create`` (Phase 4.3)."""

    if not companion_workflow_engine_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_WF_CATALOG_LIST_FILE_CREATE_DEV"))


def companion_admin_enabled() -> bool:
    """Show EWA companion catalog section in product admin (WF-5+)."""

    return _env_truthy(os.getenv("EWA_COMPANION_ADMIN_ENABLED"))


def companion_admin_write_enabled() -> bool:
    """Allow POST/PUT on workflow catalog (WF-6). Requires admin JWT + this flag."""

    if not companion_admin_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_ADMIN_WRITE"))


def companion_workflow_pg_catalog_enabled() -> bool:
    """Load workflow definitions from PG catalog (WF-6)."""

    if not companion_workflow_engine_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_WF_PG_CATALOG"))


def companion_user_workflows_enabled() -> bool:
    """End-user personal action workflows (phrase triggers + builder UI)."""

    return _env_truthy(os.getenv("EWA_COMPANION_USER_WORKFLOWS_ENABLED", "1"))


def companion_dag_tool_registry_adapter_enabled() -> bool:
    """Route tool-backed DAG nodes through ``tool_registry`` (Phase 2.5 integration)."""

    return _env_truthy(os.getenv("EWA_COMPANION_DAG_TOOL_REGISTRY_ADAPTER_ENABLED", "0"))


def companion_dag_celery_orchestration_enabled() -> bool:
    """Persist DAG v2 state in Postgres and advance one node per Celery task."""

    if not companion_workflow_engine_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_DAG_CELERY_ORCHESTRATION_ENABLED", "0"))


def companion_workflow_engine_v2_enabled() -> bool:
    """Route ``schema_version: 2`` user workflows through the DAG Celery engine."""

    if not companion_workflow_engine_enabled():
        return False
    if not companion_dag_celery_orchestration_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_WORKFLOW_ENGINE_V2_ENABLED", "0"))


def companion_wf_telegram_sender_enabled() -> bool:
    """Allow DAG ``telegram_sender`` / tool ``telegram_sender`` outbound delivery."""

    if not companion_workflow_engine_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_WF_TELEGRAM_SENDER_ENABLED", "0"))


def companion_wf_email_dispatcher_enabled() -> bool:
    """Allow DAG ``email_dispatcher`` / tool ``email_dispatcher`` outbound delivery."""

    if not companion_workflow_engine_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_WF_EMAIL_DISPATCHER_ENABLED", "0"))


def companion_wf_strict_outbound_guard_enabled() -> bool:
    """When ON, block outbound DAG nodes unless an upstream ``confirm_gate`` completed with ``confirmed=True``."""

    if not companion_workflow_engine_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_STRICT_OUTBOUND_GUARD", "0"))


def companion_wf_vision_analyzer_enabled() -> bool:
    if not companion_workflow_engine_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_WF_VISION_ANALYZER_ENABLED", "0"))


def companion_wf_llm_summarizer_enabled() -> bool:
    if not companion_workflow_engine_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_WF_LLM_SUMMARIZER_ENABLED", "0"))


def companion_wf_llm_classifier_enabled() -> bool:
    if not companion_workflow_engine_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_WF_LLM_CLASSIFIER_ENABLED", "0"))


def companion_wf_pdf_parser_enabled() -> bool:
    """Allow DAG ``pdf_parser`` / tool ``pdf_parser`` text extraction."""

    if not companion_workflow_engine_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_WF_PDF_PARSER_ENABLED", "0"))


def companion_wf_document_extractor_enabled() -> bool:
    """Allow DAG ``document_extractor`` / tool ``document_extractor`` text extraction."""

    if not companion_workflow_engine_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_WF_DOCUMENT_EXTRACTOR_ENABLED", "0"))


def companion_wf_data_transformer_enabled() -> bool:
    """Allow DAG ``data_transformer`` inline transform nodes."""

    if not companion_workflow_engine_enabled():
        return False
    return _env_truthy(os.getenv("EWA_COMPANION_WF_DATA_TRANSFORMER_ENABLED", "1"))
