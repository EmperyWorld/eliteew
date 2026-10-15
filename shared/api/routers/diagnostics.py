#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   REST-эндпоинты быстрых проверок и запуска/списка отчётов диагностики (OAuth2).
# Invariants:
#   - Временные метки и started_at — UTC naive через datetime_helpers.
# Related:
#   - api/models/database_models.py (DiagnosticReport)
# ------------------------------------------------------------------------------
"""
Diagnostics API Router
Provides endpoints for quick system checks, deep diagnostics run, and reports listing.
"""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request  # type: ignore[import-untyped]
from sqlalchemy import desc, select  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.models.database_models import DiagnosticReport
from api.utils.datetime_helpers import utc_now_iso, utc_now_naive

router = APIRouter(prefix="/api/v1/diagnostics", tags=["Diagnostics"])


@router.post("/quick-check")
async def quick_check(
    _request: Request,
    _user: User = Depends(require_oauth2_user),
) -> dict[str, Any]:
    """Lightweight health snapshot for UI quick diagnostics (authenticated only)."""
    try:
        ts = utc_now_iso()
        # Basic checks already available
        return {
            "timestamp": ts,
            "api": {"status": "ok"},
            "endpoints": {
                "health": "/health",
                "api_health": "/api/health",
                "database_health": "/api/database/health",
            },
        }
    except (ValueError, RuntimeError, AttributeError) as e:
        error_msg = f"Quick check failed: {e}"
        raise HTTPException(status_code=500, detail=error_msg) from e
    except Exception as e:
        error_msg = f"Unexpected error in quick check: {e}"
        raise HTTPException(status_code=500, detail=error_msg) from e


@router.post("/run")
async def run_diagnostics(
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    mode: str = Query("quick", description="quick|deep|forensic|predictive|browser"),
) -> dict[str, Any]:
    """Create diagnostic report stub and return report_id for async processing."""
    try:
        report_id = uuid.uuid4().hex[:16]
        report = DiagnosticReport(
            report_id=report_id,
            user_id=None,  # Keycloak users not stored locally reliably; leave null
            mode=mode,
            status="running",
            executive_summary="Pending",
            generated_by="api",
            started_at=utc_now_naive(),
        )
        db.add(report)
        await db.commit()
        return {"report_id": report_id, "status": "queued"}
    except (ValueError, RuntimeError, AttributeError) as e:
        await db.rollback()
        error_msg = f"Failed to start diagnostics: {e}"
        raise HTTPException(status_code=500, detail=error_msg) from e
    except Exception as e:
        await db.rollback()
        error_msg = f"Unexpected error starting diagnostics: {e}"
        raise HTTPException(status_code=500, detail=error_msg) from e


@router.get("/reports")
async def list_reports(
    _user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """List recent diagnostic reports (most recent first). Authenticated users only."""
    try:
        q = select(DiagnosticReport).order_by(desc(DiagnosticReport.created_at)).offset(offset).limit(limit)
        rows = (await db.execute(q)).scalars().all()
        return {"items": [r.to_dict() for r in rows], "limit": limit, "offset": offset, "count": len(rows)}
    except (ValueError, RuntimeError, AttributeError) as e:
        error_msg = f"Failed to list reports: {e}"
        raise HTTPException(status_code=500, detail=error_msg) from e
    except Exception as e:
        error_msg = f"Unexpected error listing reports: {e}"
        raise HTTPException(status_code=500, detail=error_msg) from e
