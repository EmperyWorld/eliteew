# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Byte download, thumbnail, ticket, and archive ZIP routes.
# Invariants:
# - Mounted without extra prefix under unified_content parent.
# Related:
# - api/routers/unified_content_deps.py
# ---

from __future__ import annotations

import io
import logging
from datetime import UTC, datetime
from email.utils import format_datetime
from hashlib import sha1
from typing import Literal, cast
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request  # type: ignore[import-untyped]
from fastapi.responses import Response, StreamingResponse  # type: ignore[import-untyped]
from pydantic import BaseModel, Field  # type: ignore[import-untyped]
from starlette import status

from api.core.oauth2_auth import require_oauth2_user, require_oauth2_user_short_session
from api.dependencies.user_context import get_current_user_db_id as get_content_user_id
from api.dependencies.user_context import (
    get_current_user_db_id_short_session as get_content_user_id_short_session,
)
from api.models import User
from api.routers.unified_content_deps import (
    _STORAGE_OBJECT_UNAVAILABLE_DETAIL,
    _STORAGE_TEMPORARILY_UNAVAILABLE_DETAIL,
    ARCHIVE_AUDIT_ACTION,
    ARCHIVE_DOWNLOAD_CONCURRENCY,
    _content_blob_admin_read_bypass,
    _raise_file_data_empty,
    _raise_internal_server_error,
    _raise_max_batch_size_exceeded,
    _raise_no_accessible_files,
    _raise_no_content_ids_provided,
    _raise_storage_backend_not_set,
    get_content_download_ticket_service,
    get_content_service,
)
from api.schemas.unified_content import Content
from api.services.unified_content.content_archive_service import ContentArchiveService
from api.services.unified_content.content_download_ticket_service import (
    ContentDownloadTicketService,
    ContentDownloadTicketUnavailableError,
)
from api.services.unified_content.content_storage_service import ContentStorageService
from api.services.unified_content.storage_backends.minio_storage import (
    SeaweedFileCorruptedError,
    SeaweedFileNotFoundError,
    SeaweedStorageUnavailableError,
)
from api.services.unified_content.storage_integrity import StorageBlobKnownBrokenError
from api.utils.content_download_filename import (
    build_content_disposition_filename,
    display_name_for_content_download,
)
from api.utils.content_mime_normalization import normalized_mime_type

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Unified Content"])

# MIME controls convenience only. The response sandbox protects every byte stream,
# including incorrect metadata, polyglots, old tickets and partial responses.
_INLINE_DOWNLOAD_MIMES = frozenset(
    {
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/avif",
        "image/bmp",
        "image/x-icon",
        "image/vnd.microsoft.icon",
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/json",
        "audio/mpeg",
        "audio/mp4",
        "audio/aac",
        "audio/wav",
        "audio/x-wav",
        "audio/flac",
        "audio/ogg",
        "audio/aiff",
        "audio/x-aiff",
        "audio/x-ms-wma",
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/quicktime",
        "video/x-matroska",
        "audio/webm",
    }
)
_DOWNLOAD_SECURITY_HEADERS = {
    "Content-Security-Policy": "sandbox; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
}


def _http_storage_object_unavailable() -> HTTPException:
    return HTTPException(status_code=404, detail=_STORAGE_OBJECT_UNAVAILABLE_DETAIL)


async def _reject_known_broken_blob(
    service: ContentStorageService,
    content_id: UUID,
) -> None:
    """Raise 404 before Seaweed I/O when quarantine/neg-cache already says broken."""
    try:
        await service.ensure_storage_blob_readable(content_id)
    except StorageBlobKnownBrokenError:
        raise _http_storage_object_unavailable() from None


class ContentDownloadTicketRequest(BaseModel):
    """Request a short-lived direct browser download ticket for one content item."""

    disposition: Literal["attachment", "inline"] = "attachment"
    v: str | None = Field(default=None, max_length=128)


class ContentDownloadTicketResponse(BaseModel):
    """Relative direct-download URL and ticket TTL."""

    download_url: str
    expires_in_seconds: int


