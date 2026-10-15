# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP API `api/routers/marketing_cabinet/summary.py`: эндпоинты и контракт — в коде и
#   OpenAPI.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
import structlog

from api.routers.marketing_cabinet.common import (
    get_accessible_project,
    normalize_ai_run,
    normalize_alert,
    normalize_campaign,
    normalize_competitor,
    normalize_content_item,
    normalize_funnel,
    normalize_funnel_stage,
    normalize_job_story,
    normalize_project_summary_row,
    normalize_research,
    normalize_segment,
    normalize_swot_analysis,
    normalize_swot_factor,
    normalize_task,
    normalize_value_proposition,
)
from api.services.imc.imc_service import _preview_text, _result_text_stats
from api.services.marketing_cabinet.dashboard_series_metric_1 import (
    fetch_tasks_completed_daily_series,
)
from api.services.marketing_cabinet.dashboard_series_metric_2 import (
    fetch_alerts_opened_daily_series,
)
from api.services.marketing_cabinet.dashboard_series_metric_3 import (
    fetch_ai_runs_started_daily_series,
)

RECENT_JOB_STORIES_LIMIT = 5
RECENT_VALUE_PROPOSITIONS_LIMIT = 4
RECENT_COMPETITORS_LIMIT = 5
RECENT_RESEARCHES_LIMIT = 5
RECENT_CONTENT_LIMIT = 5
RECENT_SEGMENTS_LIMIT = 4
RECENT_CAMPAIGNS_LIMIT = 4
RECENT_TASKS_LIMIT = 4
RECENT_ALERTS_LIMIT = 4
# Interactive dashboard list tiles may request up to 500 items (widget_config.maxItems).
DASHBOARD_LIST_FETCH_LIMIT = 500
RECENT_AI_RUNS_LIMIT = 4
RECENT_ACTIVITY_LIMIT = 12
RECENT_FUNNELS_LIMIT = 3
RECENT_SWOT_FACTORS_LIMIT = 12

logger = structlog.get_logger("api.routers.marketing_cabinet.summary")

