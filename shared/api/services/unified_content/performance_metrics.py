# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# In-process performance counters for Unified Content (operations, cache, download tickets).
# Invariants:
# - Metrics are process-local singletons; reset clears all counters including download tickets.
# Related:
# - api/services/unified_content/content_download_ticket_service.py
# - api/services/unified_content/content_admin_ops_service.py
# ---
"""Performance metrics and monitoring for Unified Content API."""

import json
import logging
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)


class PerformanceMetrics:
    """
    Central metrics collection for unified content system

    Metrics Categories:
    - Operations: Count and timing for each operation type
    - Errors: Error counts by type
    - Cache: Hit/miss rates
    - Storage: File sizes and backend usage
    - Database: Query timing and counts
    """

    def __init__(self) -> None:
        """Initialize metrics collectors"""
        # Operation timing (running average)
        self.operation_timings: dict[str, list[float]] = defaultdict(list)
        self.operation_counts: dict[str, int] = defaultdict(int)

        # Error tracking
        self.error_counts: dict[str, int] = defaultdict(int)
        self.last_errors: dict[str, str] = {}

        # Cache metrics
        self.cache_hits: int = 0
        self.cache_misses: int = 0

        # Storage metrics
        self.bytes_uploaded: int = 0
        self.bytes_downloaded: int = 0
        self.files_uploaded: int = 0
        self.files_downloaded: int = 0

        # Database metrics
        self.db_query_count: int = 0
        self.db_query_timings: list[float] = []

        # Download ticket metrics (opaque Redis tickets for browser-native downloads)
        self.download_ticket_issue_ok: int = 0
        self.download_ticket_issue_fail: int = 0
        self.download_ticket_consume_ok: int = 0
        self.download_ticket_consume_fail: int = 0
        self.download_ticket_issue_by_kind: dict[str, int] = defaultdict(int)
        self.download_ticket_consume_fail_by_reason: dict[str, int] = defaultdict(int)

        # Start time
        self.start_time = datetime.now(UTC)

    @asynccontextmanager  # type: ignore[arg-type,misc]
    async def track_operation(self, operation_name: str):  # type: ignore[misc,return]
        """
        Context manager to track operation timing

        Usage:
            async with metrics.track_operation("upload_file"):
                await upload_file()
        """
        start_time = time.time()

        try:
            yield
            # Success
            elapsed = time.time() - start_time
            self.record_operation(operation_name, elapsed, success=True)

        except Exception as e:
            # Error
            elapsed = time.time() - start_time
            self.record_operation(operation_name, elapsed, success=False)
            self.record_error(operation_name, str(e))
            raise

    def record_operation(self, operation: str, duration: float, success: bool = True) -> None:
        """
        Record operation timing and count

        Args:
            operation: Operation name
            duration: Duration in seconds
            success: Whether operation succeeded
        """
        self.operation_counts[operation] += 1

        # Keep last 1000 timings for running average
        self.operation_timings[operation].append(duration)
        if len(self.operation_timings[operation]) > 1000:
            self.operation_timings[operation].pop(0)

        if not success:
            self.operation_counts[f"{operation}_failed"] += 1

        # Log slow operations
        if duration > 1.0:  # More than 1 second
            logger.warning("Slow operation detected: %s took %.2fs", operation, duration)

    def record_error(self, operation: str, error_message: str) -> None:
        """
        Record error occurrence

        Args:
            operation: Operation that failed
            error_message: Error message
        """
        error_key = f"{operation}_error"
        self.error_counts[error_key] += 1
        self.last_errors[error_key] = error_message

        logger.error("Error in %s: %s", operation, error_message)

    def record_cache_hit(self) -> None:
        """Record cache hit"""
        self.cache_hits += 1

    def record_cache_miss(self) -> None:
        """Record cache miss"""
        self.cache_misses += 1

    def record_upload(self, file_size: int) -> None:
        """
        Record file upload

        Args:
            file_size: Size of uploaded file in bytes
        """
        self.files_uploaded += 1
        self.bytes_uploaded += file_size

    def record_download(self, file_size: int) -> None:
        """
        Record file download

        Args:
            file_size: Size of downloaded file in bytes
        """
        self.files_downloaded += 1
        self.bytes_downloaded += file_size

    def record_download_ticket_issue(self, *, kind: str, success: bool) -> None:
        """Record download ticket mint outcome (server-side; FE blob fallback follows issue_fail)."""
        normalized_kind = str(kind or "unknown").strip() or "unknown"
        if success:
            self.download_ticket_issue_ok += 1
            self.download_ticket_issue_by_kind[normalized_kind] += 1
            return
        self.download_ticket_issue_fail += 1

    def record_download_ticket_consume(
        self,
        *,
        kind: str,
        success: bool,
        reason: str | None = None,
    ) -> None:
        """Record download ticket consumption outcome with optional failure reason bucket."""
        _ = kind
        if success:
            self.download_ticket_consume_ok += 1
            return
        self.download_ticket_consume_fail += 1
        normalized_reason = str(reason or "unknown").strip() or "unknown"
        self.download_ticket_consume_fail_by_reason[normalized_reason] += 1

    def get_download_ticket_metrics(self) -> dict[str, Any]:
        """Return download-ticket counter snapshot for admin diagnostics."""
        return {
            "issue_ok": self.download_ticket_issue_ok,
            "issue_fail": self.download_ticket_issue_fail,
            "consume_ok": self.download_ticket_consume_ok,
            "consume_fail": self.download_ticket_consume_fail,
            "issue_by_kind": dict(self.download_ticket_issue_by_kind),
            "consume_fail_by_reason": dict(self.download_ticket_consume_fail_by_reason),
            "blob_fallback_expected": self.download_ticket_issue_fail,
        }

    def record_db_query(self, duration: float) -> None:
        """
        Record database query timing

        Args:
            duration: Query duration in seconds
        """
        self.db_query_count += 1
        self.db_query_timings.append(duration)

        # Keep last 1000 timings
        if len(self.db_query_timings) > 1000:
            self.db_query_timings.pop(0)

        # Log slow queries
        if duration > 0.5:  # More than 500ms
            logger.warning("Slow database query: %.3fs", duration)

    def get_cache_hit_rate(self) -> float:
        """
        Calculate cache hit rate

        Returns:
            Hit rate as percentage (0-100)
        """
        total = self.cache_hits + self.cache_misses
        if total == 0:
            return 0.0

        return (self.cache_hits / total) * 100

    def get_average_operation_time(self, operation: str) -> float:
        """
        Get average operation time

        Args:
            operation: Operation name

        Returns:
            Average time in seconds
        """
        timings = self.operation_timings.get(operation, [])
        if not timings:
            return 0.0

        return sum(timings) / len(timings)

    def get_average_db_query_time(self) -> float:
        """
        Get average database query time

        Returns:
            Average time in seconds
        """
        if not self.db_query_timings:
            return 0.0

        return sum(self.db_query_timings) / len(self.db_query_timings)

    def get_error_rate(self, operation: str) -> float:
        """
        Calculate error rate for operation

        Args:
            operation: Operation name

        Returns:
            Error rate as percentage (0-100)
        """
        total = self.operation_counts.get(operation, 0)
        failed = self.operation_counts.get(f"{operation}_failed", 0)

        if total == 0:
            return 0.0

        return (failed / total) * 100

    def get_uptime(self) -> timedelta:
        """
        Get service uptime

        Returns:
            Uptime duration
        """
        return datetime.now(UTC) - self.start_time

    def get_summary(self) -> dict[str, Any]:
        """
        Get metrics summary

        Returns:
            (dict[str, Any]) with all metrics
        """
        uptime = self.get_uptime()

        return {
            "uptime_seconds": uptime.total_seconds(),
            "uptime_human": str(uptime),
            "operations": {
                "counts": dict(self.operation_counts),
                "average_timings": {op: self.get_average_operation_time(op) for op in self.operation_timings},
            },
            "cache": {
                "hits": self.cache_hits,
                "misses": self.cache_misses,
                "hit_rate_percent": self.get_cache_hit_rate(),
            },
            "storage": {
                "files_uploaded": self.files_uploaded,
                "files_downloaded": self.files_downloaded,
                "bytes_uploaded": self.bytes_uploaded,
                "bytes_downloaded": self.bytes_downloaded,
                "gb_uploaded": self.bytes_uploaded / (1024**3),
                "gb_downloaded": self.bytes_downloaded / (1024**3),
            },
            "database": {
                "query_count": self.db_query_count,
                "average_query_time_ms": self.get_average_db_query_time() * 1000,
            },
            "errors": {"counts": dict(self.error_counts), "last_errors": dict(self.last_errors)},
            "download_tickets": self.get_download_ticket_metrics(),
        }

    def get_prometheus_metrics(self) -> str:
        """
        Export metrics in Prometheus format

        Returns:
            Prometheus-formatted metrics string
        """
        lines = [
            "# HELP unified_content_operations_total Total number of operations",
            "# TYPE unified_content_operations_total counter",
        ]

        for operation, count in self.operation_counts.items():
            lines.append(f'unified_content_operations_total{{operation="{operation}"}} {count}')

        lines.extend(
            [
                "",
                "# HELP unified_content_operation_duration_seconds Operation duration",
                "# TYPE unified_content_operation_duration_seconds gauge",
            ]
        )

        for operation in self.operation_timings:
            avg_time = self.get_average_operation_time(operation)
            lines.append(f'unified_content_operation_duration_seconds{{operation="{operation}"}} {avg_time}')

        lines.extend(
            [
                "",
                "# HELP unified_content_cache_hits_total Cache hits",
                "# TYPE unified_content_cache_hits_total counter",
                f"unified_content_cache_hits_total {self.cache_hits}",
                "",
                "# HELP unified_content_cache_misses_total Cache misses",
                "# TYPE unified_content_cache_misses_total counter",
                f"unified_content_cache_misses_total {self.cache_misses}",
                "",
                "# HELP unified_content_bytes_uploaded_total Bytes uploaded",
                "# TYPE unified_content_bytes_uploaded_total counter",
                f"unified_content_bytes_uploaded_total {self.bytes_uploaded}",
                "",
                "# HELP unified_content_bytes_downloaded_total Bytes downloaded",
                "# TYPE unified_content_bytes_downloaded_total counter",
                f"unified_content_bytes_downloaded_total {self.bytes_downloaded}",
                "",
                "# HELP unified_content_db_queries_total Database queries",
                "# TYPE unified_content_db_queries_total counter",
                f"unified_content_db_queries_total {self.db_query_count}",
                "",
                "# HELP unified_content_download_ticket_issue_ok_total Successful ticket mints",
                "# TYPE unified_content_download_ticket_issue_ok_total counter",
                f"unified_content_download_ticket_issue_ok_total {self.download_ticket_issue_ok}",
                "",
                "# HELP unified_content_download_ticket_issue_fail_total Failed ticket mints",
                "# TYPE unified_content_download_ticket_issue_fail_total counter",
                f"unified_content_download_ticket_issue_fail_total {self.download_ticket_issue_fail}",
                "",
                "# HELP unified_content_download_ticket_consume_ok_total Successful ticket consumes",
                "# TYPE unified_content_download_ticket_consume_ok_total counter",
                f"unified_content_download_ticket_consume_ok_total {self.download_ticket_consume_ok}",
                "",
                "# HELP unified_content_download_ticket_consume_fail_total Failed ticket consumes",
                "# TYPE unified_content_download_ticket_consume_fail_total counter",
                f"unified_content_download_ticket_consume_fail_total {self.download_ticket_consume_fail}",
                "",
            ]
        )

        return "\n".join(lines)

    def reset(self) -> None:
        """Reset all metrics (use with caution)"""
        self.operation_timings.clear()
        self.operation_counts.clear()
        self.error_counts.clear()
        self.last_errors.clear()
        self.cache_hits = 0
        self.cache_misses = 0
        self.bytes_uploaded = 0
        self.bytes_downloaded = 0
        self.files_uploaded = 0
        self.files_downloaded = 0
        self.db_query_count = 0
        self.db_query_timings.clear()
        self.download_ticket_issue_ok = 0
        self.download_ticket_issue_fail = 0
        self.download_ticket_consume_ok = 0
        self.download_ticket_consume_fail = 0
        self.download_ticket_issue_by_kind.clear()
        self.download_ticket_consume_fail_by_reason.clear()
        self.start_time = datetime.now(UTC)

        logger.info("Metrics reset")


