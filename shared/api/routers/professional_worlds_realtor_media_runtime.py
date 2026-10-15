# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Realtor Pro media SSE/stream helpers (intake preview, enhancement, batch driver).
# Invariants:
# - No FastAPI route registration here — safe for unit tests without python-multipart.
# - Batch lines pass stable `pw-media-batch:{batch_id}:{item_id}` idempotency keys to UGS.
# Related:
# - api/routers/professional_worlds_realtor_media.py
# - api/routers/professional_worlds_deps.py
# ---

from __future__ import annotations

from collections.abc import AsyncGenerator, Mapping
from datetime import UTC, datetime
from time import monotonic
from typing import Any
from uuid import UUID

from fastapi import BackgroundTasks  # type: ignore[import-untyped]

from api.core.auth import User
from api.routers.creative_studio_utils import (
    build_image_edit_input_data,
    run_studio_ugs_generate,
    validate_professional_worlds_media_image,
)
from api.routers.professional_worlds_deps import _sse, _strip_unresolved_prompt_tokens
from api.schemas.professional_worlds import (
    MediaEnhancementRequest,
    ObjectIntakeParseRequest,
    RealtorPropertyMediaCreate,
)
from api.services.professional_worlds.object_intake_parsing import extract_object_intake_text_from_ugs_result
from api.services.professional_worlds.service import (
    ProfessionalWorldsService,
    pw_media_display_name,
    pw_media_uc_metadata,
)
from api.services.queue_features import QUEUE_FLAG_DOCS, is_queue_enabled
from api.services.ugs.unified_generation_service import UnifiedGenerationService

MAX_IMAGE_BYTES = 10 * 1024 * 1024


def batch_media_item_idempotency_key(batch_id: UUID, batch_item_id: UUID) -> str:
    """Stable UGS idempotency key for one batch line (batch + item id)."""
    return f"pw-media-batch:{batch_id}:{batch_item_id}"


async def _get_content_service() -> Any:
    from api.routers.unified_content import get_content_service  # noqa: PLC0415

    return await get_content_service()


async def _enqueue_realtor_media_content_processing(
    *,
    background_tasks: BackgroundTasks,
    content: Any,
    file_data: bytes,
    filename: str,
    mime_type: str,
) -> None:
    """Queue Unified Content processing (thumbnails, metadata) after a realtor photo upload."""
    from api.routers.unified_content import process_content_background  # noqa: PLC0415
    from api.services.rabbitmq_service import get_rabbitmq_service  # noqa: PLC0415

    content_id = content.id
    content_type = content.content_type.value if hasattr(content.content_type, "value") else str(content.content_type)
    task_kwargs = {
        "content_id": content_id,
        "content_type": content_type,
        "file_data": file_data,
        "filename": filename,
        "mime_type": mime_type,
    }
    if is_queue_enabled(QUEUE_FLAG_DOCS, default=True):
        published = await get_rabbitmq_service().publish_document_processing(
            task_type="unified_content_process",
            content_id=str(content_id),
            payload={
                "content_id": str(content_id),
                "content_type": content_type,
                "mime_type": mime_type,
                "filename": filename,
            },
        )
        if not published:
            background_tasks.add_task(process_content_background, **task_kwargs)
    else:
        background_tasks.add_task(process_content_background, **task_kwargs)


def _build_pw_media_enhancement_input_data(
    *,
    prompt: str,
    image_base64: str,
    preset_type_key: str,
    preset_parameters: Mapping[str, Any],
    explicit_negative_prompt: str | None = None,
    seed: int = -1,
) -> dict[str, Any]:
    """Build Image Studio-like edit payload for PW runtime using DB preset parameters."""
    _ = preset_type_key
    clean_prompt = _strip_unresolved_prompt_tokens(prompt).strip()
    explicit_negative = (explicit_negative_prompt or "").strip()
    data: dict[str, Any] = build_image_edit_input_data(
        prompt=clean_prompt,
        image_base64=image_base64,
        negative_prompt=explicit_negative,
        seed=seed,
        extra=dict(preset_parameters or {}),
    )
    return data