# Weights for `readiness_score` (see documentation/product/marketing/OVERVIEW-SUMMARY-SPEC.md)
READINESS_WEIGHTS: dict[str, float] = {
    "strategy_base": 0.35,
    "operations": 0.20,
    "coverage": 0.20,
    "freshness": 0.08,
    "strategy_integrity": 0.17,
}
READINESS_COMPONENT_ORDER: tuple[str, ...] = (
    "strategy_base",
    "operations",
    "coverage",
    "freshness",
    "strategy_integrity",
)


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _normalize_dt_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None or dt.utcoffset() is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _days_since(dt: datetime | None) -> int | None:
    normalized_dt = _normalize_dt_utc(dt)
    if normalized_dt is None:
        return None
    delta = _now_utc() - normalized_dt
    return max(0, int(delta.total_seconds() // 86400))


def _is_past_due(dt: datetime | None) -> bool:
    normalized_dt = _normalize_dt_utc(dt)
    if normalized_dt is None:
        return False
    return normalized_dt < _now_utc()


def _safe_int(value: object) -> int:
    if value is None:
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):  # fmt: skip
        return 0


def _calc_percentage(covered: int, total: int) -> int:
    if total <= 0:
        return 0
    return max(0, min(100, round((covered / total) * 100)))


def _coverage_status(percentage: int) -> str:
    if percentage >= 80:
        return "strong"
    if percentage >= 50:
        return "warning"
    return "weak"


def _freshness_state(age_days: int | None, *, fresh_days: int, warning_days: int) -> str:
    if age_days is None:
        return "missing"
    if age_days <= fresh_days:
        return "fresh"
    if age_days <= warning_days:
        return "warning"
    return "stale"


async def _fetch_counts_and_stats(conn: asyncpg.Connection, project_id: UUID) -> dict[str, Any]:
    row = await conn.fetchrow(
        """
        SELECT
            (SELECT COUNT(*) FROM job_stories WHERE project_id = $1 AND deleted_at IS NULL) AS jtbd,
            (SELECT COUNT(*) FROM value_propositions WHERE project_id = $1 AND deleted_at IS NULL) AS value_propositions,
            (SELECT COUNT(*) FROM swot_analyses WHERE project_id = $1 AND deleted_at IS NULL) AS swot,
            (SELECT COUNT(*) FROM competitors WHERE project_id = $1 AND deleted_at IS NULL) AS competitors,
            (SELECT COUNT(*) FROM research_projects WHERE project_id = $1 AND deleted_at IS NULL) AS researches,
            (SELECT COUNT(*) FROM unified_content WHERE project_id = $1 AND deleted_at IS NULL) AS content,
            (SELECT COUNT(*) FROM marketing_segments WHERE project_id = $1 AND deleted_at IS NULL) AS segments,
            (SELECT COUNT(*) FROM marketing_campaigns WHERE project_id = $1 AND deleted_at IS NULL) AS campaigns,
            (SELECT COUNT(*) FROM marketing_funnels WHERE project_id = $1 AND deleted_at IS NULL) AS funnels,
            (SELECT COUNT(*) FROM marketing_tasks WHERE project_id = $1 AND deleted_at IS NULL) AS tasks,
            (SELECT COUNT(*) FROM marketing_alerts WHERE project_id = $1 AND deleted_at IS NULL) AS alerts,
            (SELECT COUNT(*) FROM marketing_ai_runs WHERE project_id = $1 AND deleted_at IS NULL) AS ai_runs,
            (
                SELECT COUNT(*)
                FROM marketing_tasks
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND status = 'completed'
            ) AS completed_tasks,
            (
                SELECT COUNT(*)
                FROM marketing_tasks
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND status NOT IN ('completed', 'cancelled')
                  AND due_at IS NOT NULL
                  AND due_at < NOW()
            ) AS overdue_tasks,
            (
                SELECT COUNT(*)
                FROM marketing_alerts
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND status = 'open'
            ) AS open_alerts,
            (
                SELECT COUNT(*)
                FROM marketing_alerts
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND status = 'open'
                  AND severity = 'critical'
            ) AS critical_alerts,
            (SELECT MAX(updated_at) FROM swot_analyses WHERE project_id = $1 AND deleted_at IS NULL) AS latest_swot_at,
            (
                SELECT MAX(updated_at)
                FROM research_projects
                WHERE project_id = $1
                  AND deleted_at IS NULL
            ) AS latest_research_at,
            (SELECT MAX(updated_at) FROM unified_content WHERE project_id = $1 AND deleted_at IS NULL) AS latest_content_at,
            (SELECT MAX(updated_at) FROM marketing_ai_runs WHERE project_id = $1 AND deleted_at IS NULL) AS latest_ai_run_at
        """,
        project_id,
    )
    return dict(row or {})


async def _fetch_coverage_stats(conn: asyncpg.Connection, project_id: UUID) -> dict[str, Any]:
    row = await conn.fetchrow(
        """
        SELECT
            (
                SELECT COUNT(DISTINCT js.id)
                FROM job_stories js
                WHERE js.project_id = $1
                  AND js.deleted_at IS NULL
                  AND EXISTS (
                      SELECT 1
                      FROM value_propositions vp
                      WHERE vp.project_id = $1
                        AND vp.deleted_at IS NULL
                        AND js.id = ANY (vp.addressed_job_ids)
                  )
            ) AS linked_job_story_count,
            (
                SELECT COUNT(*)
                FROM marketing_segments
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND (
                    COALESCE(array_length(linked_job_story_ids, 1), 0) > 0
                    OR COALESCE(array_length(linked_content_ids, 1), 0) > 0
                  )
            ) AS linked_segments_count,
            (
                SELECT COUNT(*)
                FROM marketing_campaigns
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND (
                    COALESCE(array_length(linked_segment_ids, 1), 0) > 0
                    OR COALESCE(array_length(linked_value_prop_ids, 1), 0) > 0
                  )
            ) AS linked_campaigns_count,
            (
                SELECT COUNT(*)
                FROM research_projects
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND result_content_id IS NOT NULL
            ) AS researches_with_output_count,
            (
                SELECT COUNT(*)
                FROM marketing_funnels mf
                WHERE mf.project_id = $1
                  AND mf.deleted_at IS NULL
                  AND EXISTS (
                    SELECT 1
                    FROM marketing_funnel_stages mfs
                    WHERE mfs.funnel_id = mf.id
                      AND mfs.deleted_at IS NULL
                      AND (COALESCE(mfs.visitors, 0) > 0 OR COALESCE(mfs.conversions, 0) > 0)
                  )
            ) AS funnels_with_data_count
        """,
        project_id,
    )
    return dict(row or {})


async def _fetch_strategy_integrity_stats(conn: asyncpg.Connection, project_id: UUID) -> dict[str, Any]:
    row = await conn.fetchrow(
        """
        SELECT
            (
                SELECT COUNT(*)
                FROM value_propositions
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND COALESCE(array_length(addressed_job_ids, 1), 0) = 0
            ) AS value_props_without_jtbd_count,
            (
                SELECT COUNT(*)
                FROM marketing_segments
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND COALESCE(array_length(linked_job_story_ids, 1), 0) = 0
            ) AS segments_without_jtbd_count,
            (
                SELECT COUNT(*)
                FROM marketing_segments
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND COALESCE(array_length(linked_content_ids, 1), 0) = 0
            ) AS segments_without_evidence_count,
            (
                SELECT COUNT(*)
                FROM marketing_segments
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND COALESCE(array_length(linked_job_story_ids, 1), 0) = 0
                  AND COALESCE(array_length(linked_content_ids, 1), 0) = 0
            ) AS segments_without_context_count,
            (
                SELECT COUNT(*)
                FROM marketing_campaigns
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND COALESCE(array_length(linked_segment_ids, 1), 0) = 0
            ) AS campaigns_without_segments_count,
            (
                SELECT COUNT(*)
                FROM marketing_campaigns
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND COALESCE(array_length(linked_value_prop_ids, 1), 0) = 0
            ) AS campaigns_without_value_props_count,
            (
                SELECT COUNT(*)
                FROM marketing_campaigns
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND COALESCE(array_length(linked_segment_ids, 1), 0) = 0
                  AND COALESCE(array_length(linked_value_prop_ids, 1), 0) = 0
            ) AS campaigns_without_strategy_count,
            (
                SELECT COUNT(*)
                FROM marketing_campaigns
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND (
                    (
                        COALESCE(array_length(linked_segment_ids, 1), 0) > 0
                        AND COALESCE(array_length(linked_value_prop_ids, 1), 0) = 0
                    )
                    OR (
                        COALESCE(array_length(linked_segment_ids, 1), 0) = 0
                        AND COALESCE(array_length(linked_value_prop_ids, 1), 0) > 0
                    )
                  )
            ) AS campaigns_partially_linked_count,
            (
                SELECT COUNT(*)
                FROM marketing_campaigns
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND COALESCE(array_length(linked_segment_ids, 1), 0) > 0
                  AND COALESCE(array_length(linked_value_prop_ids, 1), 0) > 0
            ) AS campaigns_fully_linked_count,
            (
                SELECT COUNT(*)
                FROM marketing_funnels mf
                WHERE mf.project_id = $1
                  AND mf.deleted_at IS NULL
                  AND NOT EXISTS (
                    SELECT 1
                    FROM marketing_funnel_stages mfs
                    WHERE mfs.funnel_id = mf.id
                      AND mfs.deleted_at IS NULL
                  )
            ) AS funnels_without_stages_count,
            (
                SELECT COUNT(*)
                FROM marketing_funnels mf
                WHERE mf.project_id = $1
                  AND mf.deleted_at IS NULL
                  AND EXISTS (
                    SELECT 1
                    FROM marketing_funnel_stages mfs
                    WHERE mfs.funnel_id = mf.id
                      AND mfs.deleted_at IS NULL
                  )
                  AND NOT EXISTS (
                    SELECT 1
                    FROM marketing_funnel_stages mfs
                    WHERE mfs.funnel_id = mf.id
                      AND mfs.deleted_at IS NULL
                      AND (
                        COALESCE(mfs.visitors, 0) > 0
                        OR COALESCE(mfs.conversions, 0) > 0
                      )
                  )
            ) AS funnels_without_live_data_count
        """,
        project_id,
    )
    return dict(row or {})


def _build_coverage(
    counts: dict[str, int],
    coverage_stats: dict[str, int],
    *,
    project_id: UUID | None = None,
) -> list[dict[str, Any]]:
    metrics = [
        {
            "key": "jtbd_to_value_props",
            "label": "JTBD, покрытые ценностными предложениями",
            "covered": _safe_int(coverage_stats.get("linked_job_story_count")),
            "total": _safe_int(counts.get("jtbd")),
        },
        {
            "key": "segments_linked_jtbd_or_content",
            "label": "Сегменты со связью по JTBD или привязанным контентом",
            "covered": _safe_int(coverage_stats.get("linked_segments_count")),
            "total": _safe_int(counts.get("segments")),
        },
        {
            "key": "campaigns_linked_to_strategy",
            "label": "Кампании, связанные с сегментами или ценностными предложениями",
            "covered": _safe_int(coverage_stats.get("linked_campaigns_count")),
            "total": _safe_int(counts.get("campaigns")),
        },
        {
            "key": "researches_with_outputs",
            "label": "Исследования с результатом или привязанным артефактом",
            "covered": _safe_int(coverage_stats.get("researches_with_output_count")),
            "total": _safe_int(counts.get("researches")),
        },
        {
            "key": "funnels_with_live_data",
            "label": "Воронки с данными по этапам",
            "covered": _safe_int(coverage_stats.get("funnels_with_data_count")),
            "total": _safe_int(counts.get("funnels")),
        },
        {
            "key": "completed_tasks",
            "label": "Завершённые маркетинговые задачи",
            "covered": _safe_int(counts.get("completed_tasks")),
            "total": _safe_int(counts.get("tasks")),
        },
    ]
    for metric in metrics:
        raw_covered = _safe_int(metric.get("covered"))
        total = _safe_int(metric.get("total"))
        if total >= 0 and raw_covered > total:
            logger.warning(
                "marketing_cabinet_overview_coverage_invariant",
                project_id=str(project_id) if project_id else None,
                metric_key=str(metric.get("key") or ""),
                covered_raw=raw_covered,
                total=total,
            )
            metric["covered"] = total
        else:
            metric["covered"] = raw_covered
        metric["percentage"] = _calc_percentage(
            _safe_int(metric.get("covered")),
            total,
        )
        metric["status"] = _coverage_status(metric["percentage"])
    return metrics


def _build_strategy_integrity(
    counts: dict[str, int],
    coverage: list[dict[str, Any]],
    integrity_stats: dict[str, int],
) -> list[dict[str, Any]]:
    coverage_by_key = {item["key"]: item for item in coverage}
    jtbd_coverage = coverage_by_key.get("jtbd_to_value_props", {})
    metrics = [
        {
            "key": "jtbd_covered_by_value_props",
            "label": "JTBD, закрытые value proposition",
            "covered": _safe_int(jtbd_coverage.get("covered")),
            "total": _safe_int(jtbd_coverage.get("total")),
        },
        {
            "key": "value_props_linked_to_jtbd",
            "label": "Value props, связанные с JTBD",
            "covered": max(
                _safe_int(counts.get("value_propositions"))
                - _safe_int(integrity_stats.get("value_props_without_jtbd_count")),
                0,
            ),
            "total": _safe_int(counts.get("value_propositions")),
        },
        {
            "key": "segments_linked_to_jtbd",
            "label": "Сегменты, связанные с JTBD",
            "covered": max(
                _safe_int(counts.get("segments")) - _safe_int(integrity_stats.get("segments_without_jtbd_count")),
                0,
            ),
            "total": _safe_int(counts.get("segments")),
        },
        {
            "key": "segments_linked_to_evidence",
            "label": "Сегменты, подкреплённые evidence",
            "covered": max(
                _safe_int(counts.get("segments")) - _safe_int(integrity_stats.get("segments_without_evidence_count")),
                0,
            ),
            "total": _safe_int(counts.get("segments")),
        },
        {
            "key": "campaigns_fully_linked",
            "label": "Кампании, где есть и сегмент, и ценность",
            "covered": _safe_int(integrity_stats.get("campaigns_fully_linked_count")),
            "total": _safe_int(counts.get("campaigns")),
        },
        {
            "key": "funnels_with_stages",
            "label": "Воронки, в которых заведены этапы",
            "covered": max(
                _safe_int(counts.get("funnels")) - _safe_int(integrity_stats.get("funnels_without_stages_count")),
                0,
            ),
            "total": _safe_int(counts.get("funnels")),
        },
    ]
    for metric in metrics:
        metric["percentage"] = _calc_percentage(metric["covered"], metric["total"])
        metric["status"] = _coverage_status(metric["percentage"])
    return metrics


def _build_freshness(stats: dict[str, Any]) -> list[dict[str, Any]]:
    swot_age = _days_since(stats.get("latest_swot_at"))
    research_age = _days_since(stats.get("latest_research_at"))
    content_age = _days_since(stats.get("latest_content_at"))
    ai_age = _days_since(stats.get("latest_ai_run_at"))
    return [
        {
            "key": "swot",
            "label": "Последний SWOT",
            "state": _freshness_state(swot_age, fresh_days=14, warning_days=45),
            "age_days": swot_age,
            "detail": "Стратегический снимок должен быть актуальным, чтобы обзор был опорой для решений.",
        },
        {
            "key": "research",
            "label": "Исследования",
            "state": _freshness_state(research_age, fresh_days=14, warning_days=30),
            "age_days": research_age,
            "detail": "Учитывается последнее обновление карточки исследования, в том числе черновики и промежуточная работа.",
        },
        {
            "key": "evidence",
            "label": "База evidence",
            "state": _freshness_state(content_age, fresh_days=21, warning_days=45),
            "age_days": content_age,
            "detail": "Unified content должен регулярно подпитывать кабинет актуальными материалами.",
        },
        {
            "key": "ai_activity",
            "label": "AI-активность",
            "state": _freshness_state(ai_age, fresh_days=7, warning_days=21),
            "age_days": ai_age,
            "detail": "AI-инструменты должны оставлять в кабинете проверяемый след.",
        },
    ]


def _average_percentage_meta(items: list[dict[str, Any]]) -> tuple[int, int, int]:
    """Returns (average percent, rows with total>0 used in mean, total row slots in list)."""
    slot_count = len(items)
    eligible = [item for item in items if _safe_int(item.get("total")) > 0]
    rows_used = len(eligible)
    if not eligible:
        return 0, rows_used, slot_count
    values = [int(item.get("percentage") or 0) for item in eligible]
    return round(sum(values) / len(values)), rows_used, slot_count


def _average_percentage(items: list[dict[str, Any]]) -> int:
    avg, _, _ = _average_percentage_meta(items)
    return avg


def _average_freshness(items: list[dict[str, Any]]) -> int:
    if not items:
        return 0
    score_map = {"fresh": 100, "warning": 50, "stale": 0, "missing": 0}
    return round(sum(score_map.get(str(item.get("state")), 0) for item in items) / len(items))


def _issue_severity_from_ratio(affected: int, total: int) -> str:
    if total <= 0:
        return "medium"
    ratio = affected / total
    if ratio >= 0.55:
        return "critical"
    if ratio >= 0.3:
        return "high"
    return "medium"


def _merge_insights(*insight_groups: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    severity_order = {"critical": 0, "high": 1, "medium": 2, "positive": 3}
    merged: list[dict[str, Any]] = []
    seen_codes: set[str] = set()
    for group in insight_groups:
        for item in group:
            code = str(item.get("code") or "")
            if code and code in seen_codes:
                continue
            if code:
                seen_codes.add(code)
            merged.append(item)
    merged.sort(key=lambda item: severity_order.get(str(item.get("severity")), 99))
    return merged[:limit]


def _collect_issue_codes(*insight_groups: list[dict[str, Any]]) -> list[str]:
    issue_codes: list[str] = []
    seen_codes: set[str] = set()
    for group in insight_groups:
        for item in group:
            code = str(item.get("code") or "").strip()
            if not code or code in seen_codes:
                continue
            seen_codes.add(code)
            issue_codes.append(code)
    return issue_codes


def _remediation_state(*, task_count: int, alert_count: int) -> str:
    if task_count > 0 and alert_count > 0:
        return "task_and_alert"
    if task_count > 0:
        return "task"
    if alert_count > 0:
        return "alert"
    return "none"


def _build_strategy_integrity_issues(
    counts: dict[str, int],
    integrity_stats: dict[str, int],
) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []

    value_props_without_jtbd = _safe_int(integrity_stats.get("value_props_without_jtbd_count"))
    if value_props_without_jtbd > 0:
        issues.append(
            {
                "code": "orphan_value_props",
                "severity": _issue_severity_from_ratio(
                    value_props_without_jtbd, _safe_int(counts.get("value_propositions"))
                ),
                "title": "Часть value proposition не связана с JTBD",
                "description": (
                    f"{value_props_without_jtbd} ценностных предложений не привязаны к job stories, "
                    "из-за чего сегменты и кампании теряют опору на реальную задачу клиента."
                ),
                "target_view": "value",
                "metric_value": value_props_without_jtbd,
            }
        )

    segments_without_context = _safe_int(integrity_stats.get("segments_without_context_count"))
    if segments_without_context > 0:
        issues.append(
            {
                "code": "segments_without_context",
                "severity": _issue_severity_from_ratio(segments_without_context, _safe_int(counts.get("segments"))),
                "title": "Есть сегменты без JTBD и evidence",
                "description": (
                    f"{segments_without_context} сегментов не привязаны ни к задачам клиента, "
                    "ни к доказательной базе, поэтому они висят в кабинете как изолированные карточки."
                ),
                "target_view": "segments",
                "metric_value": segments_without_context,
            }
        )

    segments_missing_only_jtbd = max(
        _safe_int(integrity_stats.get("segments_without_jtbd_count")) - segments_without_context,
        0,
    )
    if segments_missing_only_jtbd > 0:
        issues.append(
            {
                "code": "segments_without_jtbd_link",
                "severity": _issue_severity_from_ratio(segments_missing_only_jtbd, _safe_int(counts.get("segments"))),
                "title": "Часть сегментов не привязана к JTBD",
                "description": (
                    f"{segments_missing_only_jtbd} сегментов опираются на материалы, но не связаны "
                    "с конкретными job stories, поэтому приоритизация может искажаться."
                ),
                "target_view": "segments",
                "metric_value": segments_missing_only_jtbd,
            }
        )

    segments_missing_only_evidence = max(
        _safe_int(integrity_stats.get("segments_without_evidence_count")) - segments_without_context,
        0,
    )
    if segments_missing_only_evidence > 0:
        issues.append(
            {
                "code": "segments_without_evidence_link",
                "severity": _issue_severity_from_ratio(
                    segments_missing_only_evidence, _safe_int(counts.get("segments"))
                ),
                "title": "Сегменты не подкреплены evidence",
                "description": (
                    f"{segments_missing_only_evidence} сегментов связаны с JTBD, но ещё не подкреплены "
                    "контентом или результатами исследований."
                ),
                "target_view": "segments",
                "metric_value": segments_missing_only_evidence,
            }
        )

    campaigns_without_strategy = _safe_int(integrity_stats.get("campaigns_without_strategy_count"))
    if campaigns_without_strategy > 0:
        issues.append(
            {
                "code": "campaigns_without_strategy_context",
                "severity": _issue_severity_from_ratio(campaigns_without_strategy, _safe_int(counts.get("campaigns"))),
                "title": "Есть кампании без сегмента и ценности",
                "description": (
                    f"{campaigns_without_strategy} кампаний не связаны ни с сегментами, ни с value proposition, "
                    "поэтому execution отрывается от стратегии."
                ),
                "target_view": "campaigns",
                "metric_value": campaigns_without_strategy,
            }
        )

    campaigns_partially_linked = _safe_int(integrity_stats.get("campaigns_partially_linked_count"))
    if campaigns_partially_linked > 0:
        issues.append(
            {
                "code": "campaigns_partially_linked",
                "severity": _issue_severity_from_ratio(campaigns_partially_linked, _safe_int(counts.get("campaigns"))),
                "title": "Часть кампаний связана со стратегией только наполовину",
                "description": (
                    f"{campaigns_partially_linked} кампаний имеют только сегмент или только ценностное предложение. "
                    "Лучше замкнуть обе стороны, чтобы кабинет показывал полную причинно-следственную цепочку."
                ),
                "target_view": "campaigns",
                "metric_value": campaigns_partially_linked,
            }
        )

    funnels_without_stages = _safe_int(integrity_stats.get("funnels_without_stages_count"))
    if funnels_without_stages > 0:
        issues.append(
            {
                "code": "funnels_without_stages",
                "severity": _issue_severity_from_ratio(funnels_without_stages, _safe_int(counts.get("funnels"))),
                "title": "Есть воронки без этапов",
                "description": (
                    f"{funnels_without_stages} воронок заведены без stage-структуры, поэтому конверсионная цепочка "
                    "обрывается ещё до измерения."
                ),
                "target_view": "funnel",
                "metric_value": funnels_without_stages,
            }
        )

    funnels_without_live_data = _safe_int(integrity_stats.get("funnels_without_live_data_count"))
    if funnels_without_live_data > 0:
        issues.append(
            {
                "code": "funnels_without_live_data",
                "severity": _issue_severity_from_ratio(funnels_without_live_data, _safe_int(counts.get("funnels"))),
                "title": "Воронки есть, но без чисел по этапам",
                "description": (
                    f"{funnels_without_live_data} воронок уже структурированы, но ещё не заполнены visitors/conversions, "
                    "поэтому performance-контур не замыкается."
                ),
                "target_view": "funnel",
                "metric_value": funnels_without_live_data,
            }
        )

    return _merge_insights(issues, limit=6)


async def _fetch_issue_remediation(
    conn: asyncpg.Connection,
    project_id: UUID,
    issue_codes: list[str],
) -> list[dict[str, Any]]:
    if not issue_codes:
        return []

    task_rows = await conn.fetch(
        """
        SELECT
            id,
            title,
            status,
            owner_name,
            due_at,
            metadata->'remediation'->>'issue_code' AS issue_code,
            updated_at,
            created_at
        FROM marketing_tasks
        WHERE project_id = $1
          AND deleted_at IS NULL
          AND status NOT IN ('completed', 'cancelled')
          AND metadata->'remediation'->>'issue_code' = ANY($2::text[])
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        """,
        project_id,
        issue_codes,
    )
    alert_rows = await conn.fetch(
        """
        SELECT
            id,
            title,
            status,
            owner_name,
            metadata->'remediation'->>'issue_code' AS issue_code,
            updated_at,
            created_at
        FROM marketing_alerts
        WHERE project_id = $1
          AND deleted_at IS NULL
          AND status != 'resolved'
          AND metadata->'remediation'->>'issue_code' = ANY($2::text[])
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        """,
        project_id,
        issue_codes,
    )

    by_issue: dict[str, dict[str, Any]] = {
        code: {
            "issue_code": code,
            "state": "none",
            "task_id": None,
            "task_title": None,
            "task_status": None,
            "task_owner_name": None,
            "task_due_at": None,
            "task_is_overdue": False,
            "task_needs_owner": False,
            "task_count": 0,
            "alert_id": None,
            "alert_title": None,
            "alert_status": None,
            "alert_owner_name": None,
            "alert_count": 0,
        }
        for code in issue_codes
    }

    for row in task_rows:
        issue_code = str(row.get("issue_code") or "").strip()
        if not issue_code or issue_code not in by_issue:
            continue
        item = by_issue[issue_code]
        item["task_count"] = int(item.get("task_count") or 0) + 1
        if item.get("task_id") is None:
            item["task_id"] = str(row["id"])
            item["task_title"] = row.get("title")
            item["task_status"] = row.get("status")
            item["task_owner_name"] = row.get("owner_name")
            item["task_due_at"] = row.get("due_at").isoformat() if row.get("due_at") else None
            item["task_is_overdue"] = _is_past_due(row.get("due_at"))
            item["task_needs_owner"] = not bool(str(row.get("owner_name") or "").strip())

    for row in alert_rows:
        issue_code = str(row.get("issue_code") or "").strip()
        if not issue_code or issue_code not in by_issue:
            continue
        item = by_issue[issue_code]
        item["alert_count"] = int(item.get("alert_count") or 0) + 1
        if item.get("alert_id") is None:
            item["alert_id"] = str(row["id"])
            item["alert_title"] = row.get("title")
            item["alert_status"] = row.get("status")
            item["alert_owner_name"] = row.get("owner_name")

    result: list[dict[str, Any]] = []
    for code in issue_codes:
        item = by_issue[code]
        item["state"] = _remediation_state(
            task_count=int(item.get("task_count") or 0),
            alert_count=int(item.get("alert_count") or 0),
        )
        result.append(item)
    return result


def _build_readiness_meta(
    *,
    breakdown: dict[str, int],
    readiness_score: int,
    coverage_rows_used: int,
    coverage_slots_total: int,
) -> dict[str, Any]:
    """Weights, approximate point contributions, and coverage-average transparency."""
    weights = dict(READINESS_WEIGHTS)
    keys_order = READINESS_COMPONENT_ORDER
    vals = [breakdown[k] for k in keys_order]
    points: dict[str, int] = {}
    acc = 0
    for i, k in enumerate(keys_order[:-1]):
        p = round(vals[i] * weights[k])
        points[k] = p
        acc += p
    last_k = keys_order[-1]
    points[last_k] = readiness_score - acc
    drift = readiness_score - sum(points.values())
    if drift != 0:
        points[last_k] = points[last_k] + drift
    return {
        "weights": weights,
        "contribution_points": points,
        "coverage_average_rows_used": coverage_rows_used,
        "coverage_average_slots_total": coverage_slots_total,
    }


def _compute_readiness_breakdown(
    counts: dict[str, int],
    coverage: list[dict[str, Any]],
    freshness: list[dict[str, Any]],
    *,
    strategy_integrity_score: int = 0,
) -> tuple[int, dict[str, int], dict[str, Any]]:
    """Возвращает readiness_score (0–100), компоненты 0–100 и метаданные формулы для UI."""
    strategy_present = [
        _safe_int(counts.get("jtbd")) > 0,
        _safe_int(counts.get("value_propositions")) > 0,
        _safe_int(counts.get("swot")) > 0,
        _safe_int(counts.get("competitors")) > 0,
        _safe_int(counts.get("researches")) > 0,
        _safe_int(counts.get("content")) > 0,
    ]
    ops_present = [
        _safe_int(counts.get("segments")) > 0,
        _safe_int(counts.get("campaigns")) > 0,
        _safe_int(counts.get("funnels")) > 0,
        _safe_int(counts.get("tasks")) > 0,
        _safe_int(counts.get("ai_runs")) > 0,
    ]
    strategy_score = round(sum(1 for flag in strategy_present if flag) / len(strategy_present) * 100)
    ops_score = round(sum(1 for flag in ops_present if flag) / len(ops_present) * 100)
    coverage_score, cov_rows_used, cov_slots = _average_percentage_meta(coverage)
    freshness_score = _average_freshness(freshness)
    integrity_factor = max(0, min(100, _safe_int(strategy_integrity_score)))
    breakdown = {
        "strategy_base": strategy_score,
        "operations": ops_score,
        "coverage": coverage_score,
        "freshness": freshness_score,
        "strategy_integrity": integrity_factor,
    }
    composite = max(
        0,
        min(
            100,
            round(
                strategy_score * READINESS_WEIGHTS["strategy_base"]
                + ops_score * READINESS_WEIGHTS["operations"]
                + coverage_score * READINESS_WEIGHTS["coverage"]
                + freshness_score * READINESS_WEIGHTS["freshness"]
                + integrity_factor * READINESS_WEIGHTS["strategy_integrity"]
            ),
        ),
    )
    readiness_meta = _build_readiness_meta(
        breakdown=breakdown,
        readiness_score=composite,
        coverage_rows_used=cov_rows_used,
        coverage_slots_total=cov_slots,
    )
    return composite, breakdown, readiness_meta


def _build_gaps(
    counts: dict[str, int],
    coverage: list[dict[str, Any]],
    freshness: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    by_key = {item["key"]: item for item in coverage}
    fresh_by_key = {item["key"]: item for item in freshness}
    gaps: list[dict[str, Any]] = []

    if _safe_int(counts.get("jtbd")) == 0:
        gaps.append(
            {
                "code": "missing_jtbd",
                "severity": "critical",
                "title": "Пока нет JTBD-основы",
                "description": "В проекте нет JTBD-входа, поэтому value proposition и кампании опираются не на реальные задачи клиента.",
                "target_view": "jtbd",
            }
        )

    jtbd_coverage = by_key.get("jtbd_to_value_props")
    if jtbd_coverage and jtbd_coverage["total"] > 0 and jtbd_coverage["percentage"] < 60:
        gaps.append(
            {
                "code": "weak_jtbd_coverage",
                "severity": "high",
                "title": "Покрытие JTBD слишком слабое",
                "description": "Слишком много job stories ещё не отражены в ценностных предложениях.",
                "target_view": "value",
                "metric_value": jtbd_coverage["percentage"],
            }
        )

    if _safe_int(counts.get("segments")) == 0:
        gaps.append(
            {
                "code": "missing_segments",
                "severity": "high",
                "title": "Не определены сегменты аудитории",
                "description": "В кабинете нет слоя ICP/сегментов, из-за чего обзор хуже расставляет приоритеты.",
                "target_view": "segments",
            }
        )

    if _safe_int(counts.get("campaigns")) == 0:
        gaps.append(
            {
                "code": "missing_campaigns",
                "severity": "medium",
                "title": "Нет кампаний, связанных со стратегией",
                "description": "В проекте пока нет слоя кампаний, который связывает сегменты и ценностные предложения с исполнением.",
                "target_view": "campaigns",
            }
        )

    if _safe_int(counts.get("tasks")) == 0:
        gaps.append(
            {
                "code": "missing_tasks",
                "severity": "medium",
                "title": "Не заведены исполнительские задачи",
                "description": "В кабинете уже есть стратегические артефакты, но нет операционного backlog для следующих шагов.",
                "target_view": "tasks",
            }
        )

    research_freshness = fresh_by_key.get("research")
    if research_freshness and research_freshness["state"] in {"missing", "stale"}:
        gaps.append(
            {
                "code": "stale_research",
                "severity": "high",
                "title": "Исследовательская база устарела",
                "description": "Последние решения не поддержаны свежими результатами рыночных или клиентских исследований.",
                "target_view": "evidence",
                "metric_value": research_freshness.get("age_days"),
            }
        )

    swot_freshness = fresh_by_key.get("swot")
    if swot_freshness and swot_freshness["state"] in {"missing", "stale"}:
        gaps.append(
            {
                "code": "stale_swot",
                "severity": "medium",
                "title": "Стратегическую картину нужно обновить",
                "description": "Последний SWOT отсутствует или слишком старый, чтобы быть надёжной стратегической базой.",
                "target_view": "analysis",
                "metric_value": swot_freshness.get("age_days"),
            }
        )

    if _safe_int(counts.get("critical_alerts")) > 0:
        gaps.append(
            {
                "code": "critical_alerts_open",
                "severity": "critical",
                "title": "Есть открытые критичные алерты",
                "description": "В обзоре есть нерешённые критичные проблемы, которыми нужно заняться раньше нового объёма работ.",
                "target_view": "alerts",
                "metric_value": _safe_int(counts.get("critical_alerts")),
            }
        )

    if _safe_int(counts.get("overdue_tasks")) > 0:
        gaps.append(
            {
                "code": "overdue_tasks",
                "severity": "medium",
                "title": "Есть просроченные задачи",
                "description": "Исполнительские обязательства уже есть, но они сдвигаются и требуют возврата в фокус обзора.",
                "target_view": "tasks",
                "metric_value": _safe_int(counts.get("overdue_tasks")),
            }
        )

    return gaps[:8]


def _build_highlights(
    counts: dict[str, int],
    coverage: list[dict[str, Any]],
    freshness: list[dict[str, Any]],
    *,
    strategy_integrity_score: int = 0,
) -> list[dict[str, Any]]:
    by_key = {item["key"]: item for item in coverage}
    fresh_by_key = {item["key"]: item for item in freshness}
    highlights: list[dict[str, Any]] = []

    if _safe_int(counts.get("jtbd")) > 0 and _safe_int(counts.get("value_propositions")) > 0:
        highlights.append(
            {
                "code": "strategy_foundation",
                "severity": "positive",
                "title": "Стратегическая база уже собрана",
                "description": f"В кабинете уже есть {_safe_int(counts.get('jtbd'))} JTBD и {_safe_int(counts.get('value_propositions'))} ценностных предложений.",
                "target_view": "overview",
            }
        )

    jtbd_coverage = by_key.get("jtbd_to_value_props")
    if jtbd_coverage and jtbd_coverage["percentage"] >= 80:
        highlights.append(
            {
                "code": "strong_jtbd_coverage",
                "severity": "positive",
                "title": "Покрытие JTBD на хорошем уровне",
                "description": "Большая часть job stories уже связана с ценностными предложениями.",
                "target_view": "value",
                "metric_value": jtbd_coverage["percentage"],
            }
        )

    campaign_coverage = by_key.get("campaigns_linked_to_strategy")
    if campaign_coverage and campaign_coverage["total"] > 0 and campaign_coverage["percentage"] >= 70:
        highlights.append(
            {
                "code": "linked_campaigns",
                "severity": "positive",
                "title": "Кампании привязаны к стратегии",
                "description": "Исполнение кампаний явно связано с сегментами и ценностными предложениями.",
                "target_view": "campaigns",
                "metric_value": campaign_coverage["percentage"],
            }
        )

    if (
        strategy_integrity_score >= 80
        and _safe_int(counts.get("segments")) > 0
        and _safe_int(counts.get("campaigns")) > 0
    ):
        highlights.append(
            {
                "code": "strategy_chain_connected",
                "severity": "positive",
                "title": "Связность стратегии выглядит собранной",
                "description": "JTBD, ценность, сегменты, кампании и воронка уже связаны между собой без заметных разрывов.",
                "target_view": "overview",
                "metric_value": strategy_integrity_score,
            }
        )

    research_freshness = fresh_by_key.get("research")
    if research_freshness and research_freshness["state"] == "fresh":
        highlights.append(
            {
                "code": "fresh_research",
                "severity": "positive",
                "title": "Исследовательская база свежая",
                "description": "Есть свежие результаты исследований, на которые можно опирать следующие маркетинговые решения.",
                "target_view": "evidence",
            }
        )

    if _safe_int(counts.get("ai_runs")) > 0:
        highlights.append(
            {
                "code": "ai_trace_exists",
                "severity": "positive",
                "title": "AI-активность теперь отслеживается",
                "description": "В кабинете уже есть записанные AI-запуски, которые можно выводить в обзор.",
                "target_view": "ai_studio",
                "metric_value": _safe_int(counts.get("ai_runs")),
            }
        )

    return highlights[:6]


def _build_recommended_actions(gaps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []
    for gap in gaps[:5]:
        actions.append(
            {
                "id": gap["code"],
                "title": gap["title"],
                "description": gap["description"],
                "target_view": gap.get("target_view"),
                "tone": "danger" if gap.get("severity") == "critical" else "accent",
            }
        )
    return actions


async def _fetch_latest_swot(conn: asyncpg.Connection, project_id: UUID) -> dict[str, Any] | None:
    swot_row = await conn.fetchrow(
        """
        SELECT *
        FROM swot_analyses
        WHERE project_id = $1
          AND deleted_at IS NULL
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
        """,
        project_id,
    )
    if swot_row is None:
        return None
    factors = await conn.fetch(
        """
        SELECT *
        FROM swot_factors
        WHERE swot_analysis_id = $1
          AND deleted_at IS NULL
        ORDER BY priority_score DESC, created_at ASC
        LIMIT $2
        """,
        swot_row["id"],
        RECENT_SWOT_FACTORS_LIMIT,
    )
    return normalize_swot_analysis(swot_row, [normalize_swot_factor(row) for row in factors])


async def _fetch_recent_job_stories(
    conn: asyncpg.Connection,
    project_id: UUID,
    *,
    limit: int = RECENT_JOB_STORIES_LIMIT,
) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), DASHBOARD_LIST_FETCH_LIMIT))
    rows = await conn.fetch(
        """
        SELECT
            id,
            project_id,
            company_id,
            situation,
            motivation,
            outcome,
            full_story,
            category::text AS category,
            priority::text AS priority,
            tags,
            source::text AS source,
            importance_score,
            quality_score,
            sentiment_score,
            is_validated,
            metadata,
            processing_data,
            created_at,
            updated_at,
            COALESCE((processing_data->>'satisfaction_score')::numeric, NULL) AS satisfaction_score,
            COALESCE(metadata->>'title', situation) AS title
        FROM job_stories
        WHERE project_id = $1
          AND deleted_at IS NULL
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT $2
        """,
        project_id,
        lim,
    )
    return [normalize_job_story(row) for row in rows]


async def _fetch_recent_value_props(
    conn: asyncpg.Connection,
    project_id: UUID,
    *,
    limit: int = RECENT_VALUE_PROPOSITIONS_LIMIT,
) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), DASHBOARD_LIST_FETCH_LIMIT))
    rows = await conn.fetch(
        """
        SELECT *
        FROM value_propositions
        WHERE project_id = $1
          AND deleted_at IS NULL
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT $2
        """,
        project_id,
        lim,
    )
    return [normalize_value_proposition(row) for row in rows]


