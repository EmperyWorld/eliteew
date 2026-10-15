"""Per-widget list slices for interactive dashboard (server-side filters, sort, maxItems cap).

Pairs with GET .../dashboard?layout_id=... — see build_project_dashboard.
"""

from __future__ import annotations

import math
from typing import Any

from api.schemas.marketing_cabinet.dashboard import WidgetResponse

# Match dashboard_widget_config.MAX_MAX_ITEMS
DASHBOARD_LIST_MAX_ITEMS = 500

_SEVERITY_RANK: dict[str, int] = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
}


def _pick_max_items(raw: Any) -> int:  # noqa: ANN401
    if isinstance(raw, bool):
        return 4
    if isinstance(raw, int):
        n = raw
    elif isinstance(raw, float) and math.isfinite(raw):
        n = int(raw)
    elif isinstance(raw, str) and raw.strip():
        try:
            n = int(raw.strip(), 10)
        except ValueError:
            return 4
    else:
        return 4
    if n < 1:
        return 4
    return min(n, DASHBOARD_LIST_MAX_ITEMS)


def _parse_sort(
    raw: Any,  # noqa: ANN401
    *,
    default_field: str,
) -> tuple[str, bool]:
    field = default_field
    desc = False
    if isinstance(raw, str):
        t = raw.strip()
        if t:
            field = t
    elif isinstance(raw, dict):
        f = raw.get("field") or raw.get("by")
        if isinstance(f, str) and f.strip():
            field = f.strip()
        d = raw.get("direction") or raw.get("dir")
        if isinstance(d, str) and d.lower() == "desc":
            desc = True
    return field, desc


def _scalar_match(item_val: Any, filter_val: Any) -> bool:  # noqa: ANN401
    if filter_val is None:
        return True
    if isinstance(filter_val, (str, int, float, bool)):
        return str(item_val) == str(filter_val)
    return True


