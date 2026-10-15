# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Contract tests for UGS unified generation boundaries: idempotency key normalization, result sanitization
#   (oversized strings / heavy image payloads), and silent-truncation markers.
# Invariants:
#   - No live Postgres or external HTTP; mocks/pure helpers only.
# Related:
#   - documentation/platform/docker-re_doc/UGS-IDEMPOTENCY.md
#   - api/services/ugs/unified_generation_service.py
#   - api/services/ugs/result_handling.py
# ---
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi import APIRouter, HTTPException  # type: ignore[import-untyped]
from fastapi.routing import APIRoute

from api.routers.ugs.deps import _idempotency_key_from_body_or_headers
from api.routers.ugs.generation import register_generation_routes
from api.services.ugs.result_handling import enrich_result_with_assets, sanitize_generation_result
from api.services.ugs.unified_generation_service import UnifiedGenerationService


def _generation_endpoint(path: str):
    router = APIRouter()
    register_generation_routes(router)
    for route in router.routes:
        if isinstance(route, APIRoute) and route.path == path:
            return route.endpoint
    msg = f"UGS generation endpoint not found: {path}"
    raise AssertionError(msg)


def test_idempotency_key_truncates_to_max_length() -> None:
    long_key = "x" * 400
    req = SimpleNamespace(headers={"Idempotency-Key": long_key})
    out = _idempotency_key_from_body_or_headers(None, req)
    assert out is not None
    assert len(out) == 220
    assert out == long_key[:220]


def test_idempotency_prefers_body_over_header() -> None:
    req = SimpleNamespace(headers={"Idempotency-Key": "from-header"})
    out = _idempotency_key_from_body_or_headers("from-body", req)
    assert out == "from-body"


def test_sanitize_truncates_oversized_string_at_explicit_limit() -> None:
    huge = "A" * 500
    payload = {"text": huge}
    out = sanitize_generation_result(payload, string_limit=80)
    assert isinstance(out, dict)
    text_out = out.get("text")
    assert isinstance(text_out, str)
    assert len(text_out) <= 120
    assert "TRUNCATED" in text_out


def test_sanitize_strips_huge_image_base64_without_shipping_raw_blob() -> None:
    """Regression: huge base64 must not pass through silently as full ``data`` on image dicts."""
    blob = "B" * 50_000
    payload = {"images": [{"data": blob, "mime_type": "image/png"}]}
    out = sanitize_generation_result(payload, string_limit=4096, max_keep_b64_bytes=2048)
    assert isinstance(out, dict)
    images = out.get("images")
    assert isinstance(images, list) and images
    first = images[0]
    assert isinstance(first, dict)
    assert first.get("data") in (None, "") or first.get("data_truncated") is True


def test_sanitize_strips_huge_video_base64_and_keeps_comfy_storage_reference() -> None:
    """Regression: video payloads must not pass through as truncated strings without a refetch path."""
    blob = "V" * 80_000
    payload = {"videos": [{"data": blob, "filename": "Wan2.2_i2v_00001_.mp4", "subfolder": "video"}]}
    out = sanitize_generation_result(payload, string_limit=4096, max_keep_b64_bytes=2048)
    assert isinstance(out, dict)
    videos = out.get("videos")
    assert isinstance(videos, list) and videos
    first = videos[0]
    assert isinstance(first, dict)
    assert first.get("data") in (None, "")
    assert first.get("data_truncated") is True
    storage_ref = first.get("storage_reference")
    assert isinstance(storage_ref, dict)
    assert storage_ref.get("kind") == "video"
    assert storage_ref.get("filename") == "Wan2.2_i2v_00001_.mp4"
    assert storage_ref.get("subfolder") == "video"


@pytest.mark.asyncio
async def test_enrich_fetches_video_from_comfyui_storage_reference() -> None:
    provider_manager = MagicMock()
    provider_manager.fetch_comfyui_output_video = AsyncMock(return_value="Z" * 4096)
    payload = {
        "videos": [
            {
                "filename": "Wan2.2_i2v_00001_.mp4",
                "subfolder": "video",
                "data": None,
                "data_truncated": True,
                "storage_reference": {
                    "provider": "comfyui",
                    "kind": "video",
                    "filename": "Wan2.2_i2v_00001_.mp4",
                    "subfolder": "video",
                    "type": "output",
                },
            }
        ]
    }
    out = await enrich_result_with_assets(provider_manager, payload, provider="comfyui")
    assert isinstance(out, dict)
    videos = out.get("videos")
    assert isinstance(videos, list) and videos
    first = videos[0]
    assert isinstance(first, dict)
    assert first.get("data") == "Z" * 4096
    provider_manager.fetch_comfyui_output_video.assert_awaited_once_with(
        "Wan2.2_i2v_00001_.mp4",
        "video",
    )


