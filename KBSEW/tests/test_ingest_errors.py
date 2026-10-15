# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Ingestion error formatting contract tests.
# ---

from __future__ import annotations

from api.core.ingest_errors import JobLeaseLostError, format_ingestion_error


def test_format_ingestion_error_uses_str_when_present() -> None:
    assert format_ingestion_error(ValueError("bad pdf")) == "bad pdf"


def test_format_ingestion_error_falls_back_to_repr_for_empty_str() -> None:
    exc = Exception()
    message = format_ingestion_error(exc)
    assert message.startswith("Exception:")


def test_job_lease_lost_error_carries_job_id_and_reason() -> None:
    exc = JobLeaseLostError("job-1", reason="complete_cas_miss")
    assert exc.job_id == "job-1"
    assert exc.reason == "complete_cas_miss"
    assert "complete_cas_miss" in str(exc)