async def _build_content_download_response(
    *,
    content_id: UUID,
    request: Request,
    content_user_id: str,
    service: ContentStorageService,
    disposition: Literal["attachment", "inline"] = "attachment",
    v: str | None = None,
    check_permissions: bool = True,
) -> Response:
    """Build the byte response used by Bearer and ticket download routes."""
    try:
        content = await service.get_content(
            content_id,
            content_user_id,
            check_permissions=check_permissions,
        )

        if content.storage_backend is None:
            _raise_storage_backend_not_set()
        assert content.storage_backend is not None
        storage_backend = content.storage_backend
        backend = service.storage_factory.get_backend_by_name(storage_backend.value)

        # Gate outside retrieve try — never raise HTTPException inside bare Exception map.
        await _reject_known_broken_blob(service, content_id)

        try:
            file_data = await backend.retrieve(content.file_path or "", content_id, fail_fast=True)
        except SeaweedStorageUnavailableError as storage_error:
            logger.warning(
                "unified_content download: storage temporarily unavailable content_id=%s: %s",
                content_id,
                storage_error,
            )
            raise HTTPException(status_code=503, detail=_STORAGE_TEMPORARILY_UNAVAILABLE_DETAIL) from storage_error
        except (SeaweedFileNotFoundError, SeaweedFileCorruptedError) as storage_error:
            logger.warning(
                "unified_content download: storage object missing/unreadable content_id=%s: %s",
                content_id,
                storage_error,
            )
            try:
                await service.quarantine_from_storage_error(
                    content_id,
                    storage_error,
                    actor_user_id=content_user_id,
                )
            except Exception:
                logger.exception(
                    "[STEP] content_storage_quarantine_fail content_id=%s",
                    content_id,
                )
            raise _http_storage_object_unavailable() from storage_error
        except ValueError as storage_error:
            logger.warning("unified_content download: storage object missing content_id=%s", content_id)
            raise _http_storage_object_unavailable() from storage_error
        except FileNotFoundError as storage_error:
            logger.warning("unified_content download: storage object missing content_id=%s", content_id)
            raise _http_storage_object_unavailable() from storage_error
        except Exception as storage_error:
            _raise_internal_server_error("download_content.storage", storage_error)

        if not file_data:
            _raise_file_data_empty()

        stream_mime = normalized_mime_type(content.mime_type, content.original_filename)
        if not stream_mime:
            stream_mime = content.mime_type or "application/octet-stream"

        await service.audit_logger.log(
            content_id=content_id,
            user_id=content_user_id,
            action="accessed_download",
            details={"file_size": len(file_data)},
        )

        raw_name = build_content_disposition_filename(
            display_name_for_content_download(content.title, content.name),
            content.original_filename,
        )
        mime_essence = stream_mime.split(";", 1)[0].strip().lower()
        content_disp_type = (
            "inline" if disposition == "inline" and mime_essence in _INLINE_DOWNLOAD_MIMES else "attachment"
        )
        try:
            encoded_name = quote(raw_name, safe="")
            content_disp = f"{content_disp_type}; filename*=UTF-8''{encoded_name}"
        except Exception:
            content_disp = f'{content_disp_type}; filename="download"'

        file_size = len(file_data)
        version_basis = f"{getattr(content, 'file_hash', '')}:{getattr(content, 'updated_at', '')}:{v or ''}"
        etag = f'"uc-safe-v1-{sha1(f"{content_id}:{version_basis}:{file_size}".encode()).hexdigest()}"'

        updated_at = getattr(content, "updated_at", None) or getattr(content, "created_at", None)
        if isinstance(updated_at, datetime):
            if updated_at.tzinfo is None:
                updated_at = updated_at.replace(tzinfo=UTC)
            last_modified = format_datetime(updated_at.astimezone(UTC), usegmt=True)
        else:
            last_modified = format_datetime(datetime.now(UTC), usegmt=True)

        base_headers = {
            **_DOWNLOAD_SECURITY_HEADERS,
            "Content-Disposition": content_disp,
            "Cache-Control": "private, max-age=3600, stale-while-revalidate=120",
            "ETag": etag,
            "Last-Modified": last_modified,
            "Accept-Ranges": "bytes",
            "Vary": "Authorization",
        }

        if_none_match = request.headers.get("if-none-match")
        if if_none_match and (etag in if_none_match or if_none_match.strip() == "*"):
            return Response(status_code=304, headers=base_headers)

        range_header = request.headers.get("range")
        if range_header and range_header.startswith("bytes="):
            range_spec = range_header[6:].split(",", 1)[0].strip()
            try:
                start_text, end_text = range_spec.split("-", 1)
                if start_text == "" and end_text == "":
                    raise ValueError("Empty range")
                if start_text == "":
                    suffix_length = int(end_text)
                    if suffix_length <= 0:
                        raise ValueError("Invalid suffix range")
                    start = max(file_size - suffix_length, 0)
                    end = file_size - 1
                else:
                    start = int(start_text)
                    end = int(end_text) if end_text else file_size - 1
                if start < 0 or start >= file_size:
                    raise ValueError("Range start out of bounds")
                end = min(end, file_size - 1)
                if end < start:
                    raise ValueError("Range end before start")
            except ValueError:
                return Response(
                    status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                    headers={
                        **base_headers,
                        "Content-Range": f"bytes */{file_size}",
                    },
                )

            chunk = file_data[start : end + 1]
            return StreamingResponse(
                io.BytesIO(chunk),
                media_type=stream_mime,
                status_code=status.HTTP_206_PARTIAL_CONTENT,
                headers={
                    **base_headers,
                    "Content-Length": str(len(chunk)),
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                },
            )

        return StreamingResponse(
            io.BytesIO(file_data),
            media_type=stream_mime,
            headers={
                **base_headers,
                "Content-Length": str(file_size),
            },
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except Exception as e:
        logger.exception("Download failed")
        _raise_internal_server_error("download_content", e)


@router.post("/content/{content_id:uuid}/download-ticket", response_model=ContentDownloadTicketResponse)
async def create_content_download_ticket(
    content_id: UUID,
    body: ContentDownloadTicketRequest,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
    ticket_service: ContentDownloadTicketService = Depends(get_content_download_ticket_service),
) -> ContentDownloadTicketResponse:
    """Issue a short-lived ticket URL for direct browser download."""
    try:
        await service.get_content(
            content_id,
            content_user_id,
            check_permissions=not _content_blob_admin_read_bypass(current_user),
        )
        ticket, ttl = await ticket_service.issue(
            kind="content",
            user_id=content_user_id,
            resource_id=content_id,
            disposition=body.disposition,
            revision=body.v,
        )
        return ContentDownloadTicketResponse(
            download_url=f"/api/v1/content/{content_id}/download-by-ticket?ticket={ticket}",
            expires_in_seconds=ttl,
        )
    except ContentDownloadTicketUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e


@router.get("/content/{content_id:uuid}/download-by-ticket")
async def download_content_by_ticket(
    content_id: UUID,
    request: Request,
    ticket: str = Query(..., min_length=8, max_length=256),
    service: ContentStorageService = Depends(get_content_service),
    ticket_service: ContentDownloadTicketService = Depends(get_content_download_ticket_service),
) -> Response:
    """Direct content download for short-lived ticket URLs used by browsers."""
    payload = await ticket_service.consume(ticket, expected_kind="content", request=request)
    if not payload or str(payload.get("resource_id") or "") != str(content_id):
        raise HTTPException(status_code=401, detail="Download ticket is invalid or expired.")
    user_id = str(payload.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="Download ticket is invalid or expired.")
    disposition = "inline" if payload.get("disposition") == "inline" else "attachment"
    revision = str(payload.get("revision") or "") or None
    return await _build_content_download_response(
        content_id=content_id,
        request=request,
        content_user_id=user_id,
        service=service,
        disposition=disposition,
        v=revision,
        check_permissions=True,
    )


@router.get("/content/{content_id:uuid}/download")
async def download_content(
    content_id: UUID,
    request: Request,
    current_user: User = Depends(require_oauth2_user_short_session),
    content_user_id: str = Depends(get_content_user_id_short_session),
    service: ContentStorageService = Depends(get_content_service),
    disposition: Literal["attachment", "inline"] = Query("attachment"),
    v: str | None = Query(None),
) -> Response:
    """
    Download content file

    - Automatic permission check
    - Streams from PostgreSQL or SeaweedFS based on storage_backend
    - Audit log for download action
    """
    return await _build_content_download_response(
        content_id=content_id,
        request=request,
        content_user_id=content_user_id,
        service=service,
        disposition=disposition,
        v=v,
        check_permissions=not _content_blob_admin_read_bypass(current_user),
    )


@router.get("/content/{content_id:uuid}/thumbnail")
async def get_content_thumbnail(
    content_id: UUID,
    current_user: User = Depends(require_oauth2_user_short_session),
    content_user_id: str = Depends(get_content_user_id_short_session),
    service: ContentStorageService = Depends(get_content_service),
) -> StreamingResponse:
    """
    Stream thumbnail image for content.

    - Same permission check as download
    - When ``thumbnail_path`` is missing (or stored object gone) for regenerable
      types (image / PDF / text), lazily generate+persist a JPEG derivative
    - ``broken_quarantined`` stays 404 without heal
    - Non-regenerable types (video/office/…) stay 404 when no path
    """
    try:
        content = await service.get_content(
            content_id,
            content_user_id,
            check_permissions=not _content_blob_admin_read_bypass(current_user),
        )

        from api.services.unified_content.document_thumbnail import (  # noqa: PLC0415
            should_lazy_heal_thumbnail,
            try_lazy_heal_thumbnail,
        )
        from api.services.unified_content.processors.image_processor import (  # noqa: PLC0415
            sniff_image_media_type,
        )

        async def _stream_thumb(thumb_data: bytes, thumb_path: str | None) -> StreamingResponse:
            if not thumb_data:
                _raise_file_data_empty()
            media_type = sniff_image_media_type(thumb_data, thumb_path)
            return StreamingResponse(
                io.BytesIO(thumb_data),
                media_type=media_type,
                headers={"Content-Length": str(len(thumb_data))},
            )

        async def _heal_from_original() -> StreamingResponse | None:
            """Best-effort lazy heal; None → caller keeps 404 path."""
            filename = content.original_filename or content.name
            if not should_lazy_heal_thumbnail(content.mime_type, filename):
                return None
            if content.storage_backend is None:
                return None
            assert content.storage_backend is not None
            backend = service.storage_factory.get_backend_by_name(content.storage_backend.value)
            try:
                await service.ensure_storage_blob_readable(content_id)
            except StorageBlobKnownBrokenError:
                return None
            try:
                file_data = await backend.retrieve(content.file_path or "", content_id, fail_fast=True)
            except Exception:
                logger.exception(
                    "[STEP] document_thumbnail_skip content_id=%s reason=heal_original_read_fail",
                    content_id,
                )
                return None
            if not file_data:
                return None
            _path, jpeg = await try_lazy_heal_thumbnail(
                db_pool=service.db_pool,
                content_id=content_id,
                mime=content.mime_type,
                filename=filename,
                file_data=file_data,
                extracted_text=content.extracted_text,
            )
            if not jpeg:
                return None
            return await _stream_thumb(jpeg, _path)

        if not content.thumbnail_path:
            healed = await _heal_from_original()
            if healed is not None:
                return healed
            raise HTTPException(
                status_code=404,
                detail="Thumbnail not available for this content",
            ) from None

        if content.storage_backend is None:
            _raise_storage_backend_not_set()
        assert content.storage_backend is not None
        backend = service.storage_factory.get_backend_by_name(content.storage_backend.value)

        await _reject_known_broken_blob(service, content_id)

        try:
            thumb_data = await backend.retrieve(content.thumbnail_path, content_id, fail_fast=True)
        except SeaweedStorageUnavailableError as e:
            logger.warning(
                "unified_content thumbnail: storage temporarily unavailable content_id=%s: %s",
                content_id,
                e,
            )
            raise HTTPException(status_code=503, detail=_STORAGE_TEMPORARILY_UNAVAILABLE_DETAIL) from e
        except (SeaweedFileNotFoundError, SeaweedFileCorruptedError) as e:
            logger.warning(
                "unified_content thumbnail: storage object missing/unreadable content_id=%s: %s",
                content_id,
                e,
            )
            # Prefer regenerable heal; do not quarantine the original for a missing derivative.
            healed = await _heal_from_original()
            if healed is not None:
                return healed
            raise _http_storage_object_unavailable() from e
        except ValueError as e:
            logger.warning("unified_content thumbnail: storage object missing content_id=%s", content_id)
            healed = await _heal_from_original()
            if healed is not None:
                return healed
            raise _http_storage_object_unavailable() from e
        except FileNotFoundError as e:
            logger.warning("unified_content thumbnail: storage object missing content_id=%s", content_id)
            healed = await _heal_from_original()
            if healed is not None:
                return healed
            raise _http_storage_object_unavailable() from e
        except Exception as e:
            _raise_internal_server_error("get_content_thumbnail.storage", e)

        return await _stream_thumb(thumb_data, content.thumbnail_path)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except Exception as e:
        logger.exception("Thumbnail failed")
        _raise_internal_server_error("get_content_thumbnail", e)


@router.get("/unified-content/{content_id}/thumbnail")
async def get_content_thumbnail_legacy(
    content_id: UUID,
    current_user: User = Depends(require_oauth2_user_short_session),
    content_user_id: str = Depends(get_content_user_id_short_session),
    service: ContentStorageService = Depends(get_content_service),
) -> StreamingResponse:
    """Legacy: /api/unified-content/{id}/thumbnail → same as /content/{id}/thumbnail."""
    return await get_content_thumbnail(
        content_id=content_id,
        current_user=current_user,
        content_user_id=content_user_id,
        service=service,
    )


@router.get("/unified-content/{content_id}/download")
async def download_content_legacy(
    content_id: UUID,
    request: Request,
    current_user: User = Depends(require_oauth2_user_short_session),
    content_user_id: str = Depends(get_content_user_id_short_session),
    service: ContentStorageService = Depends(get_content_service),
) -> Response:
    """
    Legacy download endpoint for backward compatibility.

    - Supports old URLs like /api/unified-content/{id}/download
    - Delegates to the main /content/{id}/download handler
    """
    return await download_content(
        content_id=content_id,
        request=request,
        current_user=current_user,
        content_user_id=content_user_id,
        service=service,
    )


class ArchiveDownloadRequest(BaseModel):
    """Base request model for ZIP archive downloads."""

    archive_name: str | None = None


class BatchDownloadRequest(ArchiveDownloadRequest):
    """Request model for batch download."""

    content_ids: list[UUID]


def _build_archive_name(requested_name: str | None, default_prefix: str) -> str:
    """Normalize archive name and guarantee a .zip suffix."""
    normalized_name = (requested_name or "").strip()
    if not normalized_name:
        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        return f"{default_prefix}_{timestamp}.zip"

    if not normalized_name.endswith(".zip"):
        normalized_name += ".zip"
    return normalized_name


async def _create_archive_response(
    *,
    contents: list[Content],
    archive_name: str,
    user_id: str,
    service: ContentStorageService,
    audit_action: str,
    skipped_count: int = 0,
) -> StreamingResponse:
    """Build ZIP archive for content items and return it as a streamed response."""
    archive_service = ContentArchiveService(
        service,
        concurrency=ARCHIVE_DOWNLOAD_CONCURRENCY,
    )
    try:
        response, added_count, skipped_total = await archive_service.create_archive_response(
            contents=contents,
            archive_name=archive_name,
            user_id=user_id,
            audit_action=audit_action,
            skipped_count=skipped_count,
        )
    except ValueError:
        _raise_no_accessible_files()
    logger.info(
        "Archive download completed: %s files added, %s skipped, archive: %s",
        added_count,
        skipped_total,
        archive_name,
    )
    return response


async def _collect_accessible_batch_contents(
    *,
    content_ids: list[UUID],
    user_id: str,
    service: ContentStorageService,
) -> tuple[list[Content], int]:
    """Collect accessible content rows for a requested batch manifest."""
    accessible_contents: list[Content] = []
    skipped_count = 0
    for content_id in content_ids:
        try:
            accessible_contents.append(await service.get_content(content_id, user_id))
        except (PermissionError, ValueError):  # fmt: skip
            skipped_count += 1
        except Exception as exc:
            logger.warning("Error processing content %s for batch download: %s", content_id, exc)
            skipped_count += 1
    return accessible_contents, skipped_count


async def _collect_owned_archive_contents(
    *,
    user_id: str,
    alternate_user_id: str | None,
    service: ContentStorageService,
) -> list[Content]:
    """Collect all owner-only content rows for owned archive download."""
    owned_contents: list[Content] = []
    offset = 0
    page_size = 200

    while True:
        page_contents, total = await service.list_content(
            user_id=user_id,
            offset=offset,
            limit=page_size,
            alternate_user_id=alternate_user_id,
            owner_only=True,
        )
        if not page_contents:
            break

        owned_contents.extend(page_contents)
        offset += len(page_contents)
        if offset >= total:
            break
    return owned_contents


@router.post("/content/batch-download-ticket", response_model=ContentDownloadTicketResponse)
async def create_batch_download_ticket(
    request: BatchDownloadRequest,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    service: ContentStorageService = Depends(get_content_service),
    ticket_service: ContentDownloadTicketService = Depends(get_content_download_ticket_service),
) -> ContentDownloadTicketResponse:
    """Issue a short-lived manifest ticket for native browser ZIP download."""
    try:
        if len(request.content_ids) > 100:
            _raise_max_batch_size_exceeded(100)
        if not request.content_ids:
            _raise_no_content_ids_provided()

        accessible_contents, _skipped_count = await _collect_accessible_batch_contents(
            content_ids=request.content_ids,
            user_id=content_user_id,
            service=service,
        )
        if not accessible_contents:
            _raise_no_accessible_files()
        archive_name = _build_archive_name(request.archive_name, "content_batch")
        accessible_ids = [cast(UUID, content.id) for content in accessible_contents if content.id is not None]
        ticket, ttl = await ticket_service.issue(
            kind="batch",
            user_id=content_user_id,
            archive_name=archive_name,
            content_ids=accessible_ids,
        )
        return ContentDownloadTicketResponse(
            download_url=f"/api/v1/content/batch-download-by-ticket?ticket={ticket}",
            expires_in_seconds=ttl,
        )
    except ContentDownloadTicketUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Batch download ticket issue failed")
        _raise_internal_server_error("create_batch_download_ticket", exc)


@router.get("/content/batch-download-by-ticket")
async def batch_download_by_ticket(
    request: Request,
    ticket: str = Query(..., min_length=8, max_length=256),
    service: ContentStorageService = Depends(get_content_service),
    ticket_service: ContentDownloadTicketService = Depends(get_content_download_ticket_service),
) -> StreamingResponse:
    """Download a ZIP archive from a short-lived manifest ticket."""
    payload = await ticket_service.consume(ticket, expected_kind="batch", request=request)
    if not payload:
        raise HTTPException(status_code=401, detail="Download ticket is invalid or expired.")
    user_id = str(payload.get("user_id") or "").strip()
    content_id_values = payload.get("content_ids")
    if not user_id or not isinstance(content_id_values, list):
        raise HTTPException(status_code=401, detail="Download ticket is invalid or expired.")
    try:
        content_ids = [UUID(str(value)) for value in content_id_values]
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Download ticket is invalid or expired.") from exc
    accessible_contents, skipped_count = await _collect_accessible_batch_contents(
        content_ids=content_ids,
        user_id=user_id,
        service=service,
    )
    archive_name = _build_archive_name(str(payload.get("archive_name") or ""), "content_batch")
    return await _create_archive_response(
        contents=accessible_contents,
        archive_name=archive_name,
        user_id=user_id,
        service=service,
        audit_action=ARCHIVE_AUDIT_ACTION,
        skipped_count=skipped_count,
    )


@router.post("/content/batch-download")
async def batch_download_content(
    request: BatchDownloadRequest,
    current_user: User = Depends(require_oauth2_user_short_session),
    content_user_id: str = Depends(get_content_user_id_short_session),
    service: ContentStorageService = Depends(get_content_service),
) -> StreamingResponse:
    """
    Download multiple content files as a ZIP archive

    - Maximum 100 files per batch
    - Creates ZIP archive on-the-fly
    - Streams response for large archives
    - Only includes files user has access to
    - Skips files user cannot access (no error, just excluded)

    Request Body:
    - content_ids: List of content UUIDs to download
    - archive_name: Optional custom archive name (default: "content_batch_YYYYMMDD_HHMMSS.zip")

    Returns:
    - ZIP archive as streaming response
    """
    try:
        # Limit batch size
        if len(request.content_ids) > 100:
            _raise_max_batch_size_exceeded(100)

        if not request.content_ids:
            _raise_no_content_ids_provided()

        archive_name = _build_archive_name(request.archive_name, "content_batch")
        accessible_contents, skipped_count = await _collect_accessible_batch_contents(
            content_ids=request.content_ids,
            user_id=content_user_id,
            service=service,
        )

        return await _create_archive_response(
            contents=accessible_contents,
            archive_name=archive_name,
            user_id=content_user_id,
            service=service,
            audit_action=ARCHIVE_AUDIT_ACTION,
            skipped_count=skipped_count,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Batch download failed")
        _raise_internal_server_error("batch_download_content", e)


@router.post("/content/download-owned-archive")
async def download_owned_archive(
    request: ArchiveDownloadRequest,
    current_user: User = Depends(require_oauth2_user_short_session),
    content_user_id: str = Depends(get_content_user_id_short_session),
    service: ContentStorageService = Depends(get_content_service),
) -> StreamingResponse:
    """
    Download all files owned by the current user as a ZIP archive.

    - Includes files across all pages
    - Uses owner_only=true to exclude shared/public/friends content from other users
    - Streams response for large archives
    """
    try:
        archive_name = _build_archive_name(request.archive_name, "owned_content")
        oauth2_sub = str(current_user.id) if getattr(current_user, "id", None) else None
        alternate_user_id = oauth2_sub if (oauth2_sub and oauth2_sub != content_user_id) else None
        owned_contents = await _collect_owned_archive_contents(
            user_id=content_user_id,
            alternate_user_id=alternate_user_id,
            service=service,
        )
        return await _create_archive_response(
            contents=owned_contents,
            archive_name=archive_name,
            user_id=content_user_id,
            service=service,
            audit_action=ARCHIVE_AUDIT_ACTION,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Owned archive download failed")
        _raise_internal_server_error("download_owned_archive", e)


@router.post("/content/download-owned-archive-ticket", response_model=ContentDownloadTicketResponse)
async def create_owned_archive_download_ticket(
    request: ArchiveDownloadRequest,
    current_user: User = Depends(require_oauth2_user),
    content_user_id: str = Depends(get_content_user_id),
    ticket_service: ContentDownloadTicketService = Depends(get_content_download_ticket_service),
) -> ContentDownloadTicketResponse:
    """Issue a short-lived ticket for owner-only native ZIP download."""
    try:
        archive_name = _build_archive_name(request.archive_name, "owned_content")
        oauth2_sub = str(current_user.id) if getattr(current_user, "id", None) else None
        alternate_user_id = oauth2_sub if (oauth2_sub and oauth2_sub != content_user_id) else None
        ticket, ttl = await ticket_service.issue(
            kind="owned_archive",
            user_id=content_user_id,
            archive_name=archive_name,
            alternate_user_id=alternate_user_id,
        )
        return ContentDownloadTicketResponse(
            download_url=f"/api/v1/content/download-owned-archive-by-ticket?ticket={ticket}",
            expires_in_seconds=ttl,
        )
    except ContentDownloadTicketUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Owned archive download ticket issue failed")
        _raise_internal_server_error("create_owned_archive_download_ticket", exc)


@router.get("/content/download-owned-archive-by-ticket")
async def download_owned_archive_by_ticket(
    request: Request,
    ticket: str = Query(..., min_length=8, max_length=256),
    service: ContentStorageService = Depends(get_content_service),
    ticket_service: ContentDownloadTicketService = Depends(get_content_download_ticket_service),
) -> StreamingResponse:
    """Download an owner-only archive from a short-lived ticket URL."""
    payload = await ticket_service.consume(ticket, expected_kind="owned_archive", request=request)
    if not payload:
        raise HTTPException(status_code=401, detail="Download ticket is invalid or expired.")
    user_id = str(payload.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="Download ticket is invalid or expired.")
    alternate_user_id = str(payload.get("alternate_user_id") or "").strip() or None
    archive_name = _build_archive_name(str(payload.get("archive_name") or ""), "owned_content")
    owned_contents = await _collect_owned_archive_contents(
        user_id=user_id,
        alternate_user_id=alternate_user_id,
        service=service,
    )
    return await _create_archive_response(
        contents=owned_contents,
        archive_name=archive_name,
        user_id=user_id,
        service=service,
        audit_action=ARCHIVE_AUDIT_ACTION,
    )