async def _fetch_recent_competitors(
    conn: asyncpg.Connection,
    project_id: UUID,
    *,
    limit: int = RECENT_COMPETITORS_LIMIT,
) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), DASHBOARD_LIST_FETCH_LIMIT))
    rows = await conn.fetch(
        """
        SELECT *
        FROM competitors
        WHERE project_id = $1
          AND deleted_at IS NULL
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT $2
        """,
        project_id,
        lim,
    )
    return [normalize_competitor(row) for row in rows]


async def _fetch_recent_researches(
    conn: asyncpg.Connection,
    project_id: UUID,
    *,
    limit: int = RECENT_RESEARCHES_LIMIT,
) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), DASHBOARD_LIST_FETCH_LIMIT))
    rows = await conn.fetch(
        """
        SELECT *
        FROM research_projects
        WHERE project_id = $1
          AND deleted_at IS NULL
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT $2
        """,
        project_id,
        lim,
    )
    return [normalize_research(row) for row in rows]


async def _fetch_recent_content(conn: asyncpg.Connection, project_id: UUID) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        """
        SELECT
            id,
            name,
            content_type,
            description,
            processing_status,
            project_id,
            company_id,
            created_at,
            updated_at,
            metadata,
            extracted_text,
            file_size,
            mime_type
        FROM unified_content
        WHERE project_id = $1
          AND deleted_at IS NULL
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT $2
        """,
        project_id,
        RECENT_CONTENT_LIMIT,
    )
    return [normalize_content_item(row) for row in rows]