@pytest.mark.asyncio
async def test_generate_short_circuits_on_idempotent_reuse(monkeypatch: pytest.MonkeyPatch) -> None:
    """When an existing request is reusable, ``generate`` must return reused payload without creating a new row."""
    db = MagicMock()
    svc = UnifiedGenerationService(db, content_service=None)

    gen_type = SimpleNamespace(
        id="type-1",
        is_active=True,
        category="text",
        provider="llama",
        model_name="m",
        estimated_time=1,
        type_metadata={},
    )
    get_by_key = MagicMock(return_value=gen_type)
    monkeypatch.setattr(svc.type_service, "get_by_key", get_by_key)

    existing = MagicMock()
    existing.id = "req-existing"
    existing.retry_count = 0
    existing.request_metadata = {"idempotency_key": "k1", "queue_status": "queued"}
    existing.status = "pending"
    existing.output_data = None
    existing.updated_at = None
    existing.created_at = None

    find_latest = AsyncMock(return_value=existing)
    monkeypatch.setattr(svc, "_find_latest_idempotent_request", find_latest)
    monkeypatch.setattr(
        svc,
        "_status_payload_from_request",
        MagicMock(
            return_value={
                "status": "queued",
                "execution_backend": "x",
                "stage": "s",
                "progress_message": "p",
                "idempotency_key": "k1",
                "metadata": {},
            }
        ),
    )
    built = {
        "request_id": "req-existing",
        "status": "queued",
        "estimated_time": 1,
        "message": "reuse",
        "cached": False,
        "reused": True,
    }
    monkeypatch.setattr(svc, "_build_reused_generation_response", AsyncMock(return_value=built))

    out = await svc.generate(
        user_id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        type_key="text_chat",
        input_data={"q": "hi"},
        idempotency_key="k1",
    )
    assert out["reused"] is True
    assert out["request_id"] == "req-existing"
    get_by_key.assert_called_once()
    find_latest.assert_awaited_once()


@pytest.mark.asyncio
async def test_status_and_result_reject_non_owner(monkeypatch: pytest.MonkeyPatch) -> None:
    """HTTP-facing status/result reads must not expose a leaked request UUID to another user."""
    db = MagicMock()
    svc = UnifiedGenerationService(db, content_service=None)
    request = SimpleNamespace(
        id="req-1",
        user_id="owner-user-id",
        status="completed",
        generation_type=SimpleNamespace(provider="llama"),
        output_data={"result": {"text": "private"}, "metadata": {}},
    )
    monkeypatch.setattr(svc, "_get_request_with_type", AsyncMock(return_value=request))

    with pytest.raises(PermissionError):
        await svc.get_status("req-1", user_id="other-user-id")

    with pytest.raises(PermissionError):
        await svc.get_result("req-1", user_id="other-user-id")


def test_ugs_result_cache_key_is_user_scoped() -> None:
    """Same UGS input from different users must not share cached private results."""
    svc = UnifiedGenerationService(MagicMock(), content_service=None)
    input_data = {"prompt": "same private prompt"}

    first = svc._generate_cache_key("text_chat", input_data, user_id="user-a")
    second = svc._generate_cache_key("text_chat", input_data, user_id="user-b")
    unscoped = svc._generate_cache_key("text_chat", input_data)

    assert first != second
    assert first != unscoped
    assert first.startswith("user:user-a:")


@pytest.mark.asyncio
async def test_status_route_maps_non_owner_to_403() -> None:
    endpoint = _generation_endpoint("/status/{request_id}")
    service = MagicMock()
    service.get_status = AsyncMock(side_effect=PermissionError("Нельзя просматривать этот запрос."))
    user = SimpleNamespace(id="owner-b")

    with pytest.raises(HTTPException) as exc:
        await endpoint(
            request_id=UUID("11111111-1111-4111-8111-111111111111"),
            user=user,
            ugs_service=service,
        )

    assert exc.value.status_code == 403
    service.get_status.assert_awaited_once_with(
        "11111111-1111-4111-8111-111111111111",
        user_id="owner-b",
    )


@pytest.mark.asyncio
async def test_result_route_maps_non_owner_to_403() -> None:
    endpoint = _generation_endpoint("/result/{request_id}")
    service = MagicMock()
    service.get_result = AsyncMock(side_effect=PermissionError("Нельзя просматривать этот запрос."))
    user = SimpleNamespace(id="owner-b")

    with pytest.raises(HTTPException) as exc:
        await endpoint(
            request_id=UUID("22222222-2222-4222-8222-222222222222"),
            user=user,
            ugs_service=service,
        )

    assert exc.value.status_code == 403
    service.get_result.assert_awaited_once_with(
        "22222222-2222-4222-8222-222222222222",
        user_id="owner-b",
    )
