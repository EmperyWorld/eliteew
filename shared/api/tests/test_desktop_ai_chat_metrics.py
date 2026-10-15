# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Prometheus metric helpers for Desktop AI Chat stream/RAG observability.
# Related:
# - api/monitoring/metrics.py
# ---

from __future__ import annotations

from unittest.mock import MagicMock


def test_observe_desktop_ai_chat_stream_increments_counter() -> None:
    from api.monitoring import metrics

    counter = MagicMock()
    summary = MagicMock()
    labels = MagicMock()
    counter.labels.return_value = labels
    summary.labels.return_value = MagicMock()
    original_counter = metrics.desktop_ai_chat_stream_total
    original_summary = metrics.desktop_ai_chat_stream_duration_seconds
    metrics.desktop_ai_chat_stream_total = counter
    metrics.desktop_ai_chat_stream_duration_seconds = summary
    try:
        metrics.observe_desktop_ai_chat_stream(outcome="ok", duration_ms=120)
        counter.labels.assert_called_once_with(outcome="ok")
        labels.inc.assert_called_once()
    finally:
        metrics.desktop_ai_chat_stream_total = original_counter
        metrics.desktop_ai_chat_stream_duration_seconds = original_summary


def test_observe_desktop_ai_chat_rag_empty_increments() -> None:
    from api.monitoring import metrics

    counter = MagicMock()
    labels = MagicMock()
    counter.labels.return_value = labels
    original = metrics.desktop_ai_chat_rag_empty_total
    metrics.desktop_ai_chat_rag_empty_total = counter
    try:
        metrics.observe_desktop_ai_chat_rag_empty(layer="chat_attachments", profile="desktop_ai_chat")
        counter.labels.assert_called_once_with(layer="chat_attachments", profile="desktop_ai_chat")
        labels.inc.assert_called_once()
    finally:
        metrics.desktop_ai_chat_rag_empty_total = original


def test_observe_desktop_stream_coordination_degraded() -> None:
    from api.monitoring import metrics

    counter = MagicMock()
    labels = MagicMock()
    counter.labels.return_value = labels
    original = metrics.desktop_stream_coordination_degraded_total
    metrics.desktop_stream_coordination_degraded_total = counter
    try:
        metrics.observe_desktop_stream_coordination(
            event="degraded",
            mode="degrade",
            reason="redis_unavailable",
            operation="acquire_stream_lock",
        )
        counter.labels.assert_called_once()
        labels.inc.assert_called_once()
    finally:
        metrics.desktop_stream_coordination_degraded_total = original