async def _fetch_recent_segments(
    conn: asyncpg.Connection,
    project_id: UUID,
    *,
    limit: int = RECENT_SEGMENTS_LIMIT,
) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), DASHBOARD_LIST_FETCH_LIMIT))
    rows = await conn.fetch(
        """
        SELECT *
        FROM marketing_segments
        WHERE project_id = $1
          AND deleted_at IS NULL
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT $2
        """,
        project_id,
        lim,
    )
    return [normalize_segment(row) for row in rows]


async def _fetch_recent_campaigns(
    conn: asyncpg.Connection,
    project_id: UUID,
    *,
    limit: int = RECENT_CAMPAIGNS_LIMIT,
) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), DASHBOARD_LIST_FETCH_LIMIT))
    rows = await conn.fetch(
        """
        SELECT *
        FROM marketing_campaigns
        WHERE project_id = $1
          AND deleted_at IS NULL
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT $2
        """,
        project_id,
        lim,
    )
    return [normalize_campaign(row) for row in rows]


async def _fetch_recent_tasks(
    conn: asyncpg.Connection,
    project_id: UUID,
    *,
    limit: int = RECENT_TASKS_LIMIT,
) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), DASHBOARD_LIST_FETCH_LIMIT))
    rows = await conn.fetch(
        """
        SELECT *
        FROM marketing_tasks
        WHERE project_id = $1
          AND deleted_at IS NULL
        ORDER BY
            CASE WHEN status = 'completed' THEN 1 ELSE 0 END,
            due_at ASC NULLS LAST,
            updated_at DESC NULLS LAST,
            created_at DESC
        LIMIT $2
        """,
        project_id,
        lim,
    )
    return [normalize_task(row) for row in rows]


