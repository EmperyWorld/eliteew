# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/marketing_cabinet/dashboard_widget_config.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""Normalize marketing dashboard widget_config before persisting (parity with frontend parseWidgetConfig)."""

from __future__ import annotations

import json
import math
from typing import Any
from urllib.parse import urlparse

# Match shared/web/frontend/src/pages/MarketingCabinet/dashboard-widgets/parseWidgetConfig.ts
# (incl. MAX_CANVAS_MARKDOWN_UTF8_BYTES, MAX_TLDRAW_SNAPSHOT_JSON_BYTES)
MAX_WINDOW_DAYS = 90
MAX_MAX_ITEMS = 500
MAX_METRICS_BAR_SELECTED_KEYS = 12
MAX_METRIC_KEY_CHARS = 64
CHART_METRICS_BAR_FORMATS = frozenset({"bar_horizontal", "bar_vertical", "donut"})
MAX_FILTERS_JSON_BYTES = 8192
MAX_CANVAS_MARKDOWN_UTF8_BYTES = 32768
MAX_TLDRAW_SNAPSHOT_JSON_BYTES = 524288

MARKETING_DASHBOARD_WIDGET_KEYS = frozenset(
    {
        "overview_kpi",
        "tasks",
        "funnel",
        "campaigns",
        "alerts",
        "segments",
        "ai_activity",
        "swot",
        "researches",
        "imc_recent",
        "jtbd_stories",
        "value_props",
        "competitors",
        "chart_metric",
        "chart_metrics_bar",
        "marketing_canvas",
    }
)

MARKETING_DASHBOARD_LIST_KEYS = frozenset(
    {
        "tasks",
        "funnel",
        "campaigns",
        "alerts",
        "segments",
        "ai_activity",
        "swot",
        "researches",
        "imc_recent",
        "jtbd_stories",
        "value_props",
        "competitors",
    }
)

# (min_w, min_h, default_w, default_h) — keep in sync with
# shared/web/frontend/src/pages/MarketingCabinet/dashboard-widgets/registry.ts DASHBOARD_WIDGET_CATALOG
MARKETING_DASHBOARD_WIDGET_GRID_DEFAULTS: dict[str, tuple[int, int, int, int]] = {
    "overview_kpi": (4, 3, 6, 4),
    "tasks": (3, 3, 4, 5),
    "funnel": (3, 3, 4, 5),
    "campaigns": (3, 3, 4, 5),
    "alerts": (3, 3, 4, 5),
    "segments": (3, 3, 4, 5),
    "ai_activity": (3, 3, 4, 4),
    "swot": (3, 4, 4, 6),
    "researches": (3, 3, 4, 5),
    "imc_recent": (3, 3, 4, 5),
    "jtbd_stories": (3, 3, 4, 5),
    "value_props": (3, 3, 4, 5),
    "competitors": (3, 3, 4, 5),
    "chart_metric": (5, 4, 6, 5),
    "chart_metrics_bar": (4, 4, 6, 5),
    "marketing_canvas": (4, 4, 4, 4),
}

RGL_MAX_COLS = 12
RGL_MAX_ROWS = 200


def _to_plain_dict(raw: Any) -> dict[str, Any]:  # noqa: ANN401
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    return {}


def _pick_trimmed_string(value: Any) -> str | None:  # noqa: ANN401
    if not isinstance(value, str):
        return None
    t = value.strip()
    return t if t else None


def _pick_density(value: Any) -> str | None:  # noqa: ANN401
    if value in ("compact", "comfortable"):
        return str(value)
    return None


def _pick_positive_int(value: Any, max_v: int) -> int | None:  # noqa: ANN401
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        n = value
    elif isinstance(value, float) and math.isfinite(value):
        n = int(value)
        if n < 1 or n > max_v:
            return None
    elif isinstance(value, str) and value.strip():
        try:
            n = int(value.strip(), 10)
        except ValueError:
            return None
    else:
        return None
    if 1 <= n <= max_v:
        return n
    return None


