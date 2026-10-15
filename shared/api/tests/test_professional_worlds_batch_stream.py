# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Verifies Realtor media batch SSE driver continues sequencing after a per-item failure envelope.
# Invariants:
# - Patches `_run_media_enhancement` only — no Postgres.
# Related:
# - api/routers/professional_worlds_realtor_media.py (`_run_media_batch_stream`)
# ---

from __future__ import annotations

from collections.abc import AsyncGenerator
from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest

from api.routers.professional_worlds_deps import _sse
from api.routers.professional_worlds_realtor_media_runtime import (
    _run_media_batch_stream,
    batch_media_item_idempotency_key,
)
from api.schemas.professional_worlds import MediaEnhancementRequest


def test_batch_media_item_idempotency_key_is_stable() -> None:
    batch_id = uuid4()
    item_id = uuid4()
    key = batch_media_item_idempotency_key(batch_id, item_id)
    assert key == f"pw-media-batch:{batch_id}:{item_id}"
    assert batch_media_item_idempotency_key(batch_id, item_id) == key


@pytest.mark.anyio
async def test_media_batch_stream_reaches_finished_after_partial_item_error() -> None:
    user_id = uuid4()
    property_id = uuid4()
    batch_id = uuid4()
    e1 = uuid4()
    e2 = uuid4()
    s1 = uuid4()
    s2 = uuid4()
    items = [
        {"id": uuid4(), "enhancement_job_id": e1, "source_content_id": s1},
        {"id": uuid4(), "enhancement_job_id": e2, "source_content_id": s2},
    ]
    enhancement_jobs = [
        {
            "id": e1,
            "preset_key": "premium_gallery",
            "status": "queued",
            "instruction": None,
            "source_content_id": uuid4(),
        },
        {
            "id": e2,
            "preset_key": "premium_gallery",
            "status": "queued",
            "instruction": None,
            "source_content_id": uuid4(),
        },
    ]

    class _Svc:
        async def get_media_batch_job(self, uid: UUID, pid: UUID, bid: UUID) -> dict[str, object] | None:
            assert uid == user_id and pid == property_id and bid == batch_id
            return {"items": items, "enhancement_jobs": enhancement_jobs}

        async def get_property(self, *_a: object, **_kw: object) -> dict[str, object]:
            return {"title": "Test property"}

        async def get_brand_visual_kit(self, *_a: object, **_kw: object) -> None:
            return None

        async def set_media_batch_job_status(self, *_a: object, **_kw: object) -> bool:
            return True

        async def set_media_batch_line_status(self, *_a: object, **_kw: object) -> dict[str, object]:
            return {"id": "noop"}

    service = _Svc()

    async def fake_run_media_enhancement(
        *,
        payload: MediaEnhancementRequest | None = None,
        sse_ctx: dict[str, object] | None = None,
        **_extra: object,
    ) -> AsyncGenerator[str]:
        idx = int(sse_ctx.get("item_index", -1)) if sse_ctx else -1
        if payload is not None:
            assert payload.idempotency_key == batch_media_item_idempotency_key(
                batch_id,
                UUID(str(items[idx]["id"])),
            )
        if idx == 0:
            yield _sse("error", {"error": "boom"})
            return
        yield _sse("result", {"ok": True})

    chunks: list[str] = []
    with patch(
        "api.routers.professional_worlds_realtor_media_runtime._run_media_enhancement",
        fake_run_media_enhancement,
    ):
        async for pkt in _run_media_batch_stream(
            user=SimpleNamespace(),
            user_id=user_id,
            property_id=property_id,
            batch_id=batch_id,
            service=service,  # type: ignore[arg-type]
            content_service=None,
            ugs_service=None,
        ):
            chunks.append(pkt)

    assert any("batch_finished" in chunk for chunk in chunks)
    assert sum(1 for chunk in chunks if "event: error" in chunk) >= 1
    assert sum(1 for chunk in chunks if "event: result" in chunk) >= 1
