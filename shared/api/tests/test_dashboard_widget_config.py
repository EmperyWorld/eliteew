"""Unit tests: marketing dashboard widget_config sanitization (no DB)."""

from __future__ import annotations

import pytest

from api.services.marketing_cabinet.dashboard_widget_config import (
    MAX_CANVAS_MARKDOWN_UTF8_BYTES,
    MAX_TLDRAW_SNAPSHOT_JSON_BYTES,
    clamp_grid_position_for_widget_key,
    sanitize_widget_config,
)


def test_sanitize_chart_metric_drops_out_of_range_window_days_and_unknown_keys() -> None:
    out = sanitize_widget_config("chart_metric", {"windowDays": 999, "extra": "noise"})
    assert out == {}


def test_sanitize_chart_metric_keeps_valid_fields() -> None:
    out = sanitize_widget_config(
        "chart_metric",
        {"windowDays": 14, "metric": "tasks_done", "chartKind": "line", "titleOverride": " A "},
    )
    assert out == {
        "windowDays": 14,
        "metric": "tasks_done",
        "chartKind": "line",
        "titleOverride": "A",
    }


def test_sanitize_unknown_widget_key_only_common() -> None:
    out = sanitize_widget_config("custom_plugin", {"titleOverride": "T", "payload": {"x": 1}})
    assert out == {"titleOverride": "T"}


def test_sanitize_list_widget_sort_filters_max_items() -> None:
    out = sanitize_widget_config(
        "tasks",
        {"maxItems": 10, "sort": "due_at", "filters": {"status": "open"}, "extra": 1},
    )
    assert out == {
        "maxItems": 10,
        "sort": "due_at",
        "filters": {"status": "open"},
    }


def test_sanitize_marketing_canvas_keeps_markdown_and_common() -> None:
    out = sanitize_widget_config(
        "marketing_canvas",
        {
            "titleOverride": " Notes ",
            "canvasMarkdown": "# Hello\n",
            "noise": {"x": 1},
        },
    )
    assert out == {"titleOverride": "Notes", "canvasMarkdown": "# Hello"}


def test_sanitize_marketing_canvas_truncates_utf8() -> None:
    # 2 bytes per code unit in UTF-8 for cyrillic letters
    chunk = "я"
    n = (MAX_CANVAS_MARKDOWN_UTF8_BYTES // 2) + 50
    raw = chunk * n
    out = sanitize_widget_config("marketing_canvas", {"canvasMarkdown": raw})
    assert len(out["canvasMarkdown"].encode("utf-8")) <= MAX_CANVAS_MARKDOWN_UTF8_BYTES
    assert out["canvasMarkdown"] == chunk * (MAX_CANVAS_MARKDOWN_UTF8_BYTES // 2)


def test_sanitize_marketing_canvas_ignores_non_string_markdown() -> None:
    out = sanitize_widget_config("marketing_canvas", {"canvasMarkdown": 99, "titleOverride": "T"})
    assert out == {"titleOverride": "T"}


def test_sanitize_marketing_canvas_keeps_canvas_mode_and_snapshot() -> None:
    snap = {"document": {"x": 1}, "session": {"y": 2}}
    out = sanitize_widget_config(
        "marketing_canvas",
        {
            "canvasMode": "drawing",
            "tldrawSnapshot": snap,
            "titleOverride": " Whiteboard ",
        },
    )
    assert out == {
        "titleOverride": "Whiteboard",
        "canvasMode": "drawing",
        "tldrawSnapshot": snap,
    }


def test_sanitize_marketing_canvas_drops_invalid_canvas_mode() -> None:
    out = sanitize_widget_config(
        "marketing_canvas",
        {"canvasMode": "whiteboard", "canvasMarkdown": "# Hi"},
    )
    assert out == {"canvasMarkdown": "# Hi"}


def test_sanitize_marketing_canvas_drops_non_object_snapshot() -> None:
    out = sanitize_widget_config(
        "marketing_canvas",
        {"tldrawSnapshot": [1, 2, 3], "titleOverride": "T"},
    )
    assert out == {"titleOverride": "T"}


def test_sanitize_marketing_canvas_drops_oversized_snapshot() -> None:
    big = {"k": "x" * (MAX_TLDRAW_SNAPSHOT_JSON_BYTES + 10)}
    out = sanitize_widget_config("marketing_canvas", {"tldrawSnapshot": big})
    assert out == {}
    assert "tldrawSnapshot" not in out


def test_sanitize_strips_whole_string_http_urls_when_allowlist_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.marketing_cabinet.dashboard_widget_config._widget_config_url_allow_hosts",
        lambda: frozenset(),
        raising=True,
    )
    out = sanitize_widget_config(
        "chart_metric",
        {"metric": "https://evil.example/path", "chartKind": "line"},
    )
    assert out == {"chartKind": "line", "metric": ""}


def test_sanitize_keeps_whole_string_http_url_when_host_allowlisted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "api.services.marketing_cabinet.dashboard_widget_config._widget_config_url_allow_hosts",
        lambda: frozenset({"allowed.example"}),
        raising=True,
    )
    url = "https://allowed.example/path"
    out = sanitize_widget_config(
        "chart_metric",
        {"metric": url, "chartKind": "line"},
    )
    assert out == {"chartKind": "line", "metric": url}


