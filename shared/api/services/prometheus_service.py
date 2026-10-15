#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/prometheus_service.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""
ðâï¸ Ð§ÐÐ¡Ð¢ÐÐ«Ð PROMETHEUS SERVICE - Ð¢ÐÐÐ¬ÐÐ Ð ÐÐÐÐ¬ÐÐ«Ð ÐÐÐÐÐ«Ð! âï¸ð
ÐÐ´Ð¸Ð½Ð°Ñ ÑÐ¾ÑÐºÐ° Ð´Ð¾ÑÑÑÐ¿Ð° ÐºÐ¾ Ð²ÑÐµÐ¼ Ð¼ÐµÑÑÐ¸ÐºÐ°Ð¼ Prometheus
"""

import asyncio
import logging
from datetime import datetime
from typing import Any

import aiohttp  # type: ignore[import-not-found]

from api.core.unified_config import unified_settings

logger = logging.getLogger(__name__)


class PrometheusService:
    """Ð§ÐµÑÑÐ½ÑÐ¹ ÑÐµÑÐ²Ð¸Ñ Ð´Ð»Ñ ÑÐ°Ð±Ð¾ÑÑ Ñ Prometheus Ð¼ÐµÑÑÐ¸ÐºÐ°Ð¼Ð¸"""

    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or unified_settings.prometheus_url).rstrip("/")
        self.timeout = aiohttp.ClientTimeout(total=30)
        # ð§ ÐÐ ÐÐ¢ÐÐ§ÐÐ¡ÐÐÐ ÐÐ¡ÐÐ ÐÐÐÐÐÐÐ: Shared session Ð´Ð»Ñ connection reuse
        self._session = None
        self.enable_cadvisor_metrics = unified_settings.enable_cadvisor_metrics

        # ð Ð§ÐÐ¡Ð¢ÐÐ«Ð PROMETHEUS ÐÐÐÐ ÐÐ¡Ð« ÐÐÐ¯ Ð ÐÐÐÐ«Ð¥ Ð­ÐÐ¡ÐÐÐ Ð¢ÐÐ ÐÐ ð
        self.queries = {
            # === NODE EXPORTER (32019) - Ð¡Ð¸ÑÑÐµÐ¼Ð½ÑÐµ Ð¼ÐµÑÑÐ¸ÐºÐ¸ ===
            "system_cpu_usage": '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
            "system_memory_usage": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
            "system_memory_total": "node_memory_MemTotal_bytes / 1024 / 1024 / 1024",  # GB
            "system_memory_available": "node_memory_MemAvailable_bytes / 1024 / 1024 / 1024",  # GB
            "system_disk_usage": '100 - ((node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100)',
            "system_disk_total": 'node_filesystem_size_bytes{mountpoint="/"} / 1024 / 1024 / 1024',  # GB
            "system_disk_free": 'node_filesystem_avail_bytes{mountpoint="/"} / 1024 / 1024 / 1024',  # GB
            "system_load_1": "node_load1",
            "system_load_5": "node_load5",
            "system_load_15": "node_load15",
            "system_uptime": "node_time_seconds - node_boot_time_seconds",
            "system_cpu_cores": "count(count(node_cpu_seconds_total) by (cpu))",
            "system_network_rx": 'sum(rate(node_network_receive_bytes_total{device!="lo"}[5m]))',
            "system_network_tx": 'sum(rate(node_network_transmit_bytes_total{device!="lo"}[5m]))',
            "system_disk_io_read": "sum(rate(node_disk_read_bytes_total[5m]))",
            "system_disk_io_write": "sum(rate(node_disk_written_bytes_total[5m]))",
            "system_processes_running": "node_procs_running",
            "system_processes_blocked": "node_procs_blocked",
            # === DCGM EXPORTER (32020) - NVIDIA GPU Ð¼ÐµÑÑÐ¸ÐºÐ¸ ===
            "gpu_usage": "DCGM_FI_DEV_GPU_UTIL",
            "gpu_memory_used": "DCGM_FI_DEV_FB_USED",
            "gpu_memory_total": "DCGM_FI_DEV_FB_TOTAL",
            "gpu_memory_usage_percent": "(DCGM_FI_DEV_FB_USED / DCGM_FI_DEV_FB_TOTAL) * 100",
            "gpu_temperature": "DCGM_FI_DEV_GPU_TEMP",
            "gpu_power_usage": "DCGM_FI_DEV_POWER_USAGE",
            "gpu_sm_clock": "DCGM_FI_DEV_SM_CLOCK",
            "gpu_mem_clock": "DCGM_FI_DEV_MEM_CLOCK",
            "gpu_encoder_usage": "DCGM_FI_DEV_ENC_UTIL",
            "gpu_decoder_usage": "DCGM_FI_DEV_DEC_UTIL",
        }

        if self.enable_cadvisor_metrics:
            self.queries.update(
                {
                    # === МОНИТОРИНГ СЕРВИСЫ ===
                    "monitoring_prometheus_cpu": 'rate(container_cpu_usage_seconds_total{name=~".*prometheus.*"}[5m]) * 100',
                    "monitoring_prometheus_memory": 'container_memory_usage_bytes{name=~".*prometheus.*"} / 1024 / 1024',
                    "monitoring_grafana_cpu": 'rate(container_cpu_usage_seconds_total{name=~".*grafana.*"}[5m]) * 100',
                    "monitoring_grafana_memory": 'container_memory_usage_bytes{name=~".*grafana.*"} / 1024 / 1024',
                    # === DEVOPS СТЕК ===
                    "devops_jenkins_cpu": 'rate(container_cpu_usage_seconds_total{name=~".*jenkins.*"}[5m]) * 100',
                    "devops_jenkins_memory": 'container_memory_usage_bytes{name=~".*jenkins.*"} / 1024 / 1024',
                    "devops_gitlab_cpu": 'rate(container_cpu_usage_seconds_total{name=~".*gitlab.*"}[5m]) * 100',
                    "devops_gitlab_memory": 'container_memory_usage_bytes{name=~".*gitlab.*"} / 1024 / 1024',
                    "docker_containers_total": "count(container_last_seen)",
                    "docker_containers_running": 'count(container_last_seen{name!=""})',
                    "docker_cpu_usage": 'sum(rate(container_cpu_usage_seconds_total{name!=""}[5m])) * 100',
                    "docker_memory_usage": 'sum(container_memory_usage_bytes{name!=""}) / 1024 / 1024 / 1024',
                    "docker_memory_limit": 'sum(container_spec_memory_limit_bytes{name!=""}) / 1024 / 1024 / 1024',
                    "docker_network_rx": 'sum(rate(container_network_receive_bytes_total{name!=""}[5m]))',
                    "docker_network_tx": 'sum(rate(container_network_transmit_bytes_total{name!=""}[5m]))',
                    "docker_disk_read": 'sum(rate(container_fs_reads_bytes_total{name!=""}[5m]))',
                    "docker_disk_write": 'sum(rate(container_fs_writes_bytes_total{name!=""}[5m]))',
                    "ai_llama_cpu": 'rate(container_cpu_usage_seconds_total{name=~".*llama.*"}[5m]) * 100',
                    "ai_llama_memory": 'container_memory_usage_bytes{name=~".*llama.*"} / 1024 / 1024',
                    "ai_llama_network_rx": 'rate(container_network_receive_bytes_total{name=~".*llama.*"}[5m])',
                    "ai_llama_network_tx": 'rate(container_network_transmit_bytes_total{name=~".*llama.*"}[5m])',
                    "ai_comfyui_cpu": 'rate(container_cpu_usage_seconds_total{name=~".*comfyui.*"}[5m]) * 100',
                    "ai_comfyui_memory": 'container_memory_usage_bytes{name=~".*comfyui.*"} / 1024 / 1024',
                    "ai_comfyui_network_rx": 'rate(container_network_receive_bytes_total{name=~".*comfyui.*"}[5m])',
                }
            )

    async def _get_session(self) -> aiohttp.ClientSession:
        """Use central HTTP session (closed at app shutdown)."""
        from api.core.http_clients import get_aiohttp_session

        return get_aiohttp_session()

    async def _close_session(self) -> None:
        """Central session is closed at app shutdown; just clear ref."""
        self._session = None

    async def query_metric(self, query: str) -> float | None:
        """ÐÑÐ¿Ð¾Ð»Ð½Ð¸ÑÑ Ð·Ð°Ð¿ÑÐ¾Ñ Ðº Prometheus Ð¸ Ð¿Ð¾Ð»ÑÑÐ¸ÑÑ ÐµÐ´Ð¸Ð½Ð¸ÑÐ½Ð¾Ðµ Ð·Ð½Ð°ÑÐµÐ½Ð¸Ðµ"""
        try:
            session = await self._get_session()
            async with session.get(f"{self.base_url}/api/v1/query", params={"query": query}) as response:
                if response.status == 200:
                    data = await response.json()
                    result = data.get("data", {}).get("result", [])
                    if result and len(result) > 0:
                        return float(result[0]["value"][1])
                return None
        except Exception as e:
            logger.warning(f"Prometheus metric query failed for '{query}': {e}")
            return None

    async def _firing_alerts_count(self) -> int:
        """Cluster-wide firing alerts from Prometheus `ALERTS` (0 if unavailable)."""
        val = await self.query_metric('count(ALERTS{alertstate="firing"})')
        if val is None:
            return 0
        try:
            return max(0, int(round(val)))
        except (TypeError, ValueError):  # fmt: skip
            return 0

    async def query_range(self, query: str, start: datetime, end: datetime, step: str = "1m") -> list[dict[str, Any]]:
        """ÐÑÐ¿Ð¾Ð»Ð½Ð¸ÑÑ range Ð·Ð°Ð¿ÑÐ¾Ñ Ð´Ð»Ñ Ð¿Ð¾Ð»ÑÑÐµÐ½Ð¸Ñ Ð²ÑÐµÐ¼ÐµÐ½Ð½Ð¾Ð³Ð¾ ÑÑÐ´Ð°"""
        try:
            params = {"query": query, "start": start.timestamp(), "end": end.timestamp(), "step": step}

            session = await self._get_session()
            async with session.get(f"{self.base_url}/api/v1/query_range", params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    result = data.get("data", {}).get("result", [])
                    if result and len(result) > 0:
                        values = result[0].get("values", [])
                        return [{"timestamp": float(v[0]), "value": float(v[1])} for v in values]
                return []
        except Exception as e:
            logger.warning(f"Prometheus range query failed for '{query}': {e}")
            return []

    async def get_multiple_metrics(self, metric_names: list[str]) -> dict[str, float]:
        """ÐÐ¾Ð»ÑÑÐ¸ÑÑ Ð½ÐµÑÐºÐ¾Ð»ÑÐºÐ¾ Ð¼ÐµÑÑÐ¸Ðº Ð¿Ð°ÑÐ°Ð»Ð»ÐµÐ»ÑÐ½Ð¾ Ñ ÑÐ»ÑÑÑÐµÐ½Ð½ÑÐ¼Ð¸ ÑÐ°Ð¹Ð¼Ð°ÑÑÐ°Ð¼Ð¸"""
        # ð§ ÐÐ¡ÐÐ ÐÐÐÐÐÐÐ: Ð£Ð²ÐµÐ»Ð¸ÑÐµÐ½Ð½ÑÐµ timeouts Ð¸ batch processing
        batch_size = 5  # Ð£Ð¼ÐµÐ½ÑÑÐ°ÐµÐ¼ Ð¿Ð°ÑÐ°Ð»Ð»ÐµÐ»ÑÐ½ÑÑ Ð½Ð°Ð³ÑÑÐ·ÐºÑ
        timeout_per_query = 8.0  # Ð£Ð²ÐµÐ»Ð¸ÑÐµÐ½Ð½ÑÐ¹ timeout

        results = {}

        # ÐÐ±ÑÐ°Ð±Ð°ÑÑÐ²Ð°ÐµÐ¼ Ð¼ÐµÑÑÐ¸ÐºÐ¸ Ð±Ð°ÑÑÐ°Ð¼Ð¸ Ð´Ð»Ñ Ð¿ÑÐµÐ´Ð¾ÑÐ²ÑÐ°ÑÐµÐ½Ð¸Ñ timeout cascade
        for i in range(0, len(metric_names), batch_size):
            batch = metric_names[i : i + batch_size]
            names_order: list[str] = []
            pending: list[Any] = []

            for name in batch:
                if name in self.queries:
                    q = self.queries[name]
                    names_order.append(name)

                    async def _run(query: str = q) -> Any:
                        async with asyncio.timeout(timeout_per_query):
                            return await self.query_metric(query)

                    pending.append(_run())

            if pending:
                try:
                    completed = await asyncio.gather(*pending, return_exceptions=True)

                    for j, name in enumerate(names_order):
                        value = completed[j]
                        if isinstance(value, TimeoutError):
                            logger.warning("Metric %s timeout after %ss", name, timeout_per_query)
                            results[name] = 0.0
                        elif isinstance(value, Exception):
                            logger.warning("Metric %s failed: %s", name, type(value).__name__)
                            results[name] = 0.0
                        elif isinstance(value, (int, float)) and value is not None:
                            results[name] = float(value)
                        else:
                            results[name] = 0.0

                except Exception as e:
                    logger.exception("Prometheus batch processing error: %s", e)
                    for name in names_order:
                        results[name] = 0.0

            # ÐÐ¾ÑÐ¾ÑÐºÐ°Ñ Ð¿Ð°ÑÐ·Ð° Ð¼ÐµÐ¶Ð´Ñ Ð±Ð°ÑÑÐ°Ð¼Ð¸
            await asyncio.sleep(0.1)

        return results

    async def get_system_metrics(self) -> dict[str, Any]:
        """ÐÐ¾Ð»ÑÑÐ¸ÑÑ Ð²ÑÐµ ÑÐ¸ÑÑÐµÐ¼Ð½ÑÐµ Ð¼ÐµÑÑÐ¸ÐºÐ¸"""
        system_metric_names = [
            "system_cpu_usage",
            "system_memory_usage",
            "system_memory_total",
            "system_memory_available",
            "system_disk_usage",
            "system_disk_total",
            "system_disk_free",
            "system_load_1",
            "system_load_5",
            "system_load_15",
            "system_uptime",
            "system_cpu_cores",
            "system_network_rx",
            "system_network_tx",
            "system_disk_io_read",
            "system_disk_io_write",
            "system_processes_running",
            "system_processes_blocked",
        ]

        metrics = await self.get_multiple_metrics(system_metric_names)

        return {
            "cpu": {
                "usage_percent": round(metrics.get("system_cpu_usage", 0), 1),
                "cores": int(metrics.get("system_cpu_cores", 8)),
                "load_avg": [
                    round(metrics.get("system_load_1", 0), 2),
                    round(metrics.get("system_load_5", 0), 2),
                    round(metrics.get("system_load_15", 0), 2),
                ],
            },
            "memory": {
                "usage_percent": round(metrics.get("system_memory_usage", 0), 1),
                "total_gb": round(metrics.get("system_memory_total", 0), 1),
                "used_gb": round(
                    (metrics.get("system_memory_total", 0) * metrics.get("system_memory_usage", 0)) / 100, 1
                ),
                "available_gb": round(metrics.get("system_memory_available", 0), 1),
            },
            "disk": {
                "usage_percent": round(metrics.get("system_disk_usage", 0), 1),
                "total_gb": round(metrics.get("system_disk_total", 0), 1),
                "used_gb": round((metrics.get("system_disk_total", 0) * metrics.get("system_disk_usage", 0)) / 100, 1),
                "free_gb": round(metrics.get("system_disk_free", 0), 1),
                "io_read_bps": round(metrics.get("system_disk_io_read", 0), 0),
                "io_write_bps": round(metrics.get("system_disk_io_write", 0), 0),
            },
            "network": {
                "rx_bps": round(metrics.get("system_network_rx", 0), 0),
                "tx_bps": round(metrics.get("system_network_tx", 0), 0),
                "total_bps": round(metrics.get("system_network_rx", 0) + metrics.get("system_network_tx", 0), 0),
            },
            "processes": {
                "running": int(metrics.get("system_processes_running", 0)),
                "blocked": int(metrics.get("system_processes_blocked", 0)),
            },
            "uptime": {
                "seconds": int(metrics.get("system_uptime", 0)),
                "hours": int(metrics.get("system_uptime", 0) // 3600),
                "formatted": self._format_uptime(int(metrics.get("system_uptime", 0))),
            },
        }

    async def get_gpu_metrics(self) -> dict[str, Any]:
        """ÐÐ¾Ð»ÑÑÐ¸ÑÑ Ð¼ÐµÑÑÐ¸ÐºÐ¸ GPU ÑÐµÑÐµÐ· DCGM Exporter"""
        gpu_metric_names = [
            "gpu_usage",
            "gpu_memory_used",
            "gpu_memory_total",
            "gpu_memory_usage_percent",
            "gpu_temperature",
            "gpu_power_usage",
            "gpu_sm_clock",
            "gpu_mem_clock",
            "gpu_encoder_usage",
            "gpu_decoder_usage",
        ]

        metrics = await self.get_multiple_metrics(gpu_metric_names)

        # ÐÑÐ¾Ð²ÐµÑÑÐµÐ¼ Ð´Ð¾ÑÑÑÐ¿Ð½Ð¾ÑÑÑ GPU
        gpu_available = any(metrics.get(name, 0) > 0 for name in ["gpu_usage", "gpu_memory_total", "gpu_temperature"])

        return {
            "available": gpu_available,
            "usage_percent": round(metrics.get("gpu_usage", 0), 1),
            "memory": {
                "used_mb": round(metrics.get("gpu_memory_used", 0), 0),
                "total_mb": round(metrics.get("gpu_memory_total", 0), 0),
                "usage_percent": round(metrics.get("gpu_memory_usage_percent", 0), 1),
            },
            "temperature_c": round(metrics.get("gpu_temperature", 0), 1),
            "power_watts": round(metrics.get("gpu_power_usage", 0), 1),
            "clocks": {
                "sm_mhz": round(metrics.get("gpu_sm_clock", 0), 0),
                "memory_mhz": round(metrics.get("gpu_mem_clock", 0), 0),
            },
            "utilization": {
                "encoder_percent": round(metrics.get("gpu_encoder_usage", 0), 1),
                "decoder_percent": round(metrics.get("gpu_decoder_usage", 0), 1),
            },
        }

    async def get_docker_metrics(self) -> dict[str, Any]:
        """Получить метрики Docker через cAdvisor"""
        if not self.enable_cadvisor_metrics:
            return {}

        docker_metric_names = [
            "docker_containers_total",
            "docker_containers_running",
            "docker_cpu_usage",
            "docker_memory_usage",
            "docker_memory_limit",
            "docker_network_rx",
            "docker_network_tx",
            "docker_disk_read",
            "docker_disk_write",
        ]

        metrics = await self.get_multiple_metrics(docker_metric_names)

        return {
            "containers": {
                "total": int(metrics.get("docker_containers_total", 0)),
                "running": int(metrics.get("docker_containers_running", 0)),
                "stopped": max(
                    0, int(metrics.get("docker_containers_total", 0)) - int(metrics.get("docker_containers_running", 0))
                ),
            },
            "resources": {
                "cpu_usage_percent": round(metrics.get("docker_cpu_usage", 0), 1),
                "memory_usage_gb": round(metrics.get("docker_memory_usage", 0), 1),
                "memory_limit_gb": round(metrics.get("docker_memory_limit", 0), 1),
            },
            "network": {
                "rx_bps": round(metrics.get("docker_network_rx", 0), 0),
                "tx_bps": round(metrics.get("docker_network_tx", 0), 0),
            },
            "storage": {
                "read_bps": round(metrics.get("docker_disk_read", 0), 0),
                "write_bps": round(metrics.get("docker_disk_write", 0), 0),
            },
        }

    async def get_ai_services_metrics(self) -> dict[str, Any]:
        """Получить метрики AI сервисов"""

        if not self.enable_cadvisor_metrics:
            return {}

        ai_metric_names = [
            "ai_llama_cpu",
            "ai_llama_memory",
            "ai_llama_network_rx",
            "ai_llama_network_tx",
            "ai_comfyui_cpu",
            "ai_comfyui_memory",
            "ai_comfyui_network_rx",
        ]

        metrics = await self.get_multiple_metrics(ai_metric_names)

        return {
            "llama": {
                "cpu_percent": round(metrics.get("ai_llama_cpu", 0), 1),
                "memory_mb": round(metrics.get("ai_llama_memory", 0), 0),
                "network_rx_bps": round(metrics.get("ai_llama_network_rx", 0), 0),
                "network_tx_bps": round(metrics.get("ai_llama_network_tx", 0), 0),
            },
            "comfyui": {
                "cpu_percent": round(metrics.get("ai_comfyui_cpu", 0), 1),
                "memory_mb": round(metrics.get("ai_comfyui_memory", 0), 0),
                "network_rx_bps": round(metrics.get("ai_comfyui_network_rx", 0), 0),
            },
        }

    async def get_service_list(self) -> list[dict[str, Any]]:
        """Получить список всех сервисов из Docker метрик"""
        if not self.enable_cadvisor_metrics:
            return []

        try:
            # ð§ ÐÐ¡ÐÐ ÐÐÐÐÐÐ: ÐÑÐ¿Ð¾Ð»ÑÐ·ÑÐµÐ¼ Ð¿ÑÐ°Ð²Ð¸Ð»ÑÐ½ÑÐ¹ query Ð´Ð»Ñ Docker ÐºÐ¾Ð½ÑÐµÐ¹Ð½ÐµÑÐ¾Ð²
            query = 'group by (id, name) (container_cpu_usage_seconds_total{id=~".*docker-.*"})'

            async with (
                aiohttp.ClientSession(timeout=self.timeout) as session,
                session.get(f"{self.base_url}/api/v1/query", params={"query": query}) as response,
            ):
                if response.status != 200:
                    logger.warning(f"Prometheus query failed: HTTP {response.status}")
                    return []

                data = await response.json()
                results = data.get("data", {}).get("result", [])

                logger.info(f"Found {len(results)} Docker containers in Prometheus")

                services = []
                firing_alerts = await self._firing_alerts_count()
                # ð§ ÐÐÐ¢ÐÐÐÐÐÐ¦ÐÐ¯: ÐÐ³ÑÐ°Ð½Ð¸ÑÐ¸Ð²Ð°ÐµÐ¼ ÐºÐ¾Ð»Ð¸ÑÐµÑÑÐ²Ð¾ ÐºÐ¾Ð½ÑÐµÐ¹Ð½ÐµÑÐ¾Ð² Ð´Ð»Ñ Ð±ÑÑÑÑÐ¾Ð³Ð¾ Ð¾ÑÐ²ÐµÑÐ°
                max_containers = 20  # ÐÑÐµÐ¼ÐµÐ½Ð½Ð¾Ðµ Ð¾Ð³ÑÐ°Ð½Ð¸ÑÐµÐ½Ð¸Ðµ Ð´Ð»Ñ performance

                for _i, result in enumerate(results[:max_containers]):
                    metric = result.get("metric", {})
                    container_id = metric.get("id", "")
                    container_name = metric.get("name", "") or self._extract_name_from_id(container_id)

                    if container_name:
                        # ÐÐ¾Ð»ÑÑÐ°ÐµÐ¼ Ð´Ð¾Ð¿Ð¾Ð»Ð½Ð¸ÑÐµÐ»ÑÐ½ÑÐµ Ð¼ÐµÑÑÐ¸ÐºÐ¸ Ð´Ð»Ñ ÐºÐ°Ð¶Ð´Ð¾Ð³Ð¾ ÐºÐ¾Ð½ÑÐµÐ¹Ð½ÐµÑÐ°
                        service_info = await self._get_service_details_by_id(
                            container_id, container_name, firing_alerts=firing_alerts
                        )
                        services.append(service_info)

                logger.info(f"Processed {len(services)} services (limited to {max_containers})")
                return services

        except Exception as e:
            logger.exception(f"Failed to list Prometheus services: {e}")
            return []

    def _extract_name_from_id(self, container_id: str) -> str:
        """ÐÐ·Ð²Ð»ÐµÑÑ Ð¸Ð¼Ñ ÐºÐ¾Ð½ÑÐµÐ¹Ð½ÐµÑÐ° Ð¸Ð· Docker ID"""
        if "docker-" in container_id and ".scope" in container_id:
            # ÐÑÐ¸Ð¼ÐµÑ: /system.slice/docker-3f793ac1d657ef9756bcea1f54b45e29d98fabcf0ddfa09bcc52995722f1c28a.scope
            parts = container_id.split("docker-")
            if len(parts) > 1:
                docker_hash = parts[1].split(".scope")[0]
                return f"container-{docker_hash[:12]}"  # ÐÐµÑÐ²ÑÐµ 12 ÑÐ¸Ð¼Ð²Ð¾Ð»Ð¾Ð² ÐºÐ°Ðº Ð² Docker
        return container_id.split("/")[-1] if "/" in container_id else container_id

    async def _get_service_details_by_id(
        self, container_id: str, container_name: str, *, firing_alerts: int = 0
    ) -> dict[str, Any]:
        """Получить детальные метрики по container ID"""
        if not self.enable_cadvisor_metrics:
            return {}

        queries = {
            "cpu": f'rate(container_cpu_usage_seconds_total{{id="{container_id}"}}[5m]) * 100',
            "memory": f'container_memory_usage_bytes{{id="{container_id}"}} / 1024 / 1024',
            "memory_limit": f'container_spec_memory_limit_bytes{{id="{container_id}"}} / 1024 / 1024',
            "network_rx": f'rate(container_network_receive_bytes_total{{id="{container_id}"}}[5m])',
            "network_tx": f'rate(container_network_transmit_bytes_total{{id="{container_id}"}}[5m])',
        }

        metrics = {}
        for metric_name, query in queries.items():
            value = await self.query_metric(query)
            metrics[metric_name] = value if value is not None else 0

        # Определяем тип сервиса и стек
        service_type, stack = self._classify_service(container_name)

        # Определяем статус и здоровье
        is_active = metrics["memory"] > 0
        health_score = self._calculate_health_score(metrics)

        return {
            "name": container_name,
            "stack": stack,
            "type": service_type,
            "status": "running" if is_active else "stopped",
            "health": "healthy" if health_score > 0.8 else "warning" if health_score > 0.3 else "unhealthy",
            "cpu": round(metrics["cpu"], 1),
            "memory": round(metrics["memory"], 0),
            "memory_limit": round(metrics["memory_limit"], 0),
            "memory_usage_percent": round((metrics["memory"] / max(metrics["memory_limit"], 1)) * 100, 1),
            "network_rx": round(metrics["network_rx"], 0),
            "network_tx": round(metrics["network_tx"], 0),
            "health_score": round(health_score, 2),
            "response_time": self._estimate_response_time(service_type),
            "alerts_count": firing_alerts,
        }

    async def _get_service_details(self, container_name: str, *, firing_alerts: int = 0) -> dict[str, Any]:
        """Получить детальную информацию о сервисе"""
        if not self.enable_cadvisor_metrics:
            return {}

        queries = {
            "cpu": f'rate(container_cpu_usage_seconds_total{{name="{container_name}"}}[5m]) * 100',
            "memory": f'container_memory_usage_bytes{{name="{container_name}"}} / 1024 / 1024',
            "memory_limit": f'container_spec_memory_limit_bytes{{name="{container_name}"}} / 1024 / 1024',
            "network_rx": f'rate(container_network_receive_bytes_total{{name="{container_name}"}}[5m])',
            "network_tx": f'rate(container_network_transmit_bytes_total{{name="{container_name}"}}[5m])',
        }

        metrics = {}
        for metric_name, query in queries.items():
            value = await self.query_metric(query)
            metrics[metric_name] = value if value is not None else 0

        # ÐÐ¿ÑÐµÐ´ÐµÐ»ÑÐµÐ¼ ÑÐ¸Ð¿ ÑÐµÑÐ²Ð¸ÑÐ° Ð¸ ÑÑÐµÐº
        service_type, stack = self._classify_service(container_name)

        # ÐÐ¿ÑÐµÐ´ÐµÐ»ÑÐµÐ¼ ÑÑÐ°ÑÑÑ Ð¸ Ð·Ð´Ð¾ÑÐ¾Ð²ÑÐµ
        is_active = metrics["memory"] > 0
        health_score = self._calculate_health_score(metrics)

        return {
            "name": container_name,
            "stack": stack,
            "type": service_type,
            "status": "running" if is_active else "stopped",
            "health": "healthy" if health_score > 0.8 else "warning" if health_score > 0.3 else "unhealthy",
            "cpu": round(metrics["cpu"], 1),
            "memory": round(metrics["memory"], 0),
            "memory_limit": round(metrics["memory_limit"], 0),
            "memory_usage_percent": round((metrics["memory"] / max(metrics["memory_limit"], 1)) * 100, 1),
            "network_rx": round(metrics["network_rx"], 0),
            "network_tx": round(metrics["network_tx"], 0),
            "health_score": round(health_score, 2),
            "response_time": self._estimate_response_time(service_type),
            "alerts_count": firing_alerts,
        }

    def _classify_service(self, container_name: str) -> tuple[str, str]:
        """ÐÐ»Ð°ÑÑÐ¸ÑÐ¸ÑÐ¸ÑÐ¾Ð²Ð°ÑÑ ÑÐµÑÐ²Ð¸Ñ Ð¿Ð¾ Ð¸Ð¼ÐµÐ½Ð¸ ÐºÐ¾Ð½ÑÐµÐ¹Ð½ÐµÑÐ°"""
        name_lower = container_name.lower()

        # AI ÑÐµÑÐ²Ð¸ÑÑ
        if "llama" in name_lower:
            return "ai-text-generation", "stack2"
        if "comfyui" in name_lower:
            return "ai-image-generation", "stack2"
        if "sadtalker" in name_lower:
            return "ai-video", "stack2"
        if "supir" in name_lower:
            return "ai-enhancement", "stack2"

        # ÐÐ¾Ð½Ð¸ÑÐ¾ÑÐ¸Ð½Ð³
        if (
            "prometheus" in name_lower
            or "grafana" in name_lower
            or "node-exporter" in name_lower
            or "cadvisor" in name_lower
            or "dcgm" in name_lower
            or "glances" in name_lower
        ):
            return "monitoring", "stack3"

        # DevOps
        if "jenkins" in name_lower:
            return "ci-cd", "stack3"
        if "gitea" in name_lower:
            return "vcs", "stack3"
        if "nexus" in name_lower:
            return "repository", "stack3"
        if "sonarqube" in name_lower:
            return "code-quality", "stack3"

        # ÐÐ°Ð·Ñ Ð´Ð°Ð½Ð½ÑÑ
        if "postgres" in name_lower:
            return "database", "stack1"
        if "redis" in name_lower:
            return "cache", "stack1"
        if "mysql" in name_lower:
            return "database", "emperyworld"
        if "qdrant" in name_lower:
            return "vector-db", "stack1"
        if "elasticsearch" in name_lower:
            return "search", "stack1"
        if "chroma" in name_lower:
            return "vector-db", "stack1"

        # ÐÐ¾ÐºÑÐ¼ÐµÐ½ÑÑ
        if "paperless" in name_lower:
            return "document-management", "stack4"
        if "tika" in name_lower:
            return "document-processing", "stack4"
        if "tesseract" in name_lower:
            return "ocr", "stack4"

        # ÐÐ¾Ð¼Ð¼ÑÐ½Ð¸ÐºÐ°ÑÐ¸Ð¸
        if "jitsi" in name_lower:
            return "video-conference", "stack5"
        if "etherpad" in name_lower:
            return "collaborative-editor", "stack5"
        if "keycloak" in name_lower:
            return "identity-management", "stack5"

        # Ð Ð°Ð·ÑÐ°Ð±Ð¾ÑÐºÐ°
        if "jupyter" in name_lower or "code-server" in name_lower:
            return "development", "stack3"

        # ÐÑÐ¾ÑÐµÐµ
        if "portainer" in name_lower:
            return "container-management", "stack3"
        if "heimdall" in name_lower:
            return "dashboard", "stack3"
        if "coolify" in name_lower:
            return "deployment", "stack6"

        return "unknown", "unknown"

    def _calculate_health_score(self, metrics: dict[str, float]) -> float:
        """Ð Ð°ÑÑÑÐ¸ÑÐ°ÑÑ Ð¾ÑÐµÐ½ÐºÑ Ð·Ð´Ð¾ÑÐ¾Ð²ÑÑ ÑÐµÑÐ²Ð¸ÑÐ°"""
        if metrics["memory"] <= 0:
            return 0.0

        score = 1.0

        # Ð¨ÑÑÐ°ÑÑÐµÐ¼ Ð·Ð° Ð²ÑÑÐ¾ÐºÐ¾Ðµ Ð¿Ð¾ÑÑÐµÐ±Ð»ÐµÐ½Ð¸Ðµ CPU
        if metrics["cpu"] > 90:
            score -= 0.3
        elif metrics["cpu"] > 70:
            score -= 0.1

        # Ð¨ÑÑÐ°ÑÑÐµÐ¼ Ð·Ð° Ð²ÑÑÐ¾ÐºÐ¾Ðµ Ð¿Ð¾ÑÑÐµÐ±Ð»ÐµÐ½Ð¸Ðµ Ð¿Ð°Ð¼ÑÑÐ¸
        if metrics["memory_limit"] > 0:
            memory_percent = (metrics["memory"] / metrics["memory_limit"]) * 100
            if memory_percent > 90:
                score -= 0.3
            elif memory_percent > 70:
                score -= 0.1

        return max(0.0, score)

    def _estimate_response_time(self, service_type: str) -> int:
        """ÐÑÐµÐ½Ð¸ÑÑ Ð²ÑÐµÐ¼Ñ Ð¾ÑÐºÐ»Ð¸ÐºÐ° ÑÐµÑÐ²Ð¸ÑÐ° Ð² Ð¼Ð¸Ð»Ð»Ð¸ÑÐµÐºÑÐ½Ð´Ð°Ñ"""
        estimates = {
            "ai-text-generation": 1250,
            "ai-image-generation": 15000,
            "ai-video": 2000,
            "ai-enhancement": 500,
            "monitoring": 200,
            "database": 50,
            "cache": 10,
            "ci-cd": 800,
            "development": 300,
        }
        return estimates.get(service_type, 500)

    def _format_uptime(self, seconds: int) -> str:
        """Ð¤Ð¾ÑÐ¼Ð°ÑÐ¸ÑÐ¾Ð²Ð°ÑÑ Ð²ÑÐµÐ¼Ñ ÑÐ°Ð±Ð¾ÑÑ"""
        days = seconds // 86400
        hours = (seconds % 86400) // 3600
        minutes = (seconds % 3600) // 60

        if days > 0:
            return f"{days}d {hours}h {minutes}m"
        if hours > 0:
            return f"{hours}h {minutes}m"
        return f"{minutes}m"

    async def health_check(self) -> dict[str, Any]:
        """ÐÑÐ¾Ð²ÐµÑÐ¸ÑÑ Ð´Ð¾ÑÑÑÐ¿Ð½Ð¾ÑÑÑ Prometheus"""
        try:
            async with (
                aiohttp.ClientSession(timeout=self.timeout) as session,
                session.get(f"{self.base_url}/api/v1/query", params={"query": "up"}) as response,
            ):
                if response.status == 200:
                    data = await response.json()
                    return {
                        "healthy": True,
                        "status": "connected",
                        "response_time_ms": int(response.headers.get("X-Response-Time-Ms", 0)),
                        "prometheus_version": response.headers.get("X-Prometheus-Version", "unknown"),
                        "targets_up": len(data.get("data", {}).get("result", [])),
                    }
                return {"healthy": False, "status": f"http_error_{response.status}", "error": await response.text()}
        except Exception as e:
            return {"healthy": False, "status": "connection_error", "error": str(e)}


# Ð¡Ð¾Ð·Ð´Ð°ÑÐ¼ Ð³Ð»Ð¾Ð±Ð°Ð»ÑÐ½ÑÐ¹ ÑÐºÐ·ÐµÐ¼Ð¿Ð»ÑÑ
prometheus_service = PrometheusService()
