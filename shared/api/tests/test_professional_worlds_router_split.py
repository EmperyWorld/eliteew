# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for Professional Worlds router split (core bootstrap, CRM, media, CRM-lite, AI, playbooks, learning, workspace).
# Invariants:
# - Tests avoid importing heavy multipart/full-stack deps when only route wiring is checked.
# Related:
# - api/routers/professional_worlds.py
# - api/routers/professional_worlds_realtor_crm.py
# - api/routers/professional_worlds_realtor_media.py
# - api/routers/professional_worlds_crm_lite.py
# - api/routers/professional_worlds_ai_streams.py
# - api/routers/professional_worlds_playbooks.py
# - api/routers/professional_worlds_learning.py
# - api/routers/professional_worlds_workspace.py
# - api/routers/professional_worlds_core.py
# ---

from __future__ import annotations

from pathlib import Path

from fastapi.routing import APIRoute


def test_realtor_crm_router_exposes_core_crm_paths() -> None:
    """Realtor Pro CRM sub-router must declare leads, communications, and listing CRUD paths."""
    from api.routers.professional_worlds_realtor_crm import realtor_crm_router

    paths = {getattr(route, "path", "") or "" for route in realtor_crm_router.routes if isinstance(route, APIRoute)}
    assert "/realtor/leads" in paths
    assert "/realtor/communication-logs" in paths
    assert "/realtor/properties/{property_id}" in paths


def test_crm_lite_router_exposes_clients_and_deals_paths() -> None:
    """CRM-lite sub-router must declare generic clients/deals endpoints."""
    from api.routers.professional_worlds_crm_lite import crm_lite_router

    paths = {getattr(route, "path", "") or "" for route in crm_lite_router.routes if isinstance(route, APIRoute)}
    assert "/clients" in paths
    assert "/deals" in paths
    assert "/deals/backfill-property-links" in paths


def test_ai_streams_router_exposes_text_generation_paths() -> None:
    """AI streams sub-router must declare property description/content-pack and coach simulate routes."""
    from api.routers.professional_worlds_ai_streams import ai_streams_router

    paths = {getattr(route, "path", "") or "" for route in ai_streams_router.routes if isinstance(route, APIRoute)}
    assert "/realtor/properties/{property_id}/generate-description/stream" in paths
    assert "/realtor/properties/{property_id}/generate-content-pack/stream" in paths
    assert "/coach/simulate/stream" in paths


def test_playbooks_router_exposes_run_and_resume_paths() -> None:
    """Playbooks sub-router must declare list/run/resume SSE routes."""
    from api.routers.professional_worlds_playbooks import playbooks_router

    paths = {getattr(route, "path", "") or "" for route in playbooks_router.routes if isinstance(route, APIRoute)}
    assert "/playbook-runs" in paths
    assert "/playbooks/{vertical_slug}/{playbook_key}/stream" in paths
    assert "/playbook-runs/{run_id}/resume/stream" in paths


def test_realtor_media_router_source_declares_intake_and_batch_paths() -> None:
    """Media sub-router must declare attach, intake, and batch SSE paths (source guard without multipart import)."""
    router_path = Path(__file__).resolve().parents[1] / "routers" / "professional_worlds_realtor_media.py"
    source = router_path.read_text(encoding="utf-8")
    assert '"/realtor/properties/{property_id}/media"' in source
    assert '"/realtor/properties/intake/parse/stream"' in source
    assert '"/realtor/properties/{property_id}/media/enhance/batches/{batch_id}/run/stream"' in source
    assert '"/media/albums"' in source


def test_learning_router_exposes_courses_and_artifacts_paths() -> None:
    """Learning sub-router must declare courses, lesson completion, and artifacts list routes."""
    from api.routers.professional_worlds_learning import learning_router

    paths = {getattr(route, "path", "") or "" for route in learning_router.routes if isinstance(route, APIRoute)}
    assert "/learning/courses" in paths
    assert "/learning/courses/{course_id}" in paths
    assert "/learning/lessons/{lesson_id}/complete" in paths
    assert "/artifacts" in paths


def test_workspace_router_exposes_brand_kit_and_cross_app_paths() -> None:
    """Workspace sub-router must declare brand kit, cross-app drafts, and property draft handoffs."""
    from api.routers.professional_worlds_workspace import workspace_router

    paths = {getattr(route, "path", "") or "" for route in workspace_router.routes if isinstance(route, APIRoute)}
    assert "/me/brand-visual-kit" in paths
    assert "/cross-app/drafts" in paths
    assert "/cross-app/drafts/{link_id}/refresh" in paths
    assert "/cross-app/drafts/{link_id}/report" in paths
    assert "/realtor/properties/{property_id}/drafts/{draft_kind}" in paths


def test_core_router_exposes_bootstrap_paths() -> None:
    """Core sub-router must declare verticals, profile, runtime, activations, and snapshot routes."""
    from api.routers.professional_worlds_core import core_router

    paths = {getattr(route, "path", "") or "" for route in core_router.routes if isinstance(route, APIRoute)}
    assert "/verticals" in paths
    assert "/me/profile" in paths
    assert "/me/runtime-config" in paths
    assert "/me/vertical-activations" in paths
    assert "/me/snapshot" in paths


def test_professional_worlds_monolith_includes_all_split_sub_routers() -> None:
    """Main router must mount extracted sub-routers (regression guard without full import)."""
    router_path = Path(__file__).resolve().parents[1] / "routers" / "professional_worlds.py"
    source = router_path.read_text(encoding="utf-8")
    for snippet in (
        "router.include_router(core_router)",
        "router.include_router(realtor_crm_router)",
        "router.include_router(realtor_media_router)",
        "router.include_router(crm_lite_router)",
        "router.include_router(ai_streams_router)",
        "router.include_router(playbooks_router)",
        "router.include_router(learning_router)",
        "router.include_router(workspace_router)",
    ):
        assert snippet in source