def _apply_scalar_filters(rows: list[dict[str, Any]], filters: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not filters:
        return rows
    out: list[dict[str, Any]] = []
    for row in rows:
        ok = True
        for fk, fv in filters.items():
            if not fk or fk.startswith("_"):
                continue
            if isinstance(fv, (dict, list)):
                continue
            if not _scalar_match(row.get(fk), fv):
                ok = False
                break
        if ok:
            out.append(row)
    return out


def _task_default_sort_key(row: dict[str, Any]) -> tuple[int, tuple[bool, str], str]:
    """Match SQL default: open first, due_at asc, then updated_at desc."""
    st = str(row.get("status") or "")
    completed = 1 if st == "completed" else 0
    due = row.get("due_at")
    due_tie: tuple[bool, str] = (due is None, str(due or ""))
    updated = str(row.get("updated_at") or "")
    return (completed, due_tie, updated)


def _alert_default_sort_key(row: dict[str, Any]) -> tuple[int, str]:
    sev = str(row.get("severity") or "").lower()
    rank = _SEVERITY_RANK.get(sev, 99)
    updated = str(row.get("updated_at") or "")
    return (rank, updated)


def _sort_tasks(rows: list[dict[str, Any]], sort_spec: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    field, desc = _parse_sort(sort_spec, default_field="due_at")
    if field in ("", "default", "auto"):
        return sorted(rows, key=_task_default_sort_key, reverse=desc)

    def key_row(r: dict[str, Any]) -> tuple[Any, ...]:
        if field == "status":
            st = str(r.get("status") or "")
            completed = 1 if st == "completed" else 0
            return (completed,)
        if field == "priority":
            p = str(r.get("priority") or "").lower()
            order = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
            return (order.get(p, 99),)
        if field in ("due_at", "created_at", "updated_at"):
            v = r.get(field)
            return ((v is None, str(v or "")),)
        v = r.get(field)
        return (str(v or ""),)

    return sorted(rows, key=key_row, reverse=desc)


def _sort_alerts(rows: list[dict[str, Any]], sort_spec: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    field, desc = _parse_sort(sort_spec, default_field="severity")
    if field in ("", "default", "auto"):
        return sorted(rows, key=_alert_default_sort_key, reverse=desc)

    def key_row(r: dict[str, Any]) -> tuple[Any, ...]:
        if field == "severity":
            sev = str(r.get("severity") or "").lower()
            return (_SEVERITY_RANK.get(sev, 99),)
        if field in ("created_at", "updated_at"):
            v = r.get(field)
            return ((v is None, str(v or "")),)
        v = r.get(field)
        return (str(v or ""),)

    return sorted(rows, key=key_row, reverse=desc)


def _campaign_default_key(row: dict[str, Any]) -> tuple[str, str]:
    return (str(row.get("updated_at") or ""), str(row.get("name") or ""))


def _sort_campaigns(rows: list[dict[str, Any]], sort_spec: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    field, desc = _parse_sort(sort_spec, default_field="updated_at")
    if field in ("", "default", "auto"):
        return sorted(rows, key=_campaign_default_key, reverse=True)

    def key_row(r: dict[str, Any]) -> tuple[Any, ...]:
        if field == "name":
            return (str(r.get("name") or ""),)
        if field in ("status", "channel", "priority"):
            return (str(r.get(field) or ""),)
        if field in ("created_at", "updated_at", "start_date", "end_date"):
            v = r.get(field)
            return ((v is None, str(v or "")),)
        v = r.get(field)
        return (str(v or ""),)

    return sorted(rows, key=key_row, reverse=desc)


def _segment_default_key(row: dict[str, Any]) -> tuple[str, str]:
    return (str(row.get("updated_at") or ""), str(row.get("name") or ""))


def _sort_segments(rows: list[dict[str, Any]], sort_spec: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    field, desc = _parse_sort(sort_spec, default_field="updated_at")
    if field in ("", "default", "auto"):
        return sorted(rows, key=_segment_default_key, reverse=True)

    def key_row(r: dict[str, Any]) -> tuple[Any, ...]:
        if field == "name":
            return (str(r.get("name") or ""),)
        if field in ("segment_type", "status", "priority"):
            return (str(r.get(field) or ""),)
        if field in ("created_at", "updated_at"):
            v = r.get(field)
            return ((v is None, str(v or "")),)
        v = r.get(field)
        return (str(v or ""),)

    return sorted(rows, key=key_row, reverse=desc)


def _research_default_key(row: dict[str, Any]) -> tuple[str, str]:
    return (str(row.get("updated_at") or ""), str(row.get("title") or ""))


def _sort_researches(rows: list[dict[str, Any]], sort_spec: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    field, desc = _parse_sort(sort_spec, default_field="updated_at")
    if field in ("", "default", "auto"):
        return sorted(rows, key=_research_default_key, reverse=True)

    def key_row(r: dict[str, Any]) -> tuple[Any, ...]:
        if field == "title":
            return (str(r.get("title") or ""),)
        if field in ("status", "research_type", "priority"):
            return (str(r.get(field) or ""),)
        if field in ("created_at", "updated_at"):
            v = r.get(field)
            return ((v is None, str(v or "")),)
        v = r.get(field)
        return (str(v or ""),)

    return sorted(rows, key=key_row, reverse=desc)


def _imc_default_key(row: dict[str, Any]) -> tuple[str, str]:
    return (
        str(row.get("updated_at") or row.get("created_at") or ""),
        str(row.get("display_name") or row.get("type_key") or ""),
    )


def _sort_imc_runs(rows: list[dict[str, Any]], sort_spec: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    field, desc = _parse_sort(sort_spec, default_field="updated_at")
    if field in ("", "default", "auto"):
        return sorted(rows, key=_imc_default_key, reverse=True)

    def key_row(r: dict[str, Any]) -> tuple[Any, ...]:
        if field == "display_name":
            return (str(r.get("display_name") or ""),)
        if field in ("type_key", "status"):
            return (str(r.get(field) or ""),)
        if field in ("created_at", "updated_at", "started_at", "completed_at"):
            v = r.get(field)
            return ((v is None, str(v or "")),)
        v = r.get(field)
        return (str(v or ""),)

    return sorted(rows, key=key_row, reverse=desc)


_JOB_PRIORITY_ORDER: dict[str, int] = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
}


def _jtbd_default_key(row: dict[str, Any]) -> tuple[str, str]:
    return (
        str(row.get("updated_at") or ""),
        str(row.get("created_at") or ""),
    )


def _sort_job_stories(rows: list[dict[str, Any]], sort_spec: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    field, desc = _parse_sort(sort_spec, default_field="updated_at")
    if field in ("", "default", "auto"):
        return sorted(rows, key=_jtbd_default_key, reverse=True)

    def key_row(r: dict[str, Any]) -> tuple[Any, ...]:
        if field == "priority":
            p = str(r.get("priority") or "").lower()
            return (_JOB_PRIORITY_ORDER.get(p, 99),)
        if field == "category":
            return (str(r.get("category") or ""),)
        if field == "is_validated":
            v = r.get("is_validated")
            return (1 if v else 0,)
        if field == "opportunity_score":
            v = r.get("opportunity_score")
            if isinstance(v, (int, float)):
                return (float(v),)
            return (float("nan"),)
        if field in ("created_at", "updated_at"):
            v = r.get(field)
            return ((v is None, str(v or "")),)
        if field == "title":
            return (str(r.get("title") or ""),)
        v = r.get(field)
        return (str(v or ""),)

    return sorted(rows, key=key_row, reverse=desc)


def _value_prop_default_key(row: dict[str, Any]) -> tuple[str, str]:
    return (
        str(row.get("updated_at") or ""),
        str(row.get("headline") or ""),
    )


def _sort_value_props(rows: list[dict[str, Any]], sort_spec: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    field, desc = _parse_sort(sort_spec, default_field="updated_at")
    if field in ("", "default", "auto"):
        return sorted(rows, key=_value_prop_default_key, reverse=True)

    def key_row(r: dict[str, Any]) -> tuple[Any, ...]:
        if field == "status":
            return (str(r.get("status") or ""),)
        if field == "headline":
            return (str(r.get("headline") or ""),)
        if field == "quality_score":
            v = r.get("quality_score")
            if isinstance(v, (int, float)):
                return (float(v),)
            return (float("nan"),)
        if field in ("created_at", "updated_at"):
            v = r.get(field)
            return ((v is None, str(v or "")),)
        v = r.get(field)
        return (str(v or ""),)

    return sorted(rows, key=key_row, reverse=desc)


def _competitor_default_key(row: dict[str, Any]) -> tuple[str, str]:
    return (
        str(row.get("updated_at") or ""),
        str(row.get("name") or ""),
    )


def _sort_competitors(rows: list[dict[str, Any]], sort_spec: Any) -> list[dict[str, Any]]:  # noqa: ANN401
    field, desc = _parse_sort(sort_spec, default_field="updated_at")
    if field in ("", "default", "auto"):
        return sorted(rows, key=_competitor_default_key, reverse=True)

    def key_row(r: dict[str, Any]) -> tuple[Any, ...]:
        if field == "competitor_type":
            return (str(r.get("competitor_type") or ""),)
        if field == "name":
            return (str(r.get("name") or ""),)
        if field in ("created_at", "updated_at"):
            v = r.get(field)
            return ((v is None, str(v or "")),)
        v = r.get(field)
        return (str(v or ""),)

    return sorted(rows, key=key_row, reverse=desc)


def build_widget_list_slices(
    widgets: list[WidgetResponse],
    *,
    tasks: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    campaigns: list[dict[str, Any]] | None = None,
    segments: list[dict[str, Any]] | None = None,
    researches: list[dict[str, Any]] | None = None,
    imc_runs: list[dict[str, Any]] | None = None,
    job_stories: list[dict[str, Any]] | None = None,
    value_propositions: list[dict[str, Any]] | None = None,
    competitors: list[dict[str, Any]] | None = None,
) -> dict[str, dict[str, Any]]:
    """
    Build per-widget-id subsets for list tiles.
    Keys are widget UUID strings; values may include list keys and ``alerts_open_count``.
    """
    camp = list(campaigns or [])
    seg = list(segments or [])
    res = list(researches or [])
    imc = list(imc_runs or [])
    jobs = list(job_stories or [])
    vps = list(value_propositions or [])
    comps = list(competitors or [])
    out: dict[str, dict[str, Any]] = {}
    for w in widgets:
        cfg = w.widget_config if isinstance(w.widget_config, dict) else {}
        key = str(w.id)
        if w.widget_key == "tasks":
            flt = cfg.get("filters") if isinstance(cfg.get("filters"), dict) else None
            filtered = _apply_scalar_filters(list(tasks), flt)
            sorted_rows = _sort_tasks(filtered, cfg.get("sort"))
            cap = _pick_max_items(cfg.get("maxItems"))
            filtered_total = len(sorted_rows)
            slice_rows = sorted_rows[:cap]
            out[key] = {"tasks": slice_rows, "filtered_total": filtered_total}
        elif w.widget_key == "alerts":
            flt = cfg.get("filters") if isinstance(cfg.get("filters"), dict) else None
            filtered = _apply_scalar_filters(list(alerts), flt)
            sorted_rows = _sort_alerts(filtered, cfg.get("sort"))
            open_in_filtered = sum(1 for r in sorted_rows if str(r.get("status") or "").lower() == "open")
            cap = _pick_max_items(cfg.get("maxItems"))
            filtered_total = len(sorted_rows)
            slice_rows = sorted_rows[:cap]
            out[key] = {
                "alerts": slice_rows,
                "alerts_open_count": open_in_filtered,
                "filtered_total": filtered_total,
            }
        elif w.widget_key == "campaigns":
            flt = cfg.get("filters") if isinstance(cfg.get("filters"), dict) else None
            filtered = _apply_scalar_filters(camp, flt)
            sorted_rows = _sort_campaigns(filtered, cfg.get("sort"))
            cap = _pick_max_items(cfg.get("maxItems"))
            filtered_total = len(sorted_rows)
            slice_rows = sorted_rows[:cap]
            out[key] = {"campaigns": slice_rows, "filtered_total": filtered_total}
        elif w.widget_key == "segments":
            flt = cfg.get("filters") if isinstance(cfg.get("filters"), dict) else None
            filtered = _apply_scalar_filters(seg, flt)
            sorted_rows = _sort_segments(filtered, cfg.get("sort"))
            cap = _pick_max_items(cfg.get("maxItems"))
            filtered_total = len(sorted_rows)
            slice_rows = sorted_rows[:cap]
            out[key] = {"segments": slice_rows, "filtered_total": filtered_total}
        elif w.widget_key == "researches":
            flt = cfg.get("filters") if isinstance(cfg.get("filters"), dict) else None
            filtered = _apply_scalar_filters(res, flt)
            sorted_rows = _sort_researches(filtered, cfg.get("sort"))
            cap = _pick_max_items(cfg.get("maxItems"))
            filtered_total = len(sorted_rows)
            slice_rows = sorted_rows[:cap]
            out[key] = {"researches": slice_rows, "filtered_total": filtered_total}
        elif w.widget_key == "imc_recent":
            flt = cfg.get("filters") if isinstance(cfg.get("filters"), dict) else None
            filtered = _apply_scalar_filters(imc, flt)
            sorted_rows = _sort_imc_runs(filtered, cfg.get("sort"))
            cap = _pick_max_items(cfg.get("maxItems"))
            filtered_total = len(sorted_rows)
            slice_rows = sorted_rows[:cap]
            out[key] = {"imc_research_runs": slice_rows, "filtered_total": filtered_total}
        elif w.widget_key == "jtbd_stories":
            flt = cfg.get("filters") if isinstance(cfg.get("filters"), dict) else None
            filtered = _apply_scalar_filters(jobs, flt)
            sorted_rows = _sort_job_stories(filtered, cfg.get("sort"))
            cap = _pick_max_items(cfg.get("maxItems"))
            filtered_total = len(sorted_rows)
            slice_rows = sorted_rows[:cap]
            out[key] = {"job_stories": slice_rows, "filtered_total": filtered_total}
        elif w.widget_key == "value_props":
            flt = cfg.get("filters") if isinstance(cfg.get("filters"), dict) else None
            filtered = _apply_scalar_filters(vps, flt)
            sorted_rows = _sort_value_props(filtered, cfg.get("sort"))
            cap = _pick_max_items(cfg.get("maxItems"))
            filtered_total = len(sorted_rows)
            slice_rows = sorted_rows[:cap]
            out[key] = {"value_propositions": slice_rows, "filtered_total": filtered_total}
        elif w.widget_key == "competitors":
            flt = cfg.get("filters") if isinstance(cfg.get("filters"), dict) else None
            filtered = _apply_scalar_filters(comps, flt)
            sorted_rows = _sort_competitors(filtered, cfg.get("sort"))
            cap = _pick_max_items(cfg.get("maxItems"))
            filtered_total = len(sorted_rows)
            slice_rows = sorted_rows[:cap]
            out[key] = {"competitors": slice_rows, "filtered_total": filtered_total}
    return out
