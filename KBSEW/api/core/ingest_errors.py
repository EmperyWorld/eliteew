# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Normalize ingestion exception text and typed boundary errors for enqueue/fetch.
# Invariants:
# - Never return an empty operator-visible message when an exception was caught.
# - JobLeaseLostError is not a terminal failure; stale recovery already requeued.
# Related:
# - api/services/ingestion_service.py
# - api/services/ingestion_worker.py
# - api/services/safe_http.py
# ---

from __future__ import annotations


class JobLeaseLostError(RuntimeError):
    """Worker no longer owns the job lease (heartbeat miss or CAS loss)."""

    def __init__(self, job_id: str, *, reason: str = "lease_lost") -> None:
        self.job_id = job_id
        self.reason = reason
        super().__init__(f"job_id={job_id} reason={reason}")


class BarrelDisabledError(ValueError):
    """Ingest/reindex rejected because the barrel is disabled."""


class IngestPayloadTooLargeError(ValueError):
    """Upload or URL body exceeds KBSEW_INGEST_MAX_BYTES."""

    def __init__(self, *, size: int, limit: int) -> None:
        self.size = size
        self.limit = limit
        super().__init__(f"Ingest payload too large: {size} bytes (limit {limit})")


class UnsafeIngestUrlError(ValueError):
    """URL ingest blocked by SSRF / scheme / redirect policy."""


def format_ingestion_error(exc: BaseException) -> str:
    message = str(exc).strip()
    if message:
        return message
    return f"{type(exc).__name__}: {exc!r}"