async def _fetch_recent_alerts(
    conn: asyncpg.Connection,
    project_id: UUID,
    *,
    limit: int = RECENT_ALERTS_LIMIT,
) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), DASHBOARD_LIST_FETCH_LIMIT))
    rows = await conn.fetch(
        """
        SELECT *
        FROM marketing_alerts
        WHERE project_id = $1
          AND deleted_at IS NULL
        ORDER BY
            CASE severity
                WHEN 'critical' THEN 0
                WHEN 'high' THEN 1
                WHEN 'medium' THEN 2
                ELSE 3
            END,
            updated_at DESC NULLS LAST,
            created_at DESC
        LIMIT $2
        """,
        project_id,
        lim,
    )
    return [normalize_alert(row) for row in rows]


def _imc_format_started_by_label(
    full_name: str | None,
    username: str | None,
    email: str | None,
) -> str | None:
    fn = (full_name or "").strip()
    if fn:
        return fn
    un = (username or "").strip()
    if un:
        return un
    em = (email or "").strip()
    return em or None


def _normalize_imc_run_dashboard_row(r: asyncpg.Record) -> dict[str, Any]:
    duration: float | None = None
    if r["started_at"] and r["completed_at"]:
        duration = (r["completed_at"] - r["started_at"]).total_seconds()
    rc, rl = _result_text_stats(r["result_text"])
    started_by = _imc_format_started_by_label(r["full_name"], r["username"], r["email"])
    ugs_raw = r["ugs_request_id"]
    ugs_id = str(ugs_raw) if ugs_raw else ""
    wk = r["workflow_key"]
    display_name = str(r["display_name"] or r["type_key"] or "")
    return {
        "id": str(r["id"]),
        "type_key": str(r["type_key"] or ""),
        "display_name": display_name,
        "status": str(r["status"] or ""),
        "company_id": str(r["company_id"]) if r["company_id"] else "",
        "project_id": str(r["project_id"]) if r["project_id"] else "",
        "created_at": r["created_at"].isoformat() if r["created_at"] else "",
        "started_at": r["started_at"].isoformat() if r["started_at"] else None,
        "completed_at": r["completed_at"].isoformat() if r["completed_at"] else None,
        "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
        "duration_seconds": duration,
        "result_preview": _preview_text(r["result_text"]),
        "result_char_count": rc,
        "result_line_count": rl,
        "parsed_data": r["parsed_data"] if isinstance(r["parsed_data"], dict) else None,
        "ugs_request_id": ugs_id,
        "workflow_id": str(wk) if wk else None,
        "started_by_user_id": str(r["user_id"]) if r["user_id"] else None,
        "started_by_label": started_by,
    }


async def _fetch_recent_imc_runs_for_dashboard(
    conn: asyncpg.Connection,
    project_id: UUID,
    *,
    limit: int = DASHBOARD_LIST_FETCH_LIMIT,
) -> list[dict[str, Any]]:
    lim = max(1, min(int(limit), DASHBOARD_LIST_FETCH_LIMIT))
    rows = await conn.fetch(
        """
        SELECT
            r.id,
            r.user_id,
            r.company_id,
            r.project_id,
            r.type_key,
            r.workflow_key,
            r.ugs_request_id,
            r.status,
            r.result_text,
            r.parsed_data,
            r.display_name,
            r.created_at,
            r.updated_at,
            r.started_at,
            r.completed_at,
            u.full_name,
            u.username,
            u.email
        FROM imc_research_runs r
        LEFT JOIN users u ON u.id = r.user_id
        WHERE r.project_id = $1
        ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC NULLS LAST
        LIMIT $2
        """,
        project_id,
        lim,
    )
    return [_normalize_imc_run_dashboard_row(row) for row in rows]


async def _fetch_recent_ai_runs(conn: asyncpg.Connection, project_id: UUID) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        """
        SELECT *
        FROM marketing_ai_runs
        WHERE project_id = $1
          AND deleted_at IS NULL
        ORDER BY started_at DESC NULLS LAST, created_at DESC
        LIMIT $2
        """,
        project_id,
        RECENT_AI_RUNS_LIMIT,
    )
    return [normalize_ai_run(row) for row in rows]


