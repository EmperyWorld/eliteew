#!/usr/bin/env python3
"""
System Metrics Utilities

Extracted from api/main.py for better code organization.
Provides functions for system resource monitoring and performance metrics.
"""

import logging
from datetime import UTC, datetime
from typing import Any

import psutil  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)


def get_system_uptime() -> str:
    """
    Get system uptime in production-ready format.

    Returns:
        str: Formatted uptime string (e.g., "3d 12h 45m" or "15h 30m")
    """
    try:
        boot_time = psutil.boot_time()
        current_time = datetime.now(UTC).timestamp()
        uptime_seconds = current_time - boot_time

        hours = int(uptime_seconds // 3600)
        minutes = int((uptime_seconds % 3600) // 60)

        if hours > 24:
            days = hours // 24
            hours = hours % 24
            return f"{days}d {hours}h {minutes}m"
        return f"{hours}h {minutes}m"
    except Exception:
        logger.exception("Failed to get system uptime")
        return "unavailable"


async def get_docker_container_count(app_state) -> int:
    """
    Get running Docker containers count via orchestrator.

    Args:
        app_state: FastAPI app.state object with orchestrator

    Returns:
        int: Number of running containers
    """
    try:
        if hasattr(app_state, "orchestrator") and app_state.orchestrator:
            containers = await app_state.orchestrator.list_containers()
            return len([c for c in containers if c.get("State") == "running"])
        return 0
    except Exception:
        logger.exception("Failed to get container count")
        return 0


async def get_real_performance_metrics(app_state) -> dict[str, Any]:
    """
    Get real performance metrics from monitoring service.

    Args:
        app_state: FastAPI app.state object with monitoring service

    Returns:
        dict: Performance metrics or fallback data if service unavailable
    """
    try:
        if hasattr(app_state, "monitoring") and app_state.monitoring:
            return await app_state.monitoring.get_performance_metrics()

        # Fallback to basic metrics if monitoring unavailable
        return {
            "requests_per_minute": "unavailable",
            "average_response_time": "unavailable",
            "success_rate": "unavailable",
            "error_rate": "unavailable",
            "status": "monitoring_service_offline",
        }
    except Exception:
        logger.exception("Error getting performance metrics")
        return {
            "requests_per_minute": "error",
            "average_response_time": "error",
            "success_rate": "error",
            "error_rate": "error",
            "status": "error",
        }


async def get_real_system_resources() -> dict[str, Any]:
    """
    Get real system resource metrics (CPU, memory, GPU, disk).

    Returns:
        dict: System resource usage metrics
    """
    try:
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=0.1)
        cpu_usage = f"{cpu_percent}%"

        # Memory metrics
        memory = psutil.virtual_memory()
        memory_used_gb = memory.used / (1024**3)
        memory_total_gb = memory.total / (1024**3)
        memory_usage = f"{memory_used_gb:.1f}GB / {memory_total_gb:.0f}GB"

        # GPU metrics - production ready
        gpu_usage = "N/A"
        try:
            import subprocess

            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
                check=False,
                capture_output=True,
                text=True,
                timeout=2,
            )
            if result.returncode == 0:
                gpu_percent = result.stdout.strip()
                gpu_usage = f"{gpu_percent}%"
        except Exception:
            # Production: GPU unavailable, no demo data
            gpu_usage = "unavailable"

        # Disk metrics
        try:
            import shutil

            disk = shutil.disk_usage("/")
            disk_used_gb = disk.used / (1024**3)
            disk_total_tb = disk.total / (1024**4)
            disk_usage = f"{disk_used_gb:.1f}GB / {disk_total_tb:.1f}TB"
        except Exception:
            disk_usage = "unavailable"

        return {
            "cpu_usage": cpu_usage,
            "memory_usage": memory_usage,
            "gpu_usage": gpu_usage,
            "disk_usage": disk_usage,
            "timestamp": datetime.now(UTC).isoformat(),
        }
    except Exception:
        logger.exception("Error getting system resources")
        return {
            "cpu_usage": "error",
            "memory_usage": "error",
            "gpu_usage": "error",
            "disk_usage": "error",
            "status": "error",
        }
