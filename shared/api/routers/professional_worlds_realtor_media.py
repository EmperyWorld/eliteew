# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Realtor Pro media HTTP routes (attach/upload, intake streams, enhancement batches, PW albums).
# Invariants:
# - Routes mount on the main Professional Worlds router without a path prefix change.
# - Long enhancement/intake routes stream until result or explicit error; no empty success responses.
# - OpenAPI documents named text/event-stream payloads (Wave B5b residual) via shared SSE helper.
# Related:
# - api/routers/professional_worlds_realtor_media_runtime.py
# - api/routers/professional_worlds_deps.py
# - api/ewa_platform/schemas/pydantic/sse_openapi.py
# - api/routers/professional_worlds.py (AI text streams, playbooks, CRM-lite remain in monolith)
# - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md (B5b)
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import (  # type: ignore[import-untyped]
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.schemas.pydantic.sse_openapi import event_stream_openapi_responses
from api.routers.creative_studio_utils import build_unique_upload_filename, validate_professional_worlds_media_image
from api.routers.professional_worlds_deps import _current_user_id, _idempotency_key, _service
from api.routers.professional_worlds_realtor_media_runtime import (
    MAX_IMAGE_BYTES,
    _enqueue_realtor_media_content_processing,
    _get_content_service,
    _run_media_batch_stream,
    _run_media_enhancement,
    _stream_object_intake_preview,
)
from api.routers.ugs import get_ugs_service
from api.schemas.professional_worlds import (
    MediaEnhancementJobOut,
    MediaEnhancementRequest,
    ObjectIntakeCommitRequest,
    ObjectIntakeParseRequest,
    ProfessionalMediaAlbumCreate,
    ProfessionalMediaAlbumOut,
    ProfessionalMediaAlbumPatch,
    ProfessionalWorldsIntakeStreamSsePayloadDoc,
    ProfessionalWorldsMediaBatchStreamSsePayloadDoc,
    ProfessionalWorldsMediaEnhanceStreamSsePayloadDoc,
    RealtorMediaBatchCreate,
    RealtorMediaBatchDetailOut,
    RealtorMediaBatchItemOut,
    RealtorMediaBatchItemReviewBody,
    RealtorPropertyMediaCreate,
    RealtorPropertyMediaOut,
    RealtorPropertyOut,
)
from api.schemas.unified_content import ContentType, Visibility, build_content_create
from api.services.professional_worlds.media_rejected_cleanup import maybe_delete_rejected_enhancement_output
from api.services.ugs.unified_generation_service import UnifiedGenerationService

realtor_media_router = APIRouter()

_PW_INTAKE_STREAM_RESPONSES = event_stream_openapi_responses(
    model=ProfessionalWorldsIntakeStreamSsePayloadDoc,
    description=(
        "`text/event-stream` — SSE `event: started|result|error` with named JSON "
        "`data:` (`ProfessionalWorldsIntakeStreamSsePayloadDoc`); UGS progress/queued "
        "may also appear; keep-alive comments while waiting."
    ),
)

_PW_MEDIA_ENHANCE_STREAM_RESPONSES = event_stream_openapi_responses(
    model=ProfessionalWorldsMediaEnhanceStreamSsePayloadDoc,
    description=(
        "`text/event-stream` — SSE `event: started|result|error` with named JSON "
        "`data:` (`ProfessionalWorldsMediaEnhanceStreamSsePayloadDoc`); keep-alive "
        "comments while waiting."
    ),
)

_PW_MEDIA_BATCH_STREAM_RESPONSES = event_stream_openapi_responses(
    model=ProfessionalWorldsMediaBatchStreamSsePayloadDoc,
    description=(
        "`text/event-stream` — SSE `event: batch_started|batch_item_error|batch_finished` "
        "plus per-item enhance envelopes (`ProfessionalWorldsMediaBatchStreamSsePayloadDoc`); "
        "keep-alive comments while waiting."
    ),
)


@realtor_media_router.post(
    "/realtor/properties/{property_id}/media",
    response_model=RealtorPropertyMediaOut,
    status_code=status.HTTP_201_CREATED,
)
async def attach_realtor_property_media(
    property_id: UUID,
    payload: RealtorPropertyMediaCreate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Attach Unified Content media to a realtor property."""
    row = await _service(db).attach_property_media(_current_user_id(user), property_id, payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return row


@realtor_media_router.get("/realtor/properties/{property_id}/media", response_model=list[RealtorPropertyMediaOut])
async def list_realtor_property_media(
    property_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List Unified Content media attached to a realtor property."""
    rows = await _service(db).list_property_media(_current_user_id(user), property_id)
    if rows is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return rows


@realtor_media_router.delete(
    "/realtor/properties/{property_id}/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_realtor_property_media(
    property_id: UUID,
    media_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> None:
    """Remove a media attachment from a realtor property."""
    deleted = await _service(db).delete_property_media(_current_user_id(user), property_id, media_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")


@realtor_media_router.post(
    "/realtor/properties/intake/parse/stream",
    responses=_PW_INTAKE_STREAM_RESPONSES,
)
async def parse_realtor_property_intake_stream(
    payload: ObjectIntakeParseRequest,
    request: Request,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
    ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
) -> StreamingResponse:
    """Parse raw object text into a preview; does not save a property until commit."""
    user_id = _current_user_id(user)
    return StreamingResponse(
        _stream_object_intake_preview(
            user_id=user_id,
            service=_service(db),
            ugs_service=ugs_service,
            payload=payload,
            idempotency_key=_idempotency_key(payload.idempotency_key, request),
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@realtor_media_router.post("/realtor/properties/intake/commit", response_model=RealtorPropertyOut)
async def commit_realtor_property_intake(
    payload: ObjectIntakeCommitRequest,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Commit accepted intake preview fields into a property."""
    row = await _service(db).commit_object_intake(_current_user_id(user), payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intake job not found")
    return row


@realtor_media_router.post(
    "/realtor/properties/{property_id}/media/enhance/stream",
    responses=_PW_MEDIA_ENHANCE_STREAM_RESPONSES,
)
async def enhance_realtor_property_media_stream(
    property_id: UUID,
    payload: MediaEnhancementRequest,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
    content_service: Any = Depends(_get_content_service),  # noqa: B008
    ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
) -> StreamingResponse:
    """Enhance existing Unified Content image and save enhanced result."""
    user_id = _current_user_id(user)
    return StreamingResponse(
        _run_media_enhancement(
            user=user,
            user_id=user_id,
            property_id=property_id,
            payload=payload,
            service=_service(db),
            content_service=content_service,
            ugs_service=ugs_service,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@realtor_media_router.post(
    "/realtor/properties/{property_id}/media/upload-enhance/stream",
    responses=_PW_MEDIA_ENHANCE_STREAM_RESPONSES,
)
async def upload_and_enhance_realtor_property_media_stream(
    background_tasks: BackgroundTasks,
    property_id: UUID,
    preset_key: str = Form(...),
    instruction: str | None = Form(None),
    attach_on_complete: bool = Form(False),
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
    content_service: Any = Depends(_get_content_service),  # noqa: B008
    ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
) -> StreamingResponse:
    """Upload a photo to Unified Content, then run a photo preset enhancement."""
    user_id = _current_user_id(user)
    image_bytes = await image.read()
    validate_professional_worlds_media_image(image_bytes, max_bytes=MAX_IMAGE_BYTES)
    filename = build_unique_upload_filename(image.filename, prefix="realtor_source", fallback_extension=".png")
    content = await content_service.create_content(
        build_content_create(
            user_id=str(user_id),
            name=filename,
            description="Professional Worlds realtor source photo",
            tags=["professional_worlds", "realtor", "source_photo"],
            content_type=ContentType.IMAGE,
            mime_type=image.content_type or "image/png",
            visibility=Visibility.PRIVATE,
            original_filename=filename,
            source_service="professional_worlds",
            source_id=str(property_id),
            related_content=[],
            metadata={"property_id": str(property_id), "kind": "realtor_source_photo"},
        ),
        image_bytes,
        str(user_id),
    )
    await _enqueue_realtor_media_content_processing(
        background_tasks=background_tasks,
        content=content,
        file_data=image_bytes,
        filename=filename,
        mime_type=image.content_type or "image/png",
    )
    payload = MediaEnhancementRequest(
        content_id=content.id,
        preset_key=preset_key,
        instruction=instruction,
        attach_on_complete=attach_on_complete,
        idempotency_key=None,
    )
    return StreamingResponse(
        _run_media_enhancement(
            user=user,
            user_id=user_id,
            property_id=property_id,
            payload=payload,
            service=_service(db),
            content_service=content_service,
            ugs_service=ugs_service,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@realtor_media_router.post(
    "/realtor/properties/{property_id}/media/upload",
    response_model=RealtorPropertyMediaOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_realtor_property_media(
    background_tasks: BackgroundTasks,
    property_id: UUID,
    caption: str | None = Form(None),
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
    content_service: Any = Depends(_get_content_service),  # noqa: B008
) -> dict[str, Any]:
    """Upload a photo to Unified Content and attach it to a realtor property (no AI edit)."""
    user_id = _current_user_id(user)
    image_bytes = await image.read()
    validate_professional_worlds_media_image(image_bytes, max_bytes=MAX_IMAGE_BYTES)
    filename = build_unique_upload_filename(image.filename, prefix="realtor_source", fallback_extension=".png")
    content = await content_service.create_content(
        build_content_create(
            user_id=str(user_id),
            name=filename,
            description="Professional Worlds realtor source photo",
            tags=["professional_worlds", "realtor", "source_photo"],
            content_type=ContentType.IMAGE,
            mime_type=image.content_type or "image/png",
            visibility=Visibility.PRIVATE,
            original_filename=filename,
            source_service="professional_worlds",
            source_id=str(property_id),
            related_content=[],
            metadata={"property_id": str(property_id), "kind": "realtor_source_photo"},
        ),
        image_bytes,
        str(user_id),
    )
    await _enqueue_realtor_media_content_processing(
        background_tasks=background_tasks,
        content=content,
        file_data=image_bytes,
        filename=filename,
        mime_type=image.content_type or "image/png",
    )
    row = await _service(db).attach_property_media(
        user_id=user_id,
        property_id=property_id,
        payload=RealtorPropertyMediaCreate(
            unified_content_id=UUID(str(content.id)),
            caption=caption or None,
            sort_order=0,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return row


@realtor_media_router.get(
    "/realtor/properties/{property_id}/media/enhancements", response_model=list[MediaEnhancementJobOut]
)
async def list_realtor_media_enhancement_jobs(
    property_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List enhancement jobs for one property."""
    rows = await _service(db).list_media_enhancement_jobs(_current_user_id(user), property_id)
    if rows is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return rows


@realtor_media_router.post(
    "/realtor/properties/{property_id}/media/enhancements/{job_id}/accept", response_model=MediaEnhancementJobOut
)
async def accept_realtor_media_enhancement(
    property_id: UUID,
    job_id: UUID,
    attach: bool = True,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Accept an enhanced photo candidate and optionally attach it to the property."""
    user_id = _current_user_id(user)
    row = await _service(db).set_media_enhancement_decision(user_id, job_id, accepted=True)
    if row is None or row["property_id"] != property_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enhancement job not found")
    if attach and row.get("output_content_id"):
        sid_raw = row.get("source_content_id")
        await _service(db).apply_accepted_enhancement_to_property(
            user_id,
            property_id,
            source_content_id=UUID(str(sid_raw)) if sid_raw else None,
            output_content_id=UUID(str(row["output_content_id"])),
            preset_key=str(row.get("preset_key") or ""),
        )
    return row


@realtor_media_router.post(
    "/realtor/properties/{property_id}/media/enhancements/{job_id}/reject", response_model=MediaEnhancementJobOut
)
async def reject_realtor_media_enhancement(
    property_id: UUID,
    job_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
    content_service: Any = Depends(_get_content_service),  # noqa: B008
) -> dict[str, Any]:
    """Reject an enhanced photo candidate."""
    user_id = _current_user_id(user)
    row = await _service(db).set_media_enhancement_decision(user_id, job_id, accepted=False)
    if row is None or row["property_id"] != property_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enhancement job not found")
    oid_raw = row.get("output_content_id")
    out_id = UUID(str(oid_raw)) if oid_raw else None
    await maybe_delete_rejected_enhancement_output(content_service=content_service, user=user, output_content_id=out_id)
    return row


@realtor_media_router.post(
    "/realtor/properties/{property_id}/media/enhance/batches",
    response_model=RealtorMediaBatchDetailOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_realtor_media_enhancement_batch(
    property_id: UUID,
    payload: RealtorMediaBatchCreate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Queue an idempotent batch of Realtor media enhancements."""
    user_id = _current_user_id(user)
    detail = await _service(db).create_media_batch_job(
        user_id=user_id,
        property_id=property_id,
        preset_key=payload.preset_key,
        instruction=payload.instruction,
        source_content_ids=list(payload.source_content_ids),
        idempotency_key=payload.idempotency_key,
        batch_meta=dict(payload.batch_meta or {}),
    )
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    return detail


@realtor_media_router.get(
    "/realtor/properties/{property_id}/media/enhance/batches/{batch_id}",
    response_model=RealtorMediaBatchDetailOut,
)
async def get_realtor_media_enhancement_batch(
    property_id: UUID,
    batch_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Return Realtor media enhancement batch envelope."""
    detail = await _service(db).get_media_batch_job(_current_user_id(user), property_id, batch_id)
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    return detail


@realtor_media_router.patch(
    "/realtor/properties/{property_id}/media/enhance/batches/{batch_id}/items/{item_id}/review",
    response_model=RealtorMediaBatchItemOut,
)
async def review_realtor_media_batch_item(
    property_id: UUID,
    batch_id: UUID,
    item_id: UUID,
    body: RealtorMediaBatchItemReviewBody,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
    content_service: Any = Depends(_get_content_service),  # noqa: B008
) -> dict[str, Any]:
    """Persist before/after decision for one batch row."""
    user_id = _current_user_id(user)
    parsed = await _service(db).set_media_batch_item_review_decision(
        user_id,
        property_id=property_id,
        batch_id=batch_id,
        item_id=item_id,
        decision=body.decision,
    )
    if parsed is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch item not found")
    item_row_out, job_row_snap = parsed
    if body.decision == "accepted" and isinstance(job_row_snap, dict):
        oid_raw = job_row_snap.get("output_content_id")
        if oid_raw:
            sid_raw = job_row_snap.get("source_content_id")
            await _service(db).apply_accepted_enhancement_to_property(
                user_id,
                property_id,
                source_content_id=UUID(str(sid_raw)) if sid_raw else None,
                output_content_id=UUID(str(oid_raw)),
                preset_key=str(job_row_snap.get("preset_key") or ""),
            )
            jid_raw = job_row_snap.get("id")
            if jid_raw:
                await _service(db).set_media_enhancement_decision(user_id, UUID(str(jid_raw)), accepted=True)
    elif body.decision == "rejected" and isinstance(job_row_snap, dict):
        oid_raw = job_row_snap.get("output_content_id")
        oid = UUID(str(oid_raw)) if oid_raw else None
        await maybe_delete_rejected_enhancement_output(
            content_service=content_service, user=user, output_content_id=oid
        )
    return dict(item_row_out)


@realtor_media_router.post(
    "/realtor/properties/{property_id}/media/enhance/batches/{batch_id}/run/stream",
    responses=_PW_MEDIA_BATCH_STREAM_RESPONSES,
)
async def stream_realtor_media_enhancement_batch(
    property_id: UUID,
    batch_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
    content_service: Any = Depends(_get_content_service),  # noqa: B008
    ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
) -> StreamingResponse:
    """SSE stream that processes each queued batch item sequentially."""
    user_id = _current_user_id(user)
    return StreamingResponse(
        _run_media_batch_stream(
            user=user,
            user_id=user_id,
            property_id=property_id,
            batch_id=batch_id,
            service=_service(db),
            content_service=content_service,
            ugs_service=ugs_service,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@realtor_media_router.get("/media/albums", response_model=list[ProfessionalMediaAlbumOut])
async def list_professional_worlds_media_albums(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List PW media galleries for the authenticated user."""
    return await _service(db).list_professional_media_albums(_current_user_id(user))


@realtor_media_router.post(
    "/media/albums", response_model=ProfessionalMediaAlbumOut, status_code=status.HTTP_201_CREATED
)
async def create_professional_worlds_media_album(
    payload: ProfessionalMediaAlbumCreate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Persist a Realtor/PW unified-content album linkage."""
    return await _service(db).create_professional_media_album(_current_user_id(user), payload)


@realtor_media_router.patch("/media/albums/{album_id}", response_model=ProfessionalMediaAlbumOut)
async def patch_professional_worlds_media_album(
    album_id: UUID,
    payload: ProfessionalMediaAlbumPatch,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Patch PW media gallery membership or linkage."""
    row = await _service(db).patch_professional_media_album(_current_user_id(user), album_id, payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found")
    return row


@realtor_media_router.delete("/media/albums/{album_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_professional_worlds_media_album(
    album_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> None:
    """Delete a professional worlds media album owned by the current user."""
    deleted = await _service(db).delete_professional_media_album(_current_user_id(user), album_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Album not found")