async def _fetch_recent_funnels(conn: asyncpg.Connection, project_id: UUID) -> list[dict[str, Any]]:
    funnel_rows = await conn.fetch(
        """
        SELECT *
        FROM marketing_funnels
        WHERE project_id = $1
          AND deleted_at IS NULL
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT $2
        """,
        project_id,
        RECENT_FUNNELS_LIMIT,
    )
    if not funnel_rows:
        return []

    funnel_ids = [row["id"] for row in funnel_rows]
    stage_rows = await conn.fetch(
        """
        SELECT *
        FROM marketing_funnel_stages
        WHERE funnel_id = ANY($1::uuid[])
          AND deleted_at IS NULL
        ORDER BY stage_order ASC, created_at ASC
        """,
        funnel_ids,
    )
    stages_by_funnel: dict[UUID, list[dict[str, Any]]] = {}
    for row in stage_rows:
        stages_by_funnel.setdefault(row["funnel_id"], []).append(normalize_funnel_stage(row))
    return [normalize_funnel(row, stages_by_funnel.get(row["id"], [])) for row in funnel_rows]


async def _fetch_activity_feed(conn: asyncpg.Connection, project_id: UUID) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        """
        SELECT *
        FROM (
            SELECT
                id::text AS id,
                'jtbd'::text AS kind,
                COALESCE(metadata->>'title', situation) AS title,
                LEFT(full_story, 240) AS description,
                'jtbd'::text AS target_view,
                updated_at AS occurred_at
            FROM job_stories
            WHERE project_id = $1
              AND deleted_at IS NULL

            UNION ALL

            SELECT
                id::text AS id,
                'value_proposition'::text AS kind,
                COALESCE(headline, value_statement, 'Ценностное предложение') AS title,
                LEFT(COALESCE(value_statement, ''), 720) AS description,
                'value'::text AS target_view,
                updated_at AS occurred_at
            FROM value_propositions
            WHERE project_id = $1
              AND deleted_at IS NULL

            UNION ALL

            SELECT
                id::text AS id,
                'research'::text AS kind,
                COALESCE(title, 'Исследование') AS title,
                LEFT(COALESCE(result_summary, research_query, description, ''), 720) AS description,
                'evidence'::text AS target_view,
                updated_at AS occurred_at
            FROM research_projects
            WHERE project_id = $1
              AND deleted_at IS NULL

            UNION ALL

            SELECT
                id::text AS id,
                'content'::text AS kind,
                COALESCE(name, 'Материал') AS title,
                COALESCE(description, LEFT(extracted_text, 240)) AS description,
                'evidence'::text AS target_view,
                updated_at AS occurred_at
            FROM unified_content
            WHERE project_id = $1
              AND deleted_at IS NULL

            UNION ALL

            SELECT
                id::text AS id,
                'segment'::text AS kind,
                COALESCE(name, 'Сегмент') AS title,
                description AS description,
                'segments'::text AS target_view,
                updated_at AS occurred_at
            FROM marketing_segments
            WHERE project_id = $1
              AND deleted_at IS NULL

            UNION ALL

            SELECT
                id::text AS id,
                'campaign'::text AS kind,
                COALESCE(name, 'Кампания') AS title,
                COALESCE(objective, hypothesis) AS description,
                'campaigns'::text AS target_view,
                updated_at AS occurred_at
            FROM marketing_campaigns
            WHERE project_id = $1
              AND deleted_at IS NULL

            UNION ALL

            SELECT
                id::text AS id,
                'task'::text AS kind,
                COALESCE(title, 'Задача') AS title,
                description AS description,
                'tasks'::text AS target_view,
                updated_at AS occurred_at
            FROM marketing_tasks
            WHERE project_id = $1
              AND deleted_at IS NULL

            UNION ALL

            SELECT
                id::text AS id,
                'alert'::text AS kind,
                COALESCE(title, 'Алерт') AS title,
                description AS description,
                'alerts'::text AS target_view,
                updated_at AS occurred_at
            FROM marketing_alerts
            WHERE project_id = $1
              AND deleted_at IS NULL

            UNION ALL

            SELECT
                id::text AS id,
                'ai_run'::text AS kind,
                COALESCE(tool_key, 'AI-запуск') AS title,
                COALESCE(result_excerpt, prompt_excerpt) AS description,
                'ai_studio'::text AS target_view,
                started_at AS occurred_at
            FROM marketing_ai_runs
            WHERE project_id = $1
              AND deleted_at IS NULL
        ) activity_items
        ORDER BY occurred_at DESC NULLS LAST
        LIMIT $2
        """,
        project_id,
        RECENT_ACTIVITY_LIMIT,
    )
    return [
        {
            "id": str(row["id"]),
            "kind": row.get("kind"),
            "title": row.get("title") or "Активность",
            "description": row.get("description"),
            "target_view": row.get("target_view"),
            "occurred_at": row.get("occurred_at").isoformat() if row.get("occurred_at") else None,
        }
        for row in rows
    ]


async def _fetch_company_rollup(
    conn: asyncpg.Connection,
    *,
    company_id: UUID,
    company_name: str | None,
) -> dict[str, Any]:
    row = await conn.fetchrow(
        """
        SELECT
            COUNT(*) AS total_projects,
            COUNT(*) FILTER (WHERE status = 'active') AS active_projects,
            MAX(updated_at) AS latest_activity_at
        FROM projects
        WHERE company_id = $1
          AND deleted_at IS NULL
        """,
        company_id,
    )
    return {
        "company_id": str(company_id),
        "company_name": company_name,
        "total_projects": _safe_int(row.get("total_projects") if row else 0),
        "active_projects": _safe_int(row.get("active_projects") if row else 0),
        "latest_activity_at": row.get("latest_activity_at").isoformat()
        if row and row.get("latest_activity_at")
        else None,
    }


def _latest_timestamp(*timestamps: object) -> str | None:
    dt_values = [value for value in timestamps if isinstance(value, datetime)]
    if not dt_values:
        return None
    latest = max(dt_values)
    return latest.isoformat()


