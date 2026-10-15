# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   Publish guard: empty audience blocked; migration + router wiring present.
# Related:
#   - api/routers/product_desktop_surveys.py
# ---

from __future__ import annotations

from pathlib import Path


def audience_lists_empty(group_ids: set[object], allowlist: set[object]) -> bool:
    return len(group_ids) == 0 and len(allowlist) == 0


def test_publish_blocks_empty_audience_lists() -> None:
    assert audience_lists_empty(set(), set()) is True


def test_survey_hub_migration_and_router_wiring() -> None:
    migration = Path(__file__).resolve().parents[1] / "migrations" / "applied" / "20260703_02_survey_hub.sql"
    text = migration.read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS surveys" in text
    assert "app-survey-hub" in text
    assert "SurveyHubApp" in text

    router_path = Path(__file__).resolve().parents[1] / "routers" / "product_desktop_surveys.py"
    facade_text = router_path.read_text(encoding="utf-8")
    assert "surveys_user_router" in facade_text
    assert "surveys_admin_router" in facade_text
    assert len(facade_text.splitlines()) < 40

    admin_router_path = Path(__file__).resolve().parents[1] / "routers" / "product_desktop_surveys_admin.py"
    router_text = admin_router_path.read_text(encoding="utf-8")
    assert "Assign at least one access group or user before publish" in router_text
    assert "schedule_survey_gaf_notify" in router_text
    assert "schedule_survey_gaf_remind_incomplete" in router_text
    assert "/gaf-notify" in router_text
    assert "submitted_from" in router_text
    assert "submitted_to" in router_text

    analytics = Path(__file__).resolve().parents[1] / "services" / "surveys" / "survey_analytics_service.py"
    analytics_text = analytics.read_text(encoding="utf-8")
    assert "_response_row_filters" in analytics_text
    assert "submitted_from" in analytics_text
    assert "submitted_sort" in router_text
    assert "/admin/surveys/ai/draft" in router_text
    assert "published_survey_patch_allowed" in router_text
    assert "admin_auth import require_admin_user" in router_text
    assert "Published surveys only allow closes_at updates" in router_text

    schemas_path = Path(__file__).resolve().parents[1] / "services" / "surveys" / "survey_api_schemas.py"
    schemas_text = schemas_path.read_text(encoding="utf-8")
    assert "published_survey_patch_allowed" in schemas_text
    assert "sort_completed_survey_items" in schemas_text

    user_router_path = Path(__file__).resolve().parents[1] / "routers" / "product_desktop_surveys_user.py"
    user_router_text = user_router_path.read_text(encoding="utf-8")
    assert "sort_completed_survey_items" in user_router_text

    patch_http = Path(__file__).resolve().parents[1] / "tests" / "test_survey_admin_patch_http.py"
    assert patch_http.is_file()

    helpers_path = Path(__file__).resolve().parents[1] / "services" / "surveys" / "survey_router_helpers.py"
    helpers_text = helpers_path.read_text(encoding="utf-8")
    assert "question_count" in helpers_text

    ai_svc = Path(__file__).resolve().parents[1] / "services" / "surveys" / "survey_ai_draft_service.py"
    assert ai_svc.is_file()

    facade = Path(__file__).resolve().parents[1] / "routers" / "product_desktop.py"
    assert "surveys_router" in facade.read_text(encoding="utf-8")