def _is_json_safe_filter_value(val: Any, depth: int = 0) -> bool:  # noqa: ANN401
    if depth > 4:
        return False
    if val is None or isinstance(val, bool):
        return True
    if isinstance(val, int) and not isinstance(val, bool):
        return True
    if isinstance(val, float):
        return math.isfinite(val)
    if isinstance(val, str):
        return True
    if isinstance(val, list):
        if len(val) > 100:
            return False
        return all(_is_json_safe_filter_value(x, depth + 1) for x in val)
    if isinstance(val, dict):
        if len(val) > 100:
            return False
        for k, v in val.items():
            if not isinstance(k, str):
                return False
            if not _is_json_safe_filter_value(v, depth + 1):
                return False
        return True
    return False


def _parse_filters(raw: Any) -> dict[str, Any] | None:  # noqa: ANN401
    if raw is None or not isinstance(raw, dict):
        return None
    out: dict[str, Any] = {}
    for k, v in raw.items():
        if not isinstance(k, str):
            continue
        if _is_json_safe_filter_value(v):
            out[k] = v
    try:
        blob = json.dumps(out, separators=(",", ":"), ensure_ascii=False)
    except (TypeError, ValueError):  # fmt: skip
        return None
    if len(blob.encode("utf-8")) > MAX_FILTERS_JSON_BYTES:
        return None
    return out


def _parse_sort_spec(raw: Any) -> dict[str, Any] | str | None:  # noqa: ANN401
    if isinstance(raw, str):
        return _pick_trimmed_string(raw)
    if raw is None or not isinstance(raw, dict):
        return None
    o = raw
    field_raw = o.get("field")
    if isinstance(field_raw, str):
        field = _pick_trimmed_string(field_raw)
    elif "field" not in o or field_raw is None:
        field = None
    else:
        fs = str(field_raw).strip()
        field = fs if fs else None
    direction_raw = o.get("direction")
    direction = direction_raw if direction_raw in ("asc", "desc") else None
    if field is None and direction is None:
        return None
    result: dict[str, Any] = {}
    if field is not None:
        result["field"] = field
    if direction is not None:
        result["direction"] = direction
    return result