async def _build_project_bundle(
    db_pool: asyncpg.Pool,
    project_id: UUID,
    user_id: UUID,
    *,
    mode: Literal["health", "overview", "dashboard"],
    include_series: bool = False,
    series_window_days: int = 30,
    layout_id: UUID | None = None,
    compact_lists: bool = False,
) -> dict[str, Any]:
    project = await get_accessible_project(db_pool, project_id, user_id)
    project_summary = normalize_project_summary_row(project)
    needs_health = mode in {"health", "dashboard"}
    needs_overview = mode in {"overview", "dashboard"}
    use_large_lists = mode == "dashboard" and not compact_lists

    counts: dict[str, int] = {
        "jtbd": 0,
        "value_propositions": 0,
        "swot": 0,
        "competitors": 0,
        "researches": 0,
        "content": 0,
        "segments": 0,
        "campaigns": 0,
        "funnels": 0,
        "tasks": 0,
        "alerts": 0,
        "ai_runs": 0,
        "completed_tasks": 0,
        "overdue_tasks": 0,
        "open_alerts": 0,
        "critical_alerts": 0,
    }
    counts_and_stats: dict[str, Any] = {}
    coverage: list[dict[str, Any]] = []
    freshness: list[dict[str, Any]] = []
    strategy_integrity: list[dict[str, Any]] = []
    strategy_integrity_issues: list[dict[str, Any]] = []
    strategy_integrity_score = 0
    issue_remediation: list[dict[str, Any]] = []
    gaps: list[dict[str, Any]] = []
    highlights: list[dict[str, Any]] = []
    recommended_actions: list[dict[str, Any]] = []
    readiness_score = 0
    last_activity_at: str | None = None
    latest_swot: dict[str, Any] | None = None
    recent_content: list[dict[str, Any]] = []
    recent_researches: list[dict[str, Any]] = []
    segments: list[dict[str, Any]] = []
    campaigns: list[dict[str, Any]] = []
    funnels: list[dict[str, Any]] = []
    tasks: list[dict[str, Any]] = []
    alerts: list[dict[str, Any]] = []
    ai_runs: list[dict[str, Any]] = []
    activity_feed: list[dict[str, Any]] = []
    company_rollup: dict[str, Any] | None = None
    job_stories: list[dict[str, Any]] = []
    value_propositions: list[dict[str, Any]] = []
    competitors: list[dict[str, Any]] = []
    overview_researches: list[dict[str, Any]] = []
    overview_content: list[dict[str, Any]] = []
    integrity_stats: dict[str, Any] = {}
    analytics_data: dict[str, Any] | None = None

    async with db_pool.acquire() as conn:
        if needs_health:
            counts_and_stats = await _fetch_counts_and_stats(conn, project_id)
            counts = {
                "jtbd": _safe_int(counts_and_stats.get("jtbd")),
                "value_propositions": _safe_int(counts_and_stats.get("value_propositions")),
                "swot": _safe_int(counts_and_stats.get("swot")),
                "competitors": _safe_int(counts_and_stats.get("competitors")),
                "researches": _safe_int(counts_and_stats.get("researches")),
                "content": _safe_int(counts_and_stats.get("content")),
                "segments": _safe_int(counts_and_stats.get("segments")),
                "campaigns": _safe_int(counts_and_stats.get("campaigns")),
                "funnels": _safe_int(counts_and_stats.get("funnels")),
                "tasks": _safe_int(counts_and_stats.get("tasks")),
                "alerts": _safe_int(counts_and_stats.get("alerts")),
                "ai_runs": _safe_int(counts_and_stats.get("ai_runs")),
                "completed_tasks": _safe_int(counts_and_stats.get("completed_tasks")),
                "overdue_tasks": _safe_int(counts_and_stats.get("overdue_tasks")),
                "open_alerts": _safe_int(counts_and_stats.get("open_alerts")),
                "critical_alerts": _safe_int(counts_and_stats.get("critical_alerts")),
            }
            coverage_stats = await _fetch_coverage_stats(conn, project_id)
            integrity_stats = await _fetch_strategy_integrity_stats(conn, project_id)
            coverage = _build_coverage(counts, coverage_stats, project_id=project_id)
            strategy_integrity = _build_strategy_integrity(counts, coverage, integrity_stats)
            strategy_integrity_issues = _build_strategy_integrity_issues(counts, integrity_stats)
            strategy_integrity_score = _average_percentage(strategy_integrity)
            freshness = _build_freshness(counts_and_stats)
            gaps = _merge_insights(
                _build_gaps(counts, coverage, freshness),
                strategy_integrity_issues,
                limit=8,
            )
            issue_remediation = await _fetch_issue_remediation(
                conn,
                project_id,
                _collect_issue_codes(gaps, strategy_integrity_issues),
            )
            latest_swot = await _fetch_latest_swot(conn, project_id)
            list_fetch_cap = DASHBOARD_LIST_FETCH_LIMIT if use_large_lists else RECENT_RESEARCHES_LIMIT
            recent_researches = await _fetch_recent_researches(conn, project_id, limit=list_fetch_cap)
            recent_content = await _fetch_recent_content(conn, project_id)
            seg_cap = DASHBOARD_LIST_FETCH_LIMIT if use_large_lists else RECENT_SEGMENTS_LIMIT
            camp_cap = DASHBOARD_LIST_FETCH_LIMIT if use_large_lists else RECENT_CAMPAIGNS_LIMIT
            segments = await _fetch_recent_segments(conn, project_id, limit=seg_cap)
            campaigns = await _fetch_recent_campaigns(conn, project_id, limit=camp_cap)
            funnels = await _fetch_recent_funnels(conn, project_id)
            task_fetch_limit = DASHBOARD_LIST_FETCH_LIMIT if use_large_lists else RECENT_TASKS_LIMIT
            alert_fetch_limit = DASHBOARD_LIST_FETCH_LIMIT if use_large_lists else RECENT_ALERTS_LIMIT
            tasks = await _fetch_recent_tasks(conn, project_id, limit=task_fetch_limit)
            alerts = await _fetch_recent_alerts(conn, project_id, limit=alert_fetch_limit)
            ai_runs = await _fetch_recent_ai_runs(conn, project_id)
            activity_feed = await _fetch_activity_feed(conn, project_id)
            company_rollup = await _fetch_company_rollup(
                conn,
                company_id=project["company_id"],
                company_name=project.get("company_name"),
            )

        if needs_overview:
            latest_swot = latest_swot or await _fetch_latest_swot(conn, project_id)
            jtbd_limit = DASHBOARD_LIST_FETCH_LIMIT if use_large_lists else RECENT_JOB_STORIES_LIMIT
            vp_limit = DASHBOARD_LIST_FETCH_LIMIT if use_large_lists else RECENT_VALUE_PROPOSITIONS_LIMIT
            job_stories = await _fetch_recent_job_stories(conn, project_id, limit=jtbd_limit)
            value_propositions = await _fetch_recent_value_props(conn, project_id, limit=vp_limit)
            comp_limit = DASHBOARD_LIST_FETCH_LIMIT if use_large_lists else RECENT_COMPETITORS_LIMIT
            competitors = await _fetch_recent_competitors(conn, project_id, limit=comp_limit)
            overview_researches = (
                recent_researches if needs_health else await _fetch_recent_researches(conn, project_id)
            )
            overview_content = recent_content if needs_health else await _fetch_recent_content(conn, project_id)

        if include_series and mode == "dashboard":
            window = max(1, min(int(series_window_days), 90))
            # Same asyncpg connection cannot run queries concurrently (protocol limit).
            s_tasks = await fetch_tasks_completed_daily_series(conn, project_id, window)
            s_alerts = await fetch_alerts_opened_daily_series(conn, project_id, window)
            s_ai = await fetch_ai_runs_started_daily_series(conn, project_id, window)
            analytics_data = {
                "series": [
                    {"key": "tasks_completed_daily", "points": s_tasks},
                    {"key": "alerts_opened_daily", "points": s_alerts},
                    {"key": "ai_runs_started_daily", "points": s_ai},
                ],
                "generated_at": _now_utc(),
                "window_days": window,
            }

    result: dict[str, Any] = {"project": project_summary}

    if needs_health:
        highlights = _build_highlights(
            counts,
            coverage,
            freshness,
            strategy_integrity_score=strategy_integrity_score,
        )
        recommended_actions = [] if compact_lists else _build_recommended_actions(gaps)
        readiness_score, readiness_breakdown, readiness_meta = _compute_readiness_breakdown(
            counts,
            coverage,
            freshness,
            strategy_integrity_score=strategy_integrity_score,
        )
        last_activity_at = (
            activity_feed[0]["occurred_at"]
            if activity_feed
            else _latest_timestamp(
                counts_and_stats.get("latest_swot_at"),
                counts_and_stats.get("latest_research_at"),
                counts_and_stats.get("latest_content_at"),
                counts_and_stats.get("latest_ai_run_at"),
            )
        )
        result.update(
            {
                "counts": {
                    "jtbd": counts["jtbd"],
                    "value_propositions": counts["value_propositions"],
                    "swot": counts["swot"],
                    "competitors": counts["competitors"],
                    "researches": counts["researches"],
                    "content": counts["content"],
                    "segments": counts["segments"],
                    "campaigns": counts["campaigns"],
                    "funnels": counts["funnels"],
                    "tasks": counts["tasks"],
                    "alerts": counts["alerts"],
                    "ai_runs": counts["ai_runs"],
                    "open_alerts": counts["open_alerts"],
                    "critical_alerts": counts["critical_alerts"],
                },
                "readiness_score": readiness_score,
                "readiness_breakdown": readiness_breakdown,
                "readiness_meta": readiness_meta,
                "last_activity_at": last_activity_at,
                "coverage": coverage,
                "strategy_integrity_score": strategy_integrity_score,
                "strategy_integrity": strategy_integrity,
                "strategy_integrity_issues": strategy_integrity_issues,
                "issue_remediation": issue_remediation,
                "freshness": freshness,
                "gaps": gaps,
                "highlights": highlights,
                "recommended_actions": recommended_actions,
                "activity_feed": activity_feed,
                "company_rollup_excerpt": company_rollup,
                "latest_swot": latest_swot,
                "recent_content": recent_content[:4],
                "recent_researches": recent_researches[:4],
                "segments": segments,
                "campaigns": campaigns,
                "funnels": funnels,
                "tasks": tasks,
                "alerts": alerts,
                "ai_runs": ai_runs,
            }
        )

    if needs_overview:
        result.update(
            {
                "job_stories": job_stories,
                "value_propositions": value_propositions,
                "competitors": competitors,
                "researches": overview_researches,
                "content": overview_content,
                "swot": latest_swot,
            }
        )

    if analytics_data is not None:
        result["analytics"] = analytics_data

    if layout_id is not None and mode == "dashboard" and not compact_lists:
        from api.services.marketing_cabinet.dashboard_bundle_slices import (  # noqa: PLC0415
            build_widget_list_slices,
        )
        from api.services.marketing_cabinet.dashboard_service import DashboardService  # noqa: PLC0415

        svc = DashboardService(db_pool)
        layout = await svc.get_layout(layout_id, str(user_id))
        imc_runs_full: list[dict[str, Any]] = []
        if layout is not None and layout.project_id == project_id:
            need_imc = any(str(w.widget_key or "") == "imc_recent" for w in layout.widgets)
            if need_imc:
                async with db_pool.acquire() as conn:
                    imc_runs_full = await _fetch_recent_imc_runs_for_dashboard(conn, project_id)
                result["imc_research_runs"] = imc_runs_full
            tasks_full = result.get("tasks") if isinstance(result.get("tasks"), list) else []
            alerts_full = result.get("alerts") if isinstance(result.get("alerts"), list) else []
            campaigns_full = result.get("campaigns") if isinstance(result.get("campaigns"), list) else []
            segments_full = result.get("segments") if isinstance(result.get("segments"), list) else []
            researches_full = result.get("researches") if isinstance(result.get("researches"), list) else []
            job_rows = result.get("job_stories") if isinstance(result.get("job_stories"), list) else []
            vp_rows = result.get("value_propositions") if isinstance(result.get("value_propositions"), list) else []
            comp_rows = result.get("competitors") if isinstance(result.get("competitors"), list) else []
            slices = build_widget_list_slices(
                layout.widgets,
                tasks=tasks_full,
                alerts=alerts_full,
                campaigns=campaigns_full,
                segments=segments_full,
                researches=researches_full,
                imc_runs=imc_runs_full,
                job_stories=job_rows,
                value_propositions=vp_rows,
                competitors=comp_rows,
            )
            if slices:
                result["widget_list_slices"] = slices

    return result


async def build_project_health(
    db_pool: asyncpg.Pool,
    project_id: UUID,
    user_id: UUID,
) -> dict[str, Any]:
    return await _build_project_bundle(db_pool, project_id, user_id, mode="health")


async def build_project_overview(
    db_pool: asyncpg.Pool,
    project_id: UUID,
    user_id: UUID,
) -> dict[str, Any]:
    return await _build_project_bundle(db_pool, project_id, user_id, mode="overview")


async def build_project_dashboard(
    db_pool: asyncpg.Pool,
    project_id: UUID,
    user_id: UUID,
    *,
    include_series: bool = False,
    series_window_days: int = 30,
    layout_id: UUID | None = None,
    compact_lists: bool = False,
) -> dict[str, Any]:
    return await _build_project_bundle(
        db_pool,
        project_id,
        user_id,
        mode="dashboard",
        include_series=include_series,
        series_window_days=series_window_days,
        layout_id=layout_id,
        compact_lists=compact_lists,
    )


def _state_to_percentage(state: str | None) -> int:
    if state == "fresh":
        return 100
    if state == "warning":
        return 70
    if state == "stale":
        return 35
    return 0


def _graph_node_tone(*, percentage: int | None = None, metric_value: int | None = None) -> str:
    if percentage is not None:
        if percentage >= 70:
            return "accent"
        if percentage >= 40:
            return "warning"
        return "danger"
    if metric_value is not None and metric_value > 0:
        return "accent"
    return "default"


