# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Prometheus metrics registry for KBSEW ingest, search, and worker state.
# Invariants:
# - Metrics helpers never raise into request or worker paths.
# ---

from __future__ import annotations

import logging
from contextlib import suppress

from prometheus_client import (
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

logger = logging.getLogger(__name__)

kbsew_registry = CollectorRegistry()

kbsew_ingest_success = Counter(
    "kbsew_ingest_success",
    "Successful KBSEW ingestion jobs.",
    ("source_kind",),
    registry=kbsew_registry,
)
kbsew_ingest_failure = Counter(
    "kbsew_ingest_failure",
    "Failed KBSEW ingestion jobs.",
    ("source_kind",),
    registry=kbsew_registry,
)
kbsew_search_latency_seconds = Histogram(
    "kbsew_search_latency_seconds",
    "KBSEW semantic search latency in seconds.",
    ("status",),
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
    registry=kbsew_registry,
)
kbsew_hybrid_sparse_skip = Counter(
    "kbsew_hybrid_sparse_skip_total",
    "KBSEW hybrid search skipped sparse branch (dense degrade).",
    ("reason",),
    registry=kbsew_registry,
)
kbsew_active_jobs = Gauge(
    "kbsew_active_jobs",
    "KBSEW active queued or running ingestion jobs.",
    registry=kbsew_registry,
)
kbsew_search_index_stale = Counter(
    "kbsew_search_index_stale_total",
    "KBSEW search rejected because barrel index pipeline is stale.",
    registry=kbsew_registry,
)
kbsew_stale_assets = Gauge(
    "kbsew_barrel_stale_assets",
    "Last observed stale indexed asset count at search boundary.",
    registry=kbsew_registry,
)


def observe_ingest_success(source_kind: str) -> None:
    with suppress(Exception):
        kbsew_ingest_success.labels(source_kind=source_kind or "unknown").inc()


def observe_ingest_failure(source_kind: str) -> None:
    with suppress(Exception):
        kbsew_ingest_failure.labels(source_kind=source_kind or "unknown").inc()


def observe_search_latency(*, status: str, seconds: float) -> None:
    with suppress(Exception):
        kbsew_search_latency_seconds.labels(status=status or "unknown").observe(max(0.0, float(seconds)))


def observe_hybrid_sparse_skip(reason: str) -> None:
    with suppress(Exception):
        kbsew_hybrid_sparse_skip.labels(reason=reason or "unknown").inc()


def observe_search_index_stale() -> None:
    with suppress(Exception):
        kbsew_search_index_stale.inc()


def set_active_jobs(count: int) -> None:
    with suppress(Exception):
        kbsew_active_jobs.set(max(0, int(count)))


def set_stale_assets(count: int) -> None:
    with suppress(Exception):
        kbsew_stale_assets.set(max(0, int(count)))


def render_prometheus_metrics() -> bytes:
    return generate_latest(kbsew_registry)
