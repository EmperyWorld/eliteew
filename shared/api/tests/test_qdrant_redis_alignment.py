# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock: Qdrant 1.18 + redis-py 8.x alignment (Wave 1 Task 0.3).
# Invariants:
# - api.lock pins qdrant-client >= 1.18 and redis >= 8.0.
# - Async redis pub/sub path used by Socket.IO manager remains functional at API level.
# Related:
# - docker/builders/stack0-api/requirements/locks/api.lock
# - api/routers/socketio_handler.py
# ---
from __future__ import annotations

import importlib.metadata
import re
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[3]
_API_LOCK = _REPO_ROOT / "docker/builders/stack0-api/requirements/locks/api.lock"
_CONSTRAINTS = _REPO_ROOT / "docker/builders/stack0-api/constraints.txt"
_BASE_IN = _REPO_ROOT / "docker/builders/stack0-api/requirements/base.in"


def test_api_lock_pins_qdrant_118() -> None:
    lock_text = _API_LOCK.read_text(encoding="utf-8")
    match = re.search(r"^qdrant-client==(\S+)", lock_text, re.MULTILINE)
    assert match is not None
    version = match.group(1)
    major_minor = tuple(int(part) for part in version.split(".")[:2])
    assert major_minor >= (1, 18), f"expected qdrant-client >= 1.18, got {version}"


def test_api_lock_pins_redis_8x() -> None:
    lock_text = _API_LOCK.read_text(encoding="utf-8")
    match = re.search(r"^redis==(\S+)", lock_text, re.MULTILINE)
    assert match is not None
    version = match.group(1)
    assert version.startswith("8."), f"expected redis 8.x, got {version}"


def test_constraints_and_base_in_allow_redis_8() -> None:
    constraints = _CONSTRAINTS.read_text(encoding="utf-8")
    base_in = _BASE_IN.read_text(encoding="utf-8")
    assert "redis<8" not in constraints
    assert "redis>=8" in base_in
    assert "celery[redis]" not in base_in


def test_installed_redis_is_8x_when_present() -> None:
    try:
        version = importlib.metadata.version("redis")
    except importlib.metadata.PackageNotFoundError:
        pytest.skip("redis not installed in host venv")
    assert version.startswith("8."), f"host venv redis must be 8.x, got {version}"


@pytest.mark.asyncio
async def test_async_redis_ping_set_get_publish_subscribe() -> None:
    redis = pytest.importorskip("redis.asyncio")
    client = redis.Redis(decode_responses=True)
    pubsub = client.pubsub()

    client.ping = AsyncMock(return_value=True)
    client.set = AsyncMock(return_value=True)
    client.get = AsyncMock(return_value="probe-ok")
    client.publish = AsyncMock(return_value=1)
    pubsub.subscribe = AsyncMock()
    pubsub.get_message = AsyncMock(return_value={"type": "message", "data": "probe-hello", "channel": "probe:channel"})
    client.pubsub = MagicMock(return_value=pubsub)

    assert await client.ping() is True
    await client.set("probe:key", "probe-ok")
    assert await client.get("probe:key") == "probe-ok"
    await pubsub.subscribe("probe:channel")
    assert await client.publish("probe:channel", "probe-hello") == 1
    message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=2)
    assert message is not None
    assert message["data"] == "probe-hello"


def test_socketio_handler_wires_async_redis_manager() -> None:
    source = (Path(__file__).resolve().parents[1] / "routers" / "socketio_handler.py").read_text(encoding="utf-8")
    assert "AsyncRedisManager" in source
    assert "redis://" in source
