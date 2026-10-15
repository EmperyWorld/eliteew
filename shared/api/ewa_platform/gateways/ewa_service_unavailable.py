# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Stable **503 Service Unavailable** payloads for EWA HTTP routers when the EWA asyncpg pool is missing or companion chat
# LLM is administratively disabled — machine-readable ``detail.code`` for operators and monitors.
# Invariants:
# - Never embed DSN secrets; messages are generic English operator text.
# - Distinguish **unset** ``EWA_DATABASE_URL`` from **set DSN but no pool** (startup / connectivity failure).
# Related:
# - api/ewa_platform/gateways/routers/companion_profile.py
# - api/ewa_platform/gateways/routers/companion_chat.py
# - documentation/platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md
# ---
"""EWA-specific HTTP 503 helpers (structured ``detail``)."""

from __future__ import annotations

import os
from typing import Any

from fastapi import HTTPException, status  # type: ignore[import-untyped]

CODE_EWA_DATABASE_URL_UNSET = "ewa_database_url_unset"
CODE_EWA_ORCHESTRATION_POOL_UNAVAILABLE = "ewa_orchestration_pool_unavailable"
CODE_COMPANION_CHAT_LLM_DISABLED = "companion_chat_llm_disabled"


def ewa_pool_unavailable_detail() -> dict[str, Any]:
    """Return JSON-serializable ``detail`` body (FastAPI ``HTTPException`` ``detail``)."""

    if not os.getenv("EWA_DATABASE_URL", "").strip():
        return {
            "code": CODE_EWA_DATABASE_URL_UNSET,
            "message": (
                "EWA_DATABASE_URL is not set; EWA companion and orchestration persistence are not available on this API."
            ),
        }
    return {
        "code": CODE_EWA_ORCHESTRATION_POOL_UNAVAILABLE,
        "message": (
            "EWA_DATABASE_URL is set but the EWA orchestration pool is not available; "
            "check API startup logs and EWA Postgres (see EWA-POSTGRES-RUNBOOK.md)."
        ),
    }


def ewa_pool_unavailable_exception() -> HTTPException:
    """503 when ``request.app.state.ewa_orchestration_pool`` is ``None``."""

    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=ewa_pool_unavailable_detail(),
    )


def companion_chat_llm_disabled_exception() -> HTTPException:
    """503 when companion chat refuses to run because HTTP LLM is disabled by configuration."""

    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={
            "code": CODE_COMPANION_CHAT_LLM_DISABLED,
            "message": "Companion chat HTTP LLM path is disabled by configuration.",
        },
    )