def _sanitize_common(obj: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    title = _pick_trimmed_string(obj.get("titleOverride"))
    if title is not None:
        out["titleOverride"] = title
    max_items = _pick_positive_int(obj.get("maxItems"), MAX_MAX_ITEMS)
    if max_items is not None:
        out["maxItems"] = max_items
    density = _pick_density(obj.get("density"))
    if density is not None:
        out["density"] = density
    return out


def _sanitize_list_body(obj: dict[str, Any], common: dict[str, Any]) -> dict[str, Any]:
    out = dict(common)
    sort_v = _parse_sort_spec(obj.get("sort"))
    if sort_v is not None:
        out["sort"] = sort_v
    filters_v = _parse_filters(obj.get("filters"))
    if filters_v is not None:
        out["filters"] = filters_v
    return out


def _sanitize_chart_metric(obj: dict[str, Any], common: dict[str, Any]) -> dict[str, Any]:
    out = dict(common)
    chart_kind = _pick_trimmed_string(obj.get("chartKind"))
    if chart_kind is not None:
        out["chartKind"] = chart_kind
    metric = _pick_trimmed_string(obj.get("metric"))
    if metric is not None:
        out["metric"] = metric
    # Clamp to 1…MAX_WINDOW_DAYS (inclusive), same as frontend pickPositiveInt(..., MAX_WINDOW_DAYS)
    window_days = _pick_positive_int(obj.get("windowDays"), MAX_WINDOW_DAYS)
    if window_days is not None:
        out["windowDays"] = window_days
    return out


def _sanitize_metric_keys_for_bar(raw: Any) -> list[str] | None:  # noqa: ANN401
    if raw is None or not isinstance(raw, list):
        return None
    out: list[str] = []
    seen: set[str] = set()
    for entry in raw:
        if not isinstance(entry, str):
            continue
        key = entry.strip()
        if len(key) > MAX_METRIC_KEY_CHARS:
            key = key[:MAX_METRIC_KEY_CHARS]
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(key)
        if len(out) >= MAX_METRICS_BAR_SELECTED_KEYS:
            break
    return out or None


def _pick_chart_metrics_bar_format(value: Any) -> str | None:  # noqa: ANN401
    if value in CHART_METRICS_BAR_FORMATS:
        return str(value)
    return None


def _sanitize_chart_metrics_bar(obj: dict[str, Any], common: dict[str, Any]) -> dict[str, Any]:
    out = dict(common)
    window_days = _pick_positive_int(obj.get("windowDays"), MAX_WINDOW_DAYS)
    if window_days is not None:
        out["windowDays"] = window_days
    agg = obj.get("aggregation")
    if agg in ("last", "sum"):
        out["aggregation"] = str(agg)
    metric_keys = _sanitize_metric_keys_for_bar(obj.get("metricKeys"))
    if metric_keys is not None:
        out["metricKeys"] = metric_keys
    chart_fmt = _pick_chart_metrics_bar_format(obj.get("chartFormat"))
    if chart_fmt is not None:
        out["chartFormat"] = chart_fmt
    return out


def _truncate_utf8_bytes(s: str, max_bytes: int) -> str:
    raw = s.encode("utf-8")
    if len(raw) <= max_bytes:
        return s
    cut = raw[:max_bytes]
    while cut:
        try:
            return cut.decode("utf-8")
        except UnicodeDecodeError:
            cut = cut[:-1]
    return ""


def _pick_canvas_markdown(value: Any) -> str | None:  # noqa: ANN401
    if not isinstance(value, str):
        return None
    t = value.strip()
    if not t:
        return None
    return _truncate_utf8_bytes(t, MAX_CANVAS_MARKDOWN_UTF8_BYTES)


def _pick_canvas_mode(value: Any) -> str | None:  # noqa: ANN401
    if value in ("markdown", "drawing"):
        return str(value)
    return None


def _sanitize_tldraw_snapshot(raw: Any) -> dict[str, Any] | None:  # noqa: ANN401
    if raw is None or not isinstance(raw, dict):
        return None
    try:
        blob = json.dumps(raw, separators=(",", ":"), ensure_ascii=False)
    except (TypeError, ValueError):  # fmt: skip
        return None
    if len(blob.encode("utf-8")) > MAX_TLDRAW_SNAPSHOT_JSON_BYTES:
        return None
    return raw


def _widget_config_url_allow_hosts() -> frozenset[str]:
    from api.core.unified_config import unified_settings  # noqa: PLC0415

    raw = (unified_settings.marketing_dashboard_widget_config_url_allowlist or "").strip()
    if not raw:
        return frozenset()
    return frozenset(h.strip().lower() for h in raw.split(",") if h.strip())


def _strip_external_http_urls(
    value: Any,  # noqa: ANN401
    allow: frozenset[str],
    parent_key: str | None,
    depth: int = 0,
) -> Any:
    """Remove whole-string http(s) URLs unless hostname is allowlisted; keep ``canvasMarkdown`` intact."""
    if depth > 14:
        return value
    if parent_key == "canvasMarkdown" and isinstance(value, str):
        return value
    if isinstance(value, str):
        t = value.strip()
        lower = t.lower()
        if not lower.startswith(("http://", "https://")):
            return value
        try:
            parsed = urlparse(t)
            if parsed.scheme not in ("http", "https"):
                return value
            host = (parsed.hostname or "").lower()
        except ValueError:
            return ""
        if not allow:
            return ""
        if host in allow:
            return value
        return ""
    if value is None or not isinstance(value, (dict, list)):
        return value
    if isinstance(value, list):
        return [_strip_external_http_urls(x, allow, parent_key, depth + 1) for x in value]
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for k, v in value.items():
            if not isinstance(k, str):
                continue
            if k == "canvasMarkdown" and isinstance(v, str):
                out[k] = v
                continue
            out[k] = _strip_external_http_urls(v, allow, k, depth + 1)
        return out
    return value


def _sanitize_marketing_canvas(obj: dict[str, Any], common: dict[str, Any]) -> dict[str, Any]:
    out = dict(common)
    md = _pick_canvas_markdown(obj.get("canvasMarkdown"))
    if md is not None:
        out["canvasMarkdown"] = md
    mode = _pick_canvas_mode(obj.get("canvasMode"))
    if mode is not None:
        out["canvasMode"] = mode
    snap = _sanitize_tldraw_snapshot(obj.get("tldrawSnapshot"))
    if snap is not None:
        out["tldrawSnapshot"] = snap
    return out


def sanitize_widget_config(widget_key: str, raw: dict[str, Any] | Any) -> dict[str, Any]:  # noqa: ANN401
    """
    Return a JSON-serializable dict with only supported keys for this widget_key.

    - Known catalog keys: same branches as ``parseWidgetConfig`` (overview_kpi, marketing_canvas
      with optional ``canvasMarkdown``, ``canvasMode`` (``markdown`` | ``drawing``), JSON
      ``tldrawSnapshot`` capped at ``MAX_TLDRAW_SNAPSHOT_JSON_BYTES``, chart_metric,
      chart_metrics_bar, list tiles).
    - Unknown ``widget_key``: only common fields (``titleOverride``, ``maxItems``, ``density``);
      arbitrary/extra keys are dropped (no pass-through).
    """
    obj = _to_plain_dict(raw)
    common = _sanitize_common(obj)
    allow = _widget_config_url_allow_hosts()

    if widget_key not in MARKETING_DASHBOARD_WIDGET_KEYS:
        return _strip_external_http_urls(common, allow, None, 0)

    if widget_key == "overview_kpi":
        return _strip_external_http_urls(common, allow, None, 0)

    if widget_key == "marketing_canvas":
        return _strip_external_http_urls(_sanitize_marketing_canvas(obj, common), allow, None, 0)

    if widget_key == "chart_metric":
        return _strip_external_http_urls(_sanitize_chart_metric(obj, common), allow, None, 0)

    if widget_key == "chart_metrics_bar":
        return _strip_external_http_urls(_sanitize_chart_metrics_bar(obj, common), allow, None, 0)

    if widget_key in MARKETING_DASHBOARD_LIST_KEYS:
        return _strip_external_http_urls(_sanitize_list_body(obj, common), allow, None, 0)

    return _strip_external_http_urls(common, allow, None, 0)


def _coerce_grid_int(value: Any, default: int) -> int:  # noqa: ANN401
    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return value
    if isinstance(value, float) and math.isfinite(value):
        return int(value)
    if isinstance(value, str) and value.strip():
        try:
            return int(value.strip(), 10)
        except ValueError:
            return default
    return default


def clamp_grid_position_for_widget_key(widget_key: str, raw: dict[str, Any] | Any) -> dict[str, Any]:
    """
    Enforce catalog min/default w/h and minW/minH for known widget keys (soft clamp, no 400).
    Unknown keys: return a shallow copy of the input dict.
    """
    obj = _to_plain_dict(raw)
    if widget_key not in MARKETING_DASHBOARD_WIDGET_GRID_DEFAULTS:
        return dict(obj)

    min_w, min_h, def_w, def_h = MARKETING_DASHBOARD_WIDGET_GRID_DEFAULTS[widget_key]
    out: dict[str, Any] = dict(obj)

    out["x"] = _coerce_grid_int(out.get("x"), 0)
    out["y"] = _coerce_grid_int(out.get("y"), 0)

    w_raw = out.get("w")
    h_raw = out.get("h")
    w = _coerce_grid_int(w_raw, def_w)
    h = _coerce_grid_int(h_raw, def_h)
    w = max(min_w, min(w, RGL_MAX_COLS))
    h = max(min_h, min(h, RGL_MAX_ROWS))

    mw_in = out.get("minW")
    mh_in = out.get("minH")
    minw_eff = max(min_w, _coerce_grid_int(mw_in, min_w))
    minh_eff = max(min_h, _coerce_grid_int(mh_in, min_h))
    out["minW"] = minw_eff
    out["minH"] = minh_eff

    out["w"] = max(w, minw_eff)
    out["h"] = max(h, minh_eff)
    out["w"] = min(out["w"], RGL_MAX_COLS)
    out["h"] = min(out["h"], RGL_MAX_ROWS)

    max_w = out.get("maxW")
    if max_w is not None:
        mx = _coerce_grid_int(max_w, RGL_MAX_COLS)
        if mx > 0:
            out["maxW"] = min(mx, RGL_MAX_COLS)
        else:
            out.pop("maxW", None)

    max_h = out.get("maxH")
    if max_h is not None:
        mx = _coerce_grid_int(max_h, RGL_MAX_ROWS)
        if mx > 0:
            out["maxH"] = min(mx, RGL_MAX_ROWS)
        else:
            out.pop("maxH", None)

    i_val = out.get("i")
    if i_val is not None and not isinstance(i_val, str):
        out.pop("i", None)

    return out