# Global metrics instance
_metrics_instance: PerformanceMetrics | None = None


def get_metrics() -> PerformanceMetrics:
    """
    Get global metrics instance (singleton)

    Returns:
        PerformanceMetrics instance
    """
    global _metrics_instance
    if _metrics_instance is None:
        _metrics_instance = PerformanceMetrics()
    return _metrics_instance


class StructuredLogger:
    """
    Structured logging for unified content operations

    Logs in JSON format for easy parsing and analysis
    """

    def __init__(self, logger_name: str = __name__):
        """
        Initialize structured logger

        Args:
            logger_name: Logger name
        """
        self.logger = logging.getLogger(logger_name)

    def log_operation(
        self,
        operation: str,
        user_id: str,
        content_id: str | None = None,
        duration: float | None = None,
        success: bool = True,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """
        Log operation with structured data

        Args:
            operation: Operation name
            user_id: User ID
            content_id: Content ID (optional)
            duration: Operation duration (optional)
            success: Whether operation succeeded
            metadata: Additional metadata
        """
        log_data = {
            "timestamp": datetime.now(UTC).isoformat(),
            "operation": operation,
            "user_id": user_id,
            "content_id": content_id,
            "duration_ms": round(duration * 1000, 2) if duration else None,
            "success": success,
            "metadata": metadata or {},
        }

        log_message = json.dumps(log_data)

        if success:
            self.logger.info(log_message)
        else:
            self.logger.error(log_message)

    def log_error(
        self,
        operation: str,
        error: Exception,
        user_id: str | None = None,
        content_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """
        Log error with structured data

        Args:
            operation: Operation name
            error: Exception object
            user_id: User ID (optional)
            content_id: Content ID (optional)
            metadata: Additional metadata
        """
        log_data = {
            "timestamp": datetime.now(UTC).isoformat(),
            "operation": operation,
            "user_id": user_id,
            "content_id": content_id,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "metadata": metadata or {},
        }

        log_message = json.dumps(log_data)
        self.logger.error(log_message, exc_info=True)