async def _stream_object_intake_preview(
    *,
    user_id: UUID,
    service: ProfessionalWorldsService,
    ugs_service: UnifiedGenerationService,
    payload: ObjectIntakeParseRequest,
    idempotency_key: str | None,
) -> AsyncGenerator[str]:
    """Stream object intake extraction, save preview job, and stop before property commit."""
    prompt = service.build_object_intake_prompt(payload.source_text)
    try:
        start_payload = await ugs_service.start_generation_for_stream(
            user_id=str(user_id),
            type_key="professional_worlds_realtor_object_extract",
            input_data=service.build_ugs_input(prompt),
            project_id=None,
            company_id=None,
            priority=5,
            idempotency_key=idempotency_key,
        )
    except ValueError as exc:
        yield _sse("error", {"error": str(exc)})
        return
    if start_payload.get("status") == "completed":
        text_out = extract_object_intake_text_from_ugs_result(
            start_payload.get("result"),
            start_payload.get("result_preview"),
        )
        preview = service.parse_object_intake_result(
            text_out,
            payload.source_text,
            idempotency_key=idempotency_key,
        )
        job = await service.save_object_intake_preview(user_id=user_id, payload=payload, preview=preview)
        yield _sse(
            "result",
            {
                "job_id": job["id"],
                "property": preview["property"],
                "confidence": preview["confidence"],
                "warnings": preview["warnings"],
                "source_text": payload.source_text,
                "intake_diagnostics": preview.get("intake_diagnostics"),
            },
        )
        return
    request_id = start_payload.get("request_id")
    if not request_id:
        yield _sse("error", {"error": "UGS did not return request_id"})
        return
    yield _sse("started", {"request_id": request_id, "status": start_payload.get("status", "processing")})
    async for event in ugs_service.stream_generation_events(
        str(request_id), str(user_id), poll_interval=2.5, keep_alive_interval=2.0
    ):
        event_type = str(event.get("event") or "message")
        if event_type == "keep_alive":
            yield ": keep-alive\n\n"
            continue
        if event_type == "result":
            text_out = extract_object_intake_text_from_ugs_result(
                event.get("result"),
                event.get("result_preview"),
            )
            if not text_out:
                yield _sse("error", {"error": "Object intake finished without result text"})
                return
            preview = service.parse_object_intake_result(
                text_out,
                payload.source_text,
                idempotency_key=idempotency_key,
            )
            job = await service.save_object_intake_preview(
                user_id=user_id,
                payload=payload,
                preview=preview,
                ugs_request_id=UUID(str(event.get("request_id"))) if event.get("request_id") else None,
            )
            yield _sse(
                "result",
                {
                    "job_id": job["id"],
                    "property": preview["property"],
                    "confidence": preview["confidence"],
                    "warnings": preview["warnings"],
                    "source_text": payload.source_text,
                    "intake_diagnostics": preview.get("intake_diagnostics"),
                },
            )
            return
        if event_type == "error":
            yield _sse("error", {"error": event.get("error") or "UGS generation failed"})
            return
        yield _sse(event_type, event)
    yield _sse("error", {"error": "UGS stream finished without final result"})


async def _run_media_batch_stream(
    *,
    user: User,
    user_id: UUID,
    property_id: UUID,
    batch_id: UUID,
    service: ProfessionalWorldsService,
    content_service: Any,
    ugs_service: UnifiedGenerationService,
) -> AsyncGenerator[str]:
    """Sequential batch enhancement SSE stream with `: keep-alive` heartbeats (~2s)."""
    detail = await service.get_media_batch_job(user_id, property_id, batch_id)
    last_ping = monotonic()
    if not detail:
        yield _sse("error", {"error": "Batch not found"})
        return
    raw_batch = detail.get("batch") if isinstance(detail.get("batch"), dict) else None
    ej_rows = detail.get("enhancement_jobs") or []
    ej0_dict: dict[str, Any] = {}
    if isinstance(ej_rows, list) and ej_rows:
        first_row = ej_rows[0]
        if isinstance(first_row, dict):
            ej0_dict = dict(first_row)
    if raw_batch is not None:
        batch_header = dict(raw_batch)
    else:
        batch_header = {
            "preset_key": ej0_dict.get("preset_key") or "",
            "instruction": ej0_dict.get("instruction"),
        }
    items = list(detail.get("items") or [])
    enhancement_index: dict[UUID, dict[str, Any]] = {
        UUID(str(row["id"])): dict(row)
        for row in (ej_rows if isinstance(ej_rows, list) else [])
        if isinstance(row, Mapping)
    }
    prop_row = await service.get_property(user_id, property_id)
    brand_row = await service.get_brand_visual_kit(user_id)
    kit_snap = (
        dict(brand_row["kit"]) if isinstance(brand_row, dict) and isinstance(brand_row.get("kit"), dict) else None
    )

    yield _sse(
        "batch_started",
        {
            "batch_id": batch_id,
            "total": len(items),
        },
    )
    locked = await service.set_media_batch_job_status(user_id, batch_id, status_label="running")
    if not locked:
        yield _sse("error", {"error": "Unable to lock batch"})
        return

    for idx, item in enumerate(items):
        if monotonic() - last_ping >= 2.0:
            yield ": keep-alive\n\n"
            last_ping = monotonic()
        jid = item.get("enhancement_job_id")
        job_row = enhancement_index.get(UUID(str(jid))) if jid else None
        if job_row is None:
            yield _sse(
                "batch_item_error",
                {
                    "item_index": idx,
                    "error": "Missing enhancement row",
                    "batch_item_id": item.get("id"),
                },
            )
            continue

        sse_ctx = {
            "batch_id": batch_id,
            "batch_job_id": batch_id,
            "batch_item_id": item["id"],
            "item_index": idx,
        }
        await service.set_media_batch_line_status(
            user_id,
            batch_item_id=UUID(str(item["id"])),
            line_status="processing",
            error=None,
        )
        media_payload = MediaEnhancementRequest(
            content_id=UUID(str(item["source_content_id"])),
            preset_key=str(batch_header["preset_key"]),
            instruction=batch_header.get("instruction"),
            reuse_existing_duplicate_job=True,
            attach_on_complete=False,
            idempotency_key=batch_media_item_idempotency_key(batch_id, UUID(str(item["id"]))),
        )
        async for pkt in _run_media_enhancement(
            user=user,
            user_id=user_id,
            property_id=property_id,
            payload=media_payload,
            service=service,
            content_service=content_service,
            ugs_service=ugs_service,
            existing_job=dict(job_row),
            sse_ctx=sse_ctx,
            property_row=dict(prop_row) if prop_row is not None else None,
            brand_kit=kit_snap,
        ):
            yield pkt

    await service.set_media_batch_job_status(user_id, batch_id, status_label="completed")
    yield _sse("batch_finished", {"batch_id": batch_id})


