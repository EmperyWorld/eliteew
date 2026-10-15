"""Unit tests: per-widget dashboard list slices (filters/sort cap)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from api.schemas.marketing_cabinet.dashboard import GridPosition, WidgetResponse
from api.services.marketing_cabinet.dashboard_bundle_slices import build_widget_list_slices


def _ts() -> datetime:
    return datetime.now(UTC)


def _widget(
    *,
    wid: UUID,
    key: str,
    cfg: dict,
) -> WidgetResponse:
    now = _ts()
    return WidgetResponse(
        id=wid,
        layout_id=uuid4(),
        widget_key=key,
        widget_title="t",
        widget_config=cfg,
        grid_position=GridPosition(),
        is_visible=True,
        is_locked=False,
        display_order=0,
        created_at=now,
        updated_at=now,
    )


def test_tasks_slice_respects_status_filter_and_max_items() -> None:
    w1 = uuid4()
    tasks = [
        {
            "id": "a",
            "project_id": "p",
            "company_id": "c",
            "title": "open one",
            "status": "open",
            "due_at": "2026-01-02T00:00:00+00:00",
            "updated_at": "2026-01-02T00:00:00+00:00",
        },
        {
            "id": "b",
            "project_id": "p",
            "company_id": "c",
            "title": "done",
            "status": "completed",
            "due_at": None,
            "updated_at": "2026-01-03T00:00:00+00:00",
        },
    ]
    widgets = [
        _widget(
            wid=w1,
            key="tasks",
            cfg={"filters": {"status": "open"}, "maxItems": 5},
        ),
    ]
    out = build_widget_list_slices(widgets, tasks=tasks, alerts=[])
    assert set(out.keys()) == {str(w1)}
    assert [r["id"] for r in out[str(w1)]["tasks"]] == ["a"]
    assert out[str(w1)]["filtered_total"] == 1


def test_alerts_slice_sorts_by_severity_default() -> None:
    w1 = uuid4()
    alerts = [
        {
            "id": "x",
            "project_id": "p",
            "company_id": "c",
            "title": "low",
            "severity": "low",
            "status": "open",
            "updated_at": "2026-01-01T00:00:00+00:00",
        },
        {
            "id": "y",
            "project_id": "p",
            "company_id": "c",
            "title": "critical",
            "severity": "critical",
            "status": "open",
            "updated_at": "2026-01-01T00:00:00+00:00",
        },
    ]
    widgets = [_widget(wid=w1, key="alerts", cfg={"maxItems": 10})]
    out = build_widget_list_slices(widgets, tasks=[], alerts=alerts)
    ids = [r["id"] for r in out[str(w1)]["alerts"]]
    assert ids == ["y", "x"]
    assert out[str(w1)]["alerts_open_count"] == 2
    assert out[str(w1)]["filtered_total"] == 2


def test_alerts_open_count_respects_status_filter() -> None:
    w1 = uuid4()
    alerts = [
        {
            "id": "a",
            "project_id": "p",
            "company_id": "c",
            "title": "open",
            "severity": "low",
            "status": "open",
            "updated_at": "2026-01-01T00:00:00+00:00",
        },
        {
            "id": "b",
            "project_id": "p",
            "company_id": "c",
            "title": "done",
            "severity": "critical",
            "status": "resolved",
            "updated_at": "2026-01-02T00:00:00+00:00",
        },
    ]
    widgets = [
        _widget(
            wid=w1,
            key="alerts",
            cfg={"filters": {"status": "open"}, "maxItems": 10},
        ),
    ]
    out = build_widget_list_slices(widgets, tasks=[], alerts=alerts)
    assert out[str(w1)]["alerts_open_count"] == 1
    assert out[str(w1)]["filtered_total"] == 1


def test_campaigns_slice_respects_channel_filter() -> None:
    w1 = uuid4()
    campaigns = [
        {
            "id": "c1",
            "project_id": "p",
            "company_id": "co",
            "name": "Email",
            "channel": "email",
            "status": "active",
            "updated_at": "2026-01-02T00:00:00+00:00",
        },
        {
            "id": "c2",
            "project_id": "p",
            "company_id": "co",
            "name": "Social",
            "channel": "social",
            "status": "active",
            "updated_at": "2026-01-03T00:00:00+00:00",
        },
    ]
    widgets = [
        _widget(
            wid=w1,
            key="campaigns",
            cfg={"filters": {"channel": "email"}, "maxItems": 5},
        ),
    ]
    out = build_widget_list_slices(widgets, tasks=[], alerts=[], campaigns=campaigns, segments=[], researches=[])
    assert [r["id"] for r in out[str(w1)]["campaigns"]] == ["c1"]
    assert out[str(w1)]["filtered_total"] == 1


def test_segments_slice_respects_status_filter() -> None:
    w1 = uuid4()
    segments = [
        {
            "id": "s1",
            "project_id": "p",
            "company_id": "co",
            "name": "Active seg",
            "segment_type": "b2b",
            "status": "active",
            "priority": "high",
            "updated_at": "2026-01-02T00:00:00+00:00",
        },
        {
            "id": "s2",
            "project_id": "p",
            "company_id": "co",
            "name": "Draft seg",
            "segment_type": "b2c",
            "status": "draft",
            "priority": "medium",
            "updated_at": "2026-01-03T00:00:00+00:00",
        },
    ]
    widgets = [
        _widget(
            wid=w1,
            key="segments",
            cfg={"filters": {"status": "active"}, "maxItems": 10},
        ),
    ]
    out = build_widget_list_slices(widgets, tasks=[], alerts=[], campaigns=[], segments=segments, researches=[])
    assert [r["id"] for r in out[str(w1)]["segments"]] == ["s1"]
    assert out[str(w1)]["filtered_total"] == 1


def test_researches_slice_sorts_by_title_field() -> None:
    w1 = uuid4()
    researches = [
        {
            "id": "r1",
            "project_id": "p",
            "company_id": "co",
            "title": "Zebra",
            "research_type": "market",
            "status": "active",
            "priority": "medium",
            "updated_at": "2026-01-01T00:00:00+00:00",
        },
        {
            "id": "r2",
            "project_id": "p",
            "company_id": "co",
            "title": "Alpha",
            "research_type": "competitive",
            "status": "active",
            "priority": "low",
            "updated_at": "2026-01-02T00:00:00+00:00",
        },
    ]
    widgets = [
        _widget(
            wid=w1,
            key="researches",
            cfg={"sort": {"field": "title", "direction": "asc"}, "maxItems": 10},
        ),
    ]
    out = build_widget_list_slices(widgets, tasks=[], alerts=[], campaigns=[], segments=[], researches=researches)
    assert [r["id"] for r in out[str(w1)]["researches"]] == ["r2", "r1"]
    assert out[str(w1)]["filtered_total"] == 2


def test_imc_recent_slice_respects_status_filter() -> None:
    w1 = uuid4()
    imc = [
        {
            "id": "i1",
            "type_key": "t1",
            "display_name": "Done run",
            "status": "completed",
            "updated_at": "2026-01-02T00:00:00+00:00",
            "created_at": "2026-01-01T00:00:00+00:00",
        },
        {
            "id": "i2",
            "type_key": "t2",
            "display_name": "Active run",
            "status": "running",
            "updated_at": "2026-01-03T00:00:00+00:00",
            "created_at": "2026-01-01T00:00:00+00:00",
        },
    ]
    widgets = [
        _widget(
            wid=w1,
            key="imc_recent",
            cfg={"filters": {"status": "running"}, "maxItems": 10},
        ),
    ]
    out = build_widget_list_slices(
        widgets,
        tasks=[],
        alerts=[],
        campaigns=[],
        segments=[],
        researches=[],
        imc_runs=imc,
    )
    assert [r["id"] for r in out[str(w1)]["imc_research_runs"]] == ["i2"]
    assert out[str(w1)]["filtered_total"] == 1


def test_jtbd_stories_slice_respects_category_filter() -> None:
    w1 = uuid4()
    jobs = [
        {
            "id": "j1",
            "project_id": "p",
            "title": "A",
            "category": "functional",
            "priority": "low",
            "is_validated": False,
            "updated_at": "2026-01-02T00:00:00+00:00",
            "created_at": "2026-01-01T00:00:00+00:00",
        },
        {
            "id": "j2",
            "project_id": "p",
            "title": "B",
            "category": "emotional",
            "priority": "high",
            "is_validated": True,
            "updated_at": "2026-01-03T00:00:00+00:00",
            "created_at": "2026-01-01T00:00:00+00:00",
        },
    ]
    widgets = [
        _widget(
            wid=w1,
            key="jtbd_stories",
            cfg={"filters": {"category": "functional"}, "maxItems": 10},
        ),
    ]
    out = build_widget_list_slices(
        widgets,
        tasks=[],
        alerts=[],
        job_stories=jobs,
        value_propositions=[],
    )
    assert [r["id"] for r in out[str(w1)]["job_stories"]] == ["j1"]
    assert out[str(w1)]["filtered_total"] == 1


def test_value_props_slice_respects_status_filter() -> None:
    w1 = uuid4()
    vps = [
        {
            "id": "v1",
            "project_id": "p",
            "headline": "H1",
            "status": "draft",
            "updated_at": "2026-01-02T00:00:00+00:00",
        },
        {
            "id": "v2",
            "project_id": "p",
            "headline": "H2",
            "status": "active",
            "updated_at": "2026-01-03T00:00:00+00:00",
        },
    ]
    widgets = [
        _widget(
            wid=w1,
            key="value_props",
            cfg={"filters": {"status": "active"}, "maxItems": 10},
        ),
    ]
    out = build_widget_list_slices(
        widgets,
        tasks=[],
        alerts=[],
        job_stories=[],
        value_propositions=vps,
    )
    assert [r["id"] for r in out[str(w1)]["value_propositions"]] == ["v2"]
    assert out[str(w1)]["filtered_total"] == 1


def test_competitors_slice_respects_type_filter() -> None:
    w1 = uuid4()
    comps = [
        {
            "id": "c1",
            "project_id": "p",
            "name": "Alpha",
            "competitor_type": "direct",
            "updated_at": "2026-01-02T00:00:00+00:00",
        },
        {
            "id": "c2",
            "project_id": "p",
            "name": "Beta",
            "competitor_type": "indirect",
            "updated_at": "2026-01-03T00:00:00+00:00",
        },
    ]
    widgets = [
        _widget(
            wid=w1,
            key="competitors",
            cfg={"filters": {"competitor_type": "indirect"}, "maxItems": 10},
        ),
    ]
    out = build_widget_list_slices(
        widgets,
        tasks=[],
        alerts=[],
        competitors=comps,
    )
    assert [r["id"] for r in out[str(w1)]["competitors"]] == ["c2"]
    assert out[str(w1)]["filtered_total"] == 1