def _average_metric_percentages(*metrics: dict[str, Any]) -> int:
    percentages = [int(metric.get("percentage") or 0) for metric in metrics if _safe_int(metric.get("total")) > 0]
    if not percentages:
        return 0
    return round(sum(percentages) / len(percentages))


async def build_project_graph(
    db_pool: asyncpg.Pool,
    project_id: UUID,
    user_id: UUID,
) -> dict[str, Any]:
    health = await build_project_health(db_pool, project_id, user_id)
    counts = dict(health.get("counts") or {})
    coverage = {item["key"]: item for item in list(health.get("coverage") or []) if isinstance(item, dict)}
    strategy_integrity = {
        item["key"]: item for item in list(health.get("strategy_integrity") or []) if isinstance(item, dict)
    }
    strategy_integrity_issues = [
        item for item in list(health.get("strategy_integrity_issues") or []) if isinstance(item, dict)
    ]
    freshness = {item["key"]: item for item in list(health.get("freshness") or []) if isinstance(item, dict)}

    jtbd_coverage = coverage.get("jtbd_to_value_props", {})
    campaigns_coverage = coverage.get("campaigns_linked_to_strategy", {})
    funnels_coverage = coverage.get("funnels_with_live_data", {})
    jtbd_integrity = strategy_integrity.get("jtbd_covered_by_value_props", {})
    value_props_integrity = strategy_integrity.get("value_props_linked_to_jtbd", {})
    segments_jtbd_integrity = strategy_integrity.get("segments_linked_to_jtbd", {})
    segments_evidence_integrity = strategy_integrity.get("segments_linked_to_evidence", {})
    campaigns_integrity = strategy_integrity.get("campaigns_fully_linked", {})
    funnels_stage_integrity = strategy_integrity.get("funnels_with_stages", {})
    research_freshness = freshness.get("research", {})
    content_freshness = freshness.get("content", {})
    swot_freshness = freshness.get("swot", {})
    strategy_integrity_score = int(health.get("strategy_integrity_score") or 0)

    nodes = [
        {
            "id": "readiness",
            "title": "Готовность",
            "subtitle": "Общий индекс зрелости кабинета и покрытия базовых артефактов.",
            "target_view": "overview",
            "tone": _graph_node_tone(percentage=int(health.get("readiness_score") or 0)),
            "metric_label": "score",
            "metric_value": int(health.get("readiness_score") or 0),
            "percentage": int(health.get("readiness_score") or 0),
            "bullets": [
                f"JTBD: {counts.get('jtbd', 0)}",
                f"Value props: {counts.get('value_propositions', 0)}",
                f"Целостность стратегии: {strategy_integrity_score}%",
            ],
        },
        {
            "id": "customer",
            "title": "JTBD и ценность",
            "subtitle": "Понимание клиента и привязка к value proposition.",
            "target_view": "jtbd",
            "tone": _graph_node_tone(
                percentage=_average_metric_percentages(jtbd_integrity, value_props_integrity),
            ),
            "metric_label": "integrity",
            "metric_value": f"{_average_metric_percentages(jtbd_integrity, value_props_integrity)}%",
            "percentage": _average_metric_percentages(jtbd_integrity, value_props_integrity),
            "bullets": [
                f"JTBD с value props: {jtbd_integrity.get('covered', 0)} из {jtbd_integrity.get('total', 0)}",
                f"Value props с JTBD: {value_props_integrity.get('covered', 0)} из {value_props_integrity.get('total', 0)}",
                jtbd_coverage.get("label") or "Связка JTBD -> VP",
            ],
        },
        {
            "id": "analysis",
            "title": "Аналитика и рынок",
            "subtitle": "SWOT и конкурентная рамка проекта.",
            "target_view": "analysis",
            "tone": _graph_node_tone(percentage=_state_to_percentage(swot_freshness.get("state"))),
            "metric_label": "assets",
            "metric_value": counts.get("swot", 0),
            "percentage": _state_to_percentage(swot_freshness.get("state")),
            "bullets": [
                f"SWOT: {counts.get('swot', 0)}",
                f"Конкуренты: {counts.get('competitors', 0)}",
                swot_freshness.get("detail") or "Следите за свежестью SWOT",
            ],
        },
        {
            "id": "evidence",
            "title": "Доказательства и ресерч",
            "subtitle": "Контент, исследования и доказательная база для решений.",
            "target_view": "evidence",
            "tone": _graph_node_tone(
                percentage=max(
                    _state_to_percentage(research_freshness.get("state")),
                    _state_to_percentage(content_freshness.get("state")),
                )
            ),
            "metric_label": "evidence",
            "metric_value": counts.get("content", 0),
            "percentage": max(
                _state_to_percentage(research_freshness.get("state")),
                _state_to_percentage(content_freshness.get("state")),
            ),
            "bullets": [
                f"Исследования: {counts.get('researches', 0)}",
                f"Документы: {counts.get('content', 0)}",
                research_freshness.get("detail") or content_freshness.get("detail") or "Основа для следующих выводов",
            ],
        },
        {
            "id": "segments",
            "title": "Сегменты",
            "subtitle": "Целевые аудитории, связанные с доказательствами и pain/gain картиной.",
            "target_view": "segments",
            "tone": _graph_node_tone(
                percentage=_average_metric_percentages(
                    segments_jtbd_integrity,
                    segments_evidence_integrity,
                ),
            ),
            "metric_label": "integrity",
            "metric_value": f"{_average_metric_percentages(segments_jtbd_integrity, segments_evidence_integrity)}%",
            "percentage": _average_metric_percentages(
                segments_jtbd_integrity,
                segments_evidence_integrity,
            ),
            "bullets": [
                f"Сегментов: {counts.get('segments', 0)}",
                f"Связаны с JTBD: {segments_jtbd_integrity.get('covered', 0)} из {segments_jtbd_integrity.get('total', 0)}",
                f"Подкреплены evidence: {segments_evidence_integrity.get('covered', 0)} из {segments_evidence_integrity.get('total', 0)}",
            ],
        },
        {
            "id": "campaigns",
            "title": "Кампании",
            "subtitle": "Исполнение стратегии через каналы, гипотезы и KPI.",
            "target_view": "campaigns",
            "tone": _graph_node_tone(
                percentage=_average_metric_percentages(campaigns_integrity, campaigns_coverage),
            ),
            "metric_label": "integrity",
            "metric_value": f"{_average_metric_percentages(campaigns_integrity, campaigns_coverage)}%",
            "percentage": _average_metric_percentages(campaigns_integrity, campaigns_coverage),
            "bullets": [
                f"Кампаний: {counts.get('campaigns', 0)}",
                f"Полные связки: {campaigns_integrity.get('covered', 0)} из {campaigns_integrity.get('total', 0)}",
                campaigns_coverage.get("label") or "Связь кампаний со стратегией",
            ],
        },
        {
            "id": "funnels",
            "title": "Воронки",
            "subtitle": "От перехода в кампанию к управляемому performance-контуру.",
            "target_view": "funnel",
            "tone": _graph_node_tone(
                percentage=_average_metric_percentages(funnels_stage_integrity, funnels_coverage),
            ),
            "metric_label": "integrity",
            "metric_value": f"{_average_metric_percentages(funnels_stage_integrity, funnels_coverage)}%",
            "percentage": _average_metric_percentages(funnels_stage_integrity, funnels_coverage),
            "bullets": [
                f"Воронок: {counts.get('funnels', 0)}",
                f"С этапами: {funnels_stage_integrity.get('covered', 0)} из {funnels_stage_integrity.get('total', 0)}",
                f"С live-данными: {funnels_coverage.get('covered', 0)} из {funnels_coverage.get('total', 0)}",
            ],
        },
        {
            "id": "operations",
            "title": "Операционка",
            "subtitle": "Задачи и алерты, которые переводят стратегию в ритм исполнения.",
            "target_view": "tasks",
            "tone": _graph_node_tone(metric_value=int(counts.get("tasks", 0) or 0)),
            "metric_label": "ops",
            "metric_value": counts.get("tasks", 0),
            "percentage": 100 if counts.get("tasks", 0) or counts.get("alerts", 0) else 0,
            "bullets": [
                f"Задачи: {counts.get('tasks', 0)}",
                f"Алерты: {counts.get('alerts', 0)}",
                "Операционный слой должен замыкать граф в реальные действия.",
            ],
        },
        {
            "id": "ai",
            "title": "AI сигналы",
            "subtitle": "Запуски AI и интеллектуальные контуры, усиливающие кабинет.",
            "target_view": "ai_studio",
            "tone": _graph_node_tone(metric_value=int(counts.get("ai_runs", 0) or 0)),
            "metric_label": "runs",
            "metric_value": counts.get("ai_runs", 0),
            "percentage": 100 if counts.get("ai_runs", 0) else 0,
            "bullets": [
                f"AI runs: {counts.get('ai_runs', 0)}",
                "AI должен опираться на актуальные документы и структуру кабинета.",
                "Используйте document-aware режим для ускорения заполнения блоков.",
            ],
        },
    ]

    edges = [
        {"source": "readiness", "target": "customer", "label": "понимание клиента"},
        {"source": "customer", "target": "analysis", "label": "позиционирование"},
        {"source": "analysis", "target": "evidence", "label": "подтверждение"},
        {"source": "evidence", "target": "segments", "label": "приоритизация"},
        {"source": "segments", "target": "campaigns", "label": "активация"},
        {"source": "campaigns", "target": "funnels", "label": "конверсия"},
        {"source": "funnels", "target": "operations", "label": "исполнение"},
        {"source": "operations", "target": "ai", "label": "сигналы и оптимизация"},
    ]

    return {
        "project": health["project"],
        "readiness_score": int(health.get("readiness_score") or 0),
        "strategy_integrity_score": strategy_integrity_score,
        "strategy_integrity_issues": strategy_integrity_issues[:4],
        "last_activity_at": health.get("last_activity_at"),
        "nodes": nodes,
        "edges": edges,
    }
