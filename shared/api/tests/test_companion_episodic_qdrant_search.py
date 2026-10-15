# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Guards the **async Qdrant search path** used by companion episodic recall (`search_companion_episodic`).
# ``AsyncQdrantClient`` has ``query_points`` but not ``.search()`` — this regression would otherwise only
# show up at runtime (`[STEP] companion_episodic.search_failed`).
# Invariants:
# - Uses ``asyncio.run`` only; no Docker Qdrant.
# - Minimal ``qdrant_client.models`` stub when the package is not installed in the pytest venv so CI still
#   validates the branching (aligned with ``test_marketing_project_rag_internal_rerank``).
# Related:
# - api/ewa_platform/persistence_vector/companion_qdrant.py
# ---
"""Tests: companion episodic Qdrant search prefers ``query_points``."""

from __future__ import annotations

import asyncio
import importlib.util
import sys
import types
from types import SimpleNamespace
from typing import Any

from api.ewa_platform.persistence_vector.companion_qdrant import search_companion_episodic


def _stub_qdrant_models_if_missing() -> None:
    """Provide ``FieldCondition``/``Filter`` shims only when ``qdrant_client`` is not on ``PYTHONPATH``."""

    if importlib.util.find_spec("qdrant_client.models") is not None:
        return

    pkg = types.ModuleType("qdrant_client")
    mod = types.ModuleType("qdrant_client.models")

    class MatchValue(SimpleNamespace):  # noqa: D106
        """Test stub matching ``MatchValue(value=…)``."""

    class MatchAny(SimpleNamespace):  # noqa: D106
        """Test stub matching ``MatchAny(any=[…])``."""

    class FieldCondition(SimpleNamespace):  # noqa: D106
        """Test stub matching ``FieldCondition(key=..., match=…)``."""

    class Filter(SimpleNamespace):  # noqa: D106
        """Test stub matching ``Filter(must=[…])``."""

    mod.MatchValue = MatchValue  # type: ignore[misc]
    mod.MatchAny = MatchAny  # type: ignore[misc]
    mod.FieldCondition = FieldCondition  # type: ignore[misc]
    mod.Filter = Filter  # type: ignore[misc]
    sys.modules.setdefault("qdrant_client", pkg)
    setattr(pkg, "models", mod)
    sys.modules["qdrant_client.models"] = mod


def _run(coro: Any) -> Any:
    _stub_qdrant_models_if_missing()
    return asyncio.run(coro)


def test_search_companion_episodic_uses_query_points_on_async_style_client() -> None:
    qp_calls: dict[str, Any] = {}

    class FakeAsyncClient:
        async def query_points(self, **kwargs: Any) -> SimpleNamespace:
            qp_calls.update(kwargs)
            pt = SimpleNamespace(
                payload={
                    "body": "hello episodic recall",
                    "episode_id": "ep-1",
                    "kind": "turn_user",
                    "source": "chat_turn",
                    "persona": "mela",
                    "importance": 0.7,
                    "valence": 0.6,
                    "created_at_iso": "2026-05-11T12:00:00+00:00",
                    "turn_id": None,
                },
                score=0.92,
            )
            return SimpleNamespace(points=[pt])

    hits = _run(
        search_companion_episodic(
            FakeAsyncClient(),
            dim=768,
            principal_id="p-test",
            query_vector=[0.1] * 4,
            top_k=3,
        )
    )
    assert len(hits) == 1
    assert hits[0].body == "hello episodic recall"
    assert hits[0].score == 0.92
    assert qp_calls["collection_name"] == "ewa_companion_episodic_v1_d768"
    assert qp_calls["limit"] == 3
    assert isinstance(qp_calls["query"], list)


def test_search_companion_episodic_falls_back_to_search_legacy_client() -> None:
    legacy_calls: list[dict[str, Any]] = []

    class FakeLegacyAsyncClient:
        async def search(self, **kwargs: Any) -> list[SimpleNamespace]:
            legacy_calls.append(dict(kwargs))
            return [
                SimpleNamespace(
                    payload={
                        "body": "legacy path",
                        "episode_id": "ep-2",
                        "kind": "turn_user",
                        "source": "chat_turn",
                        "persona": "parent",
                        "importance": 0.5,
                        "valence": 0.5,
                        "created_at_iso": "",
                    },
                    score=0.5,
                )
            ]

    hits = _run(
        search_companion_episodic(
            FakeLegacyAsyncClient(),
            dim=768,
            principal_id="p-legacy",
            query_vector=[0.5, 0.5],
            top_k=5,
        )
    )
    assert len(hits) == 1
    assert hits[0].body == "legacy path"
    assert legacy_calls


def test_search_companion_episodic_retries_once_when_collection_missing() -> None:
    """Cold Qdrant: first ``query_points`` 404 → ensure + second call succeeds."""

    _stub_qdrant_models_if_missing()

    qp_calls = 0

    class MissingThenOkClient:
        async def query_points(self, **_kwargs: Any) -> SimpleNamespace:
            nonlocal qp_calls
            qp_calls += 1
            if qp_calls == 1:
                msg = (
                    "Unexpected Response: 404 (Not Found) Raw response content: "
                    'b\'{"status":{"error":"Not found: Collection `ewa_companion_episodic_v1_d4096` '
                    "doesn't exist!"
                )
                raise RuntimeError(msg)
            pt = SimpleNamespace(
                payload={
                    "body": "after ensure",
                    "episode_id": "ep-retry",
                    "kind": "turn_user",
                    "source": "chat_turn",
                    "persona": "mela",
                    "importance": 0.6,
                    "valence": 0.55,
                    "created_at_iso": "",
                },
                score=0.81,
            )
            return SimpleNamespace(points=[pt])

    async def _run_patched():
        from unittest.mock import AsyncMock, patch

        with patch(
            "api.ewa_platform.persistence_vector.companion_qdrant.ensure_companion_episodic_collection",
            new=AsyncMock(return_value=True),
        ):
            return await search_companion_episodic(
                MissingThenOkClient(),
                dim=4096,
                principal_id="p-cold",
                query_vector=[0.0] * 8,
                top_k=2,
            )

    hits = asyncio.run(_run_patched())
    assert qp_calls == 2
    assert len(hits) == 1
    assert hits[0].body == "after ensure"