def test_sanitize_preserves_canvas_markdown_with_urls(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "api.services.marketing_cabinet.dashboard_widget_config._widget_config_url_allow_hosts",
        lambda: frozenset(),
        raising=True,
    )
    md = "See https://allowed.example/doc"
    out = sanitize_widget_config("marketing_canvas", {"canvasMarkdown": md})
    assert out["canvasMarkdown"] == md


def test_sanitize_chart_metrics_bar_keeps_window_and_aggregation() -> None:
    out = sanitize_widget_config(
        "chart_metrics_bar",
        {"windowDays": 21, "aggregation": "last", "titleOverride": " X ", "noise": 1},
    )
    assert out == {"windowDays": 21, "aggregation": "last", "titleOverride": "X"}


def test_sanitize_chart_metrics_bar_drops_bad_aggregation() -> None:
    out = sanitize_widget_config("chart_metrics_bar", {"aggregation": "average"})
    assert out == {}


def test_sanitize_chart_metrics_bar_keeps_metric_keys_and_format() -> None:
    out = sanitize_widget_config(
        "chart_metrics_bar",
        {
            "metricKeys": ["tasks_completed_daily", "  dup ", "dup"],
            "chartFormat": "bar_vertical",
        },
    )
    assert out["metricKeys"] == ["tasks_completed_daily", "dup"]
    assert out["chartFormat"] == "bar_vertical"


def test_sanitize_chart_metrics_bar_drops_bad_chart_format() -> None:
    out = sanitize_widget_config("chart_metrics_bar", {"chartFormat": "pie_3d"})
    assert "chartFormat" not in out


def test_sanitize_chart_metrics_bar_caps_metric_keys() -> None:
    raw = [f"k{i}" for i in range(20)]
    out = sanitize_widget_config("chart_metrics_bar", {"metricKeys": raw})
    assert len(out["metricKeys"]) == 12


def test_clamp_grid_raises_small_w_to_chart_metric_min() -> None:
    out = clamp_grid_position_for_widget_key(
        "chart_metric",
        {"x": 0, "y": 0, "w": 2, "h": 2},
    )
    assert out["w"] >= 5
    assert out["h"] >= 4
    assert out["minW"] == 5
    assert out["minH"] == 4


def test_clamp_grid_defaults_wh_when_missing() -> None:
    out = clamp_grid_position_for_widget_key("tasks", {"x": 1, "y": 2})
    assert out["w"] == 4
    assert out["h"] == 5
    assert out["minW"] == 3
    assert out["minH"] == 3


def test_clamp_grid_unknown_key_passthrough_copy() -> None:
    raw = {"x": 0, "w": 1, "h": 1}
    out = clamp_grid_position_for_widget_key("future_widget", raw)
    assert out == raw


def test_clamp_grid_raises_low_minW() -> None:
    out = clamp_grid_position_for_widget_key(
        "chart_metric",
        {"w": 6, "h": 5, "minW": 2, "minH": 4},
    )
    assert out["minW"] == 5
    assert out["w"] >= 5
