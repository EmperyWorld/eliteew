# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared helpers for KBSEW ingestion (logging, digests, progress CAS).
# Invariants:
# - Progress updates use touch_job_progress CAS; miss → JobLeaseLostError.
# Related:
# - api/services/ingestion_service.py
# - documentation/product/KBSEW.md
# ---

from __future__ import annotations

import hashlib
import json
import logging
import re
from typing import Any

import api.services.barrel_service as barrel_service
from api.core.ingest_errors import BarrelDisabledError, JobLeaseLostError

logger = logging.getLogger(__name__)

_SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def trace_payload(
    *,
    trace_id: str | None,
    job_id: str,
    asset_id: str,
    barrel_id: str,
    stage: str,
    status: str,
) -> str:
    return json.dumps(
        {
            "event": "kbsew_ingestion",
            "trace_id": trace_id,
            "job_id": job_id,
            "asset_id": asset_id,
            "barrel_id": barrel_id,
            "stage": stage,
            "status": status,
        },
        ensure_ascii=False,
        sort_keys=True,
    )


def job_log(
    *,
    trace_id: str | None,
    job_id: str,
    asset_id: str,
    barrel_id: str,
    stage: str,
    status: str,
    level: int = logging.INFO,
) -> None:
    logger.log(
        level,
        trace_payload(
            trace_id=trace_id,
            job_id=job_id,
            asset_id=asset_id,
            barrel_id=barrel_id,
            stage=stage,
            status=status,
        ),
    )


def sha256_hex(data: bytes | str) -> str:
    raw = data.encode("utf-8") if isinstance(data, str) else data
    return hashlib.sha256(raw).hexdigest()


def safe_filename(filename: str) -> str:
    cleaned = _SAFE_FILENAME_RE.sub("_", filename.strip() or "document.pdf").strip("._")
    return cleaned or "document.pdf"


def require_barrel_enabled(barrel: dict[str, Any]) -> None:
    if not barrel.get("enabled"):
        raise BarrelDisabledError("Barrel disabled")


async def progress(
    job_id: str,
    *,
    worker_id: str,
    progress_pct: int,
    message: str,
) -> None:
    ok = await barrel_service.touch_job_progress(
        job_id,
        worker_id=worker_id,
        progress_pct=progress_pct,
        message=message,
    )
    if not ok:
        raise JobLeaseLostError(job_id, reason="progress_cas_miss")
