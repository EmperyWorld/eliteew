# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for cross-app draft remote lifecycle sync helpers (no live DB).
# Invariants:
# - Terminal states are not downgraded by client reports or refresh mappers.
# Related:
# - api/services/professional_worlds/cross_app_draft_remote_sync.py
# ---

from __future__ import annotations

from api.services.professional_worlds.cross_app_draft_constants import (
    DRAFT_LIFECYCLE_CANCELLED,
    DRAFT_LIFECYCLE_CREATED,
    DRAFT_LIFECYCLE_OPENED,
    DRAFT_LIFECYCLE_PUBLISHED,
    DRAFT_LIFECYCLE_UPDATED,
)
from api.services.professional_worlds.cross_app_draft_remote_sync import (
    map_ewrp_job_status,
    map_site_publication_state,
    merge_remote_tracking,
    normalize_client_report_lifecycle,
    read_remote_tracking,
    remote_tracking_patch,
)


def test_map_ewrp_job_status_completed_is_published() -> None:
    assert map_ewrp_job_status("completed") == DRAFT_LIFECYCLE_PUBLISHED
    assert map_ewrp_job_status("failed") == DRAFT_LIFECYCLE_CANCELLED
    assert map_ewrp_job_status("generating_content") == DRAFT_LIFECYCLE_UPDATED


def test_map_site_publication_open_is_published() -> None:
    assert map_site_publication_state("open") == DRAFT_LIFECYCLE_PUBLISHED
    assert map_site_publication_state("closed") is None


def test_normalize_client_report_opened_from_created() -> None:
    assert normalize_client_report_lifecycle(DRAFT_LIFECYCLE_CREATED, DRAFT_LIFECYCLE_OPENED) == DRAFT_LIFECYCLE_OPENED
    assert normalize_client_report_lifecycle(DRAFT_LIFECYCLE_OPENED, DRAFT_LIFECYCLE_OPENED) is None


def test_normalize_client_report_published_is_terminal() -> None:
    assert (
        normalize_client_report_lifecycle(DRAFT_LIFECYCLE_OPENED, DRAFT_LIFECYCLE_PUBLISHED)
        == DRAFT_LIFECYCLE_PUBLISHED
    )
    assert normalize_client_report_lifecycle(DRAFT_LIFECYCLE_PUBLISHED, DRAFT_LIFECYCLE_OPENED) is None


def test_merge_remote_tracking_keeps_known_ids() -> None:
    ext = {"destination": "ewrp"}
    merged = merge_remote_tracking(ext, {"ewrp_job_id": "abc", "site_instance_id": ""})
    tracking = read_remote_tracking(merged)
    assert tracking["ewrp_job_id"] == "abc"
    assert "site_instance_id" not in tracking
    patch = remote_tracking_patch(ext, {"ewrp_job_id": "abc"})
    assert patch == {"remote_tracking": {"ewrp_job_id": "abc"}}
