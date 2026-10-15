# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for env-driven ES/RabbitMQ client resilience settings and soft-reconnect gate.
# Invariants:
# - Defaults match overlay-latency plan (ES request 60s, max_retries 2, RMQ heartbeat 60).
# Related:
# - api/core/infra_client_timeouts.py
# - api/core/database_manager.py
# ---
"""Tests for infra_client_timeouts and Elasticsearch soft-reconnect rate limit."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from api.core.infra_client_timeouts import (
    elasticsearch_resilience_settings,
    env_int,
    filter_supported_kwargs,
    rabbitmq_connection_resilience_settings,
)


def test_elasticsearch_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "ELASTICSEARCH_REQUEST_TIMEOUT",
        "ELASTICSEARCH_MAX_RETRIES",
        "ELASTIC_MAX_RETRIES",
        "ELASTICSEARCH_CONNECT_TIMEOUT",
        "ELASTICSEARCH_DEAD_NODE_BACKOFF_FACTOR",
        "ELASTICSEARCH_MAX_DEAD_NODE_BACKOFF",
        "ELASTICSEARCH_SOFT_RECONNECT_INTERVAL_SEC",
        "ELASTICSEARCH_RETRY_ON_TIMEOUT",
        "ELASTICSEARCH_HEALTH_CHECK_TIMEOUT",
    ):
        monkeypatch.delenv(name, raising=False)

    settings = elasticsearch_resilience_settings()
    assert settings["request_timeout"] == 60.0
    assert settings["max_retries"] == 2
    assert settings["connect_timeout"] == 15.0
    assert settings["retry_on_timeout"] is True
    assert settings["dead_node_backoff_factor"] == 2.0
    assert settings["max_dead_node_backoff"] == 30.0
    assert settings["soft_reconnect_interval_sec"] == 60.0
    assert settings["health_check_timeout"] == 10.0
    assert settings["retry_on_status"] == (502, 503, 504)


def test_elasticsearch_max_retries_alias(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ELASTICSEARCH_MAX_RETRIES", raising=False)
    monkeypatch.setenv("ELASTIC_MAX_RETRIES", "4")
    assert elasticsearch_resilience_settings()["max_retries"] == 4


def test_elasticsearch_connect_clamped_to_request(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELASTICSEARCH_REQUEST_TIMEOUT", "10")
    monkeypatch.setenv("ELASTICSEARCH_CONNECT_TIMEOUT", "30")
    settings = elasticsearch_resilience_settings()
    assert settings["request_timeout"] == 10.0
    assert settings["connect_timeout"] == 10.0


def test_rabbitmq_defaults_and_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RABBITMQ_HEARTBEAT", raising=False)
    monkeypatch.delenv("RABBITMQ_BLOCKED_CONNECTION_TIMEOUT", raising=False)
    assert rabbitmq_connection_resilience_settings() == {
        "heartbeat": 60,
        "blocked_connection_timeout": 300,
    }
    monkeypatch.setenv("RABBITMQ_HEARTBEAT", "90")
    monkeypatch.setenv("RABBITMQ_BLOCKED_CONNECTION_TIMEOUT", "120")
    assert rabbitmq_connection_resilience_settings() == {
        "heartbeat": 90,
        "blocked_connection_timeout": 120,
    }


def test_env_int_clamps_and_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TEST_CLAMP", "999")
    assert env_int("TEST_CLAMP", default=2, minimum=0, maximum=10) == 10
    monkeypatch.setenv("TEST_CLAMP", "nope")
    assert env_int("TEST_CLAMP", default=2, minimum=0, maximum=10) == 2


def test_filter_supported_kwargs_drops_unknown() -> None:
    def sample(*, request_timeout: float, max_retries: int = 1) -> None:
        return None

    filtered = filter_supported_kwargs(
        sample,
        {
            "request_timeout": 60.0,
            "max_retries": 2,
            "dead_node_backoff_factor": 2.0,
        },
    )
    assert filtered == {"request_timeout": 60.0, "max_retries": 2}


@pytest.mark.asyncio
async def test_soft_reconnect_rate_limited(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ELASTICSEARCH_SOFT_RECONNECT_INTERVAL_SEC", "60")

    from api.core import database_manager as dm

    manager = object.__new__(dm.DatabaseManager)
    manager.elasticsearch_client = None
    manager._elasticsearch_soft_reconnect_at = 0.0
    manager.health_status = {}

    calls: list[bool] = []

    async def fake_init() -> bool:
        calls.append(True)
        return False

    manager._init_elasticsearch = fake_init  # type: ignore[method-assign]

    with patch.object(dm, "DatabaseFeatures") as features, patch.object(dm, "ELASTICSEARCH_AVAILABLE", True):
        features.ENABLE_ELASTICSEARCH = True
        assert await manager._maybe_soft_reconnect_elasticsearch() is True
        assert len(calls) == 1
        # Immediate second attempt must be rate-limited.
        assert await manager._maybe_soft_reconnect_elasticsearch() is False
        assert len(calls) == 1


@pytest.mark.asyncio
async def test_check_elasticsearch_health_triggers_soft_reconnect(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ELASTICSEARCH_SOFT_RECONNECT_INTERVAL_SEC", "15")

    from api.core import database_manager as dm

    manager = object.__new__(dm.DatabaseManager)
    manager.elasticsearch_client = None
    manager._elasticsearch_soft_reconnect_at = 0.0
    manager.health_status = {}

    reconnect = AsyncMock(return_value=True)
    manager._maybe_soft_reconnect_elasticsearch = reconnect  # type: ignore[method-assign]

    await manager._check_elasticsearch_health()
    reconnect.assert_awaited()


@pytest.mark.asyncio
async def test_check_elasticsearch_health_drops_client_on_transport_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """elastic_transport.ConnectionTimeout is not builtin TimeoutError — must still drop."""

    monkeypatch.setenv("ELASTICSEARCH_HEALTH_CHECK_TIMEOUT", "5")
    monkeypatch.setenv("ELASTICSEARCH_SOFT_RECONNECT_INTERVAL_SEC", "15")

    from api.core import database_manager as dm

    class _FakeTransportTimeout(Exception):
        pass

    manager = object.__new__(dm.DatabaseManager)
    fake_client = AsyncMock()
    fake_client.cluster.health = AsyncMock(side_effect=_FakeTransportTimeout("hung"))
    fake_client.close = AsyncMock()
    manager.elasticsearch_client = fake_client
    manager._elasticsearch_soft_reconnect_at = 0.0
    manager.health_status = {}

    reconnect = AsyncMock(return_value=True)
    manager._maybe_soft_reconnect_elasticsearch = reconnect  # type: ignore[method-assign]

    await manager._check_elasticsearch_health()

    assert manager.elasticsearch_client is None
    fake_client.close.assert_awaited()
    reconnect.assert_awaited()
    assert manager.health_status["elasticsearch"].status == "down"


@pytest.mark.asyncio
async def test_check_elasticsearch_health_asyncio_timeout_drops_without_inline_reconnect(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Builtin/asyncio TimeoutError must drop the client but not soft-reconnect inline."""

    monkeypatch.setenv("ELASTICSEARCH_HEALTH_CHECK_TIMEOUT", "5")
    monkeypatch.setenv("ELASTICSEARCH_SOFT_RECONNECT_INTERVAL_SEC", "15")

    from api.core import database_manager as dm

    manager = object.__new__(dm.DatabaseManager)
    fake_client = AsyncMock()
    fake_client.cluster.health = AsyncMock(side_effect=TimeoutError())
    fake_client.close = AsyncMock()
    manager.elasticsearch_client = fake_client
    manager._elasticsearch_soft_reconnect_at = 0.0
    manager.health_status = {}

    reconnect = AsyncMock(return_value=True)
    manager._maybe_soft_reconnect_elasticsearch = reconnect  # type: ignore[method-assign]

    await manager._check_elasticsearch_health()

    assert manager.elasticsearch_client is None
    fake_client.close.assert_awaited()
    reconnect.assert_not_awaited()
    assert manager.health_status["elasticsearch"].status == "down"


def test_celery_worker_mode_skips_background_health_monitor(monkeypatch: pytest.MonkeyPatch) -> None:
    """Celery prefork must not start _health_monitor_loop (wait_for across idle loop)."""

    import asyncio

    from api.core import celery_async

    monkeypatch.setattr(celery_async, "_celery_worker_mode", True)
    assert celery_async.is_celery_worker_mode() is True

    async def _gate() -> object | None:
        if celery_async.is_celery_worker_mode():
            return None
        return object()

    assert asyncio.run(_gate()) is None


def test_api_mode_health_monitor_flag_off(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.core import celery_async

    monkeypatch.setattr(celery_async, "_celery_worker_mode", False)
    assert celery_async.is_celery_worker_mode() is False