async def _run_media_enhancement(
    *,
    user: User,
    user_id: UUID,
    property_id: UUID,
    payload: MediaEnhancementRequest,
    service: ProfessionalWorldsService,
    content_service: Any,
    ugs_service: UnifiedGenerationService,
    existing_job: dict[str, Any] | None = None,
    sse_ctx: dict[str, Any] | None = None,
    property_row: dict[str, Any] | None = None,
    brand_kit: dict[str, Any] | None = None,
) -> AsyncGenerator[str]:
    """Run image enhancement through Image Studio/UGS and save output to Unified Content."""
    from api.routers.image_studio import _b64_from_bytes  # noqa: PLC0415
    from api.services.image_studio.response_finalize import (  # noqa: PLC0415
        any_image_has_data,
        hydrate_studio_images_from_content,
        persist_image_result,
        unwrap_image_block,
    )

    preset = await service.get_photo_preset("realtor", payload.preset_key)
    trail = dict(sse_ctx) if sse_ctx else {}

    async def _reconcile(snapshot: dict[str, Any]) -> None:
        if sse_ctx is None:
            return
        raw_item = sse_ctx.get("batch_item_id")
        if raw_item is None:
            return
        await service.reconcile_batch_line_from_job(user_id, batch_item_id=UUID(str(raw_item)), job_snapshot=snapshot)

    if preset is None:
        yield _sse("error", {**trail, "error": "Photo preset not found or disabled"})
        return

    preset_display = str(preset.get("display_name") or payload.preset_key)
    prop_ctx = dict(property_row) if property_row is not None else None
    if prop_ctx is None:
        pr_g = await service.get_property(user_id, property_id)
        prop_ctx = dict(pr_g) if pr_g is not None else None
    brand_ctx = brand_kit
    if brand_ctx is None:
        bk_g = await service.get_brand_visual_kit(user_id)
        brand_ctx = dict(bk_g["kit"]) if isinstance(bk_g, dict) and isinstance(bk_g.get("kit"), dict) else None

    if existing_job is not None:
        job = dict(existing_job)
    else:
        job_row = await service.create_media_enhancement_job(user_id=user_id, property_id=property_id, payload=payload)
        if job_row is None:
            yield _sse("error", {**trail, "error": "Property not found"})
            return
        job = dict(job_row)
    jid = UUID(str(job["id"]))
    yield _sse("started", {"job_id": jid, "status": job.get("status"), **trail})

    suffix = datetime.now(UTC).strftime("%Y%m%d-%H%M%SZ")
    display_name = pw_media_display_name(
        vertical_slug="realtor",
        preset_key=str(payload.preset_key),
        property_title=(prop_ctx or {}).get("title"),
        time_suffix=suffix,
    )

    ej_batch = job.get("batch_job_id")
    sse_item = sse_ctx.get("batch_item_id") if sse_ctx else None
    base_meta_core = pw_media_uc_metadata(
        vertical_slug="realtor",
        preset_key=str(payload.preset_key),
        property_id=property_id,
        enhancement_job_id=jid,
        batch_job_id=UUID(str(ej_batch)) if ej_batch else None,
        batch_item_id=UUID(str(sse_item)) if sse_item else None,
    )
    brand_hints: dict[str, Any] = {}
    if isinstance(brand_ctx, dict):
        for hint_key in (
            "primary_color",
            "secondary_color",
            "logo_content_id",
            "typography_notes",
            "watermark_mode",
        ):
            if brand_ctx.get(hint_key) is not None:
                brand_hints[str(hint_key)] = brand_ctx.get(hint_key)
    uc_metadata = dict(base_meta_core.get("eliteew_pw_media") or {})
    uc_metadata["preset_display_name"] = preset_display
    if brand_hints:
        uc_metadata["brand_hints"] = brand_hints

    merged_metadata = {"eliteew_pw_media": uc_metadata}

    try:
        if payload.reuse_existing_duplicate_job:
            dup = await service.find_reusable_enhancement_duplicate(
                user_id,
                property_id,
                UUID(str(payload.content_id)),
                str(payload.preset_key),
            )
            out_uuid = dup.get("output_content_id") if dup else None
            if dup and out_uuid is not None:
                completed = await service.complete_media_enhancement_job(
                    user_id=user_id,
                    job_id=jid,
                    output_content_id=UUID(str(out_uuid)),
                    provider_result={
                        "reuse": True,
                        "preset": preset,
                        "from_job_id": str(dup.get("id")),
                    },
                    status="completed",
                )
                persisted = {"history_saved": False, "content_id": str(out_uuid)}
                if payload.attach_on_complete:
                    await service.attach_property_media(
                        user_id,
                        property_id,
                        RealtorPropertyMediaCreate(
                            unified_content_id=UUID(str(out_uuid)),
                            caption=f"AI: {preset_display}",
                            sort_order=0,
                        ),
                    )
                snapshot = dict(completed or {}) if completed else {}
                await _reconcile(snapshot)
                yield _sse(
                    "result",
                    {"job": completed or job, "content": persisted, **trail},
                )
                return

        image_bytes, meta = await content_service.read_file_bytes_for_owner(payload.content_id, str(user_id))
        validate_professional_worlds_media_image(image_bytes, max_bytes=MAX_IMAGE_BYTES)

        prompt = service.render_ai_action_prompt(
            str(preset["prompt_template"]),
            {
                "instruction": payload.instruction or "",
                "preset": preset_display,
                "preset_display_name": preset_display,
            },
        )
        prompt = _strip_unresolved_prompt_tokens(prompt).strip()
        resp = await run_studio_ugs_generate(
            ugs_service,
            user_id=str(user_id),
            type_key=str(preset["ugs_type_key"]),
            input_data=_build_pw_media_enhancement_input_data(
                prompt=prompt,
                image_base64=_b64_from_bytes(image_bytes),
                preset_type_key=str(payload.preset_key),
                preset_parameters=dict(preset.get("parameters") or {}),
            ),
            idempotency_key=payload.idempotency_key,
        )
        block = unwrap_image_block(resp)
        images = await hydrate_studio_images_from_content(
            block.get("images") or [],
            user_id=str(user_id),
            content_service=content_service,
        )
        if not images or not any_image_has_data(images):
            failed_snapshot = await service.complete_media_enhancement_job(
                user_id=user_id,
                job_id=jid,
                output_content_id=None,
                provider_result={"error": "No enhanced image returned"},
                status="failed",
            )
            await _reconcile(dict(failed_snapshot or {}))
            yield _sse("error", {**trail, "error": "No enhanced image returned", "job": failed_snapshot})
            return

        persisted = await persist_image_result(
            content_service=content_service,
            user=user,
            first_image=images[0],
            name=display_name,
            description=f"Realtor media enhancement ({preset_display})",
            tags=[
                "professional_worlds",
                "realtor",
                "media_enhancement",
                payload.preset_key,
                "source:ucs",
            ],
            metadata=merged_metadata,
        )
        output_id_raw = persisted.get("content_id")
        output_content_id = UUID(str(output_id_raw)) if output_id_raw else None
        completed_ok = await service.complete_media_enhancement_job(
            user_id=user_id,
            job_id=jid,
            output_content_id=output_content_id,
            provider_result={"preset": preset, "response": resp, "source_meta": meta, "content": persisted},
            status="completed",
        )
        if payload.attach_on_complete and output_content_id:
            await service.attach_property_media(
                user_id,
                property_id,
                RealtorPropertyMediaCreate(
                    unified_content_id=output_content_id,
                    caption=f"AI: {preset_display}",
                    sort_order=0,
                ),
            )
        await _reconcile(dict(completed_ok or {}))
        yield _sse("result", {"job": completed_ok, "content": persisted, **trail})
    except Exception as exc:
        completed_fail = await service.complete_media_enhancement_job(
            user_id=user_id,
            job_id=jid,
            output_content_id=None,
            provider_result={"error": str(exc)},
            status="failed",
        )
        await _reconcile(dict(completed_fail or {}))
        yield _sse(
            "error",
            {
                **trail,
                "error": str(exc),
                "job": completed_fail,
            },
        )
