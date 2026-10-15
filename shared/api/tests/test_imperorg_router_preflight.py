# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Route-level preflight tests for ImperorG launch guardrails before long AI/UGS work starts.
# Invariants:
# - Enabled UGS queue mode requires a visible AI generation queue with at least one consumer.
# - Failures raise HTTP 503 with operator-readable detail.
# Related:
# - api/routers/imperorg.py
# - api/services/rabbitmq_service.py
# ---
from __future__ import annotations

import pytest
from fastapi import HTTPException


@pytest.mark.unit
@pytest.mark.asyncio
async def test_imperorg_preflight_rejects_ai_queue_without_consumers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from api.routers import imperorg

    monkeypatch.setattr(imperorg, "is_queue_enabled", lambda *_args, **_kwargs: True)

    async def _snapshot() -> dict[str, object]:
        return {
            "ok": True,
            "error": None,
            "queues": [
                {
                    "name": "ai.generation.queue",
                    "messages_ready": 0,
                    "messages_unacknowledged": 0,
                    "consumers": 0,
                }
            ],
        }

    monkeypatch.setattr(imperorg, "fetch_rabbitmq_queues_snapshot", _snapshot)

    class _Rabbit:
        def _queue_name(self, _queue_key: str) -> str:
            return "ai.generation.queue"

    monkeypatch.setattr(imperorg, "get_rabbitmq_service", lambda: _Rabbit())

    with pytest.raises(HTTPException) as exc:
        await imperorg._require_ai_generation_queue_ready()  # noqa: SLF001

    assert exc.value.status_code == 503
    assert "no active consumers" in str(exc.value.detail)
