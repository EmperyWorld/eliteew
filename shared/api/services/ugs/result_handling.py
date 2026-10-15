#!/usr/bin/env python3
"""
UGS result handling: sanitize, enrich, persist.

Extracted from UnifiedGenerationService to keep unified_generation_service.py
focused on coordination. Used by UnifiedGenerationService for get_result,
_process_direct_generation (persist/sanitize) and get_status.
"""

import asyncio
import base64
import logging
import mimetypes
from pathlib import Path
from typing import Any
from uuid import UUID

from api.schemas.unified_content import ContentCreate, ContentType, Visibility

logger = logging.getLogger(__name__)

SANITIZED_STRING_LIMIT = 32768  # Increased for text generation (8192 tokens * 4 chars/token)
MAX_KEEP_IMAGE_B64_BYTES = 2 * 1024 * 1024  # 2 MB - keep small base64 so get_result has it without fetch
MAX_KEEP_AUDIO_B64_BYTES = 2 * 1024 * 1024  # Same cap; large tracks get storage_reference + enrich fetch
MAX_KEEP_VIDEO_B64_BYTES = 0  # Video Studio payloads are MB-scale; always refetch from ComfyUI output

_AUDIO_FILENAME_EXTS = frozenset({".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac", ".opus"})
_VIDEO_FILENAME_EXTS = frozenset({".mp4", ".webm", ".mov", ".mkv", ".m4v", ".gif"})


def _normalize_image_mime_type(raw_format: str | None, filename: str | None) -> str:
    raw = (raw_format or "").strip().lower()
    if raw.startswith("image/"):
        return raw
    if raw in {"png", "jpg", "jpeg", "webp", "gif"}:
        return f"image/{'jpeg' if raw == 'jpg' else raw}"
    guessed, _encoding = mimetypes.guess_type(filename or "")
    if guessed and guessed.startswith("image/"):
        return guessed
    return "image/png"


def truncate_large_string(value: str, limit: int = SANITIZED_STRING_LIMIT) -> str:
    """Truncate string to limit; append ...TRUNCATED... if truncated."""
    if len(value) <= limit:
        return value
    return f"{value[:limit]}...TRUNCATED..."


def _sanitize_image_entry_impl(
    entry: Any,
    *,
    max_keep_b64_bytes: int = MAX_KEEP_IMAGE_B64_BYTES,
    _sanitize_result: Any = None,
    _truncate: Any = None,
) -> Any:
    """Sanitize single image entry (dict with data/image_data)."""
    if not isinstance(entry, dict):
        return entry

    sanitize_result = _sanitize_result or (
        lambda x: _sanitize_generation_result_impl(x, max_keep_b64_bytes=max_keep_b64_bytes)
    )
    truncate = _truncate or truncate_large_string

    if entry.get("content_id") and entry.get("storage") == "unified":
        return {
            "content_id": entry["content_id"],
            "storage": "unified",
            "mime_type": entry.get("mime_type", "image/png"),
            "name": entry.get("name"),
            "filename": entry.get("filename"),
        }

    sanitized: dict[str, Any] = {}
    for key, value in entry.items():
        if key in {"data", "image_data"} and isinstance(value, str):
            if len(value) <= max_keep_b64_bytes:
                sanitized[key] = value
            else:
                sanitized[key] = None
                sanitized["data_preview"] = truncate(value, limit=1024)
                sanitized["data_truncated"] = True
        elif isinstance(value, (dict, list)):
            sanitized[key] = sanitize_result(value)
        else:
            sanitized[key] = value

    filename = sanitized.get("filename")
    if filename:
        sanitized.setdefault(
            "storage_reference",
            {
                "provider": "comfyui",
                "filename": filename,
                "subfolder": entry.get("subfolder", ""),
                "format": sanitized.get("format") or entry.get("format"),
            },
        )
    return sanitized


def _sanitize_audio_entry_impl(
    entry: Any,
    *,
    max_keep_b64_bytes: int = MAX_KEEP_AUDIO_B64_BYTES,
    _sanitize_result: Any = None,
    _truncate: Any = None,
) -> Any:
    """Sanitize ComfyUI SaveAudio entry: avoid huge base64 in DB; keep ref for enrich fetch."""
    if not isinstance(entry, dict):
        return entry

    sanitize_result = _sanitize_result or (
        lambda x: _sanitize_generation_result_impl(
            x, max_keep_b64_bytes=max_keep_b64_bytes, string_limit=SANITIZED_STRING_LIMIT
        )
    )
    truncate = _truncate or truncate_large_string

    if entry.get("content_id") and entry.get("storage") == "unified":
        return {
            "content_id": entry["content_id"],
            "storage": "unified",
            "mime_type": entry.get("mime_type", "audio/mpeg"),
            "name": entry.get("name"),
            "filename": entry.get("filename"),
        }

    sanitized: dict[str, Any] = {}
    for key, value in entry.items():
        if key == "data" and isinstance(value, str):
            if len(value) <= max_keep_b64_bytes:
                sanitized[key] = value
            else:
                sanitized[key] = None
                sanitized["data_preview"] = truncate(value, limit=1024)
                sanitized["data_truncated"] = True
        elif isinstance(value, (dict, list)):
            sanitized[key] = sanitize_result(value)
        else:
            sanitized[key] = value

    filename = sanitized.get("filename")
    if filename:
        sanitized.setdefault(
            "storage_reference",
            {
                "provider": "comfyui",
                "kind": "audio",
                "filename": filename,
                "subfolder": entry.get("subfolder", ""),
                "type": "output",
            },
        )
    return sanitized


def _sanitize_video_entry_impl(
    entry: Any,
    *,
    max_keep_b64_bytes: int = MAX_KEEP_VIDEO_B64_BYTES,
    _sanitize_result: Any = None,
    _truncate: Any = None,
) -> Any:
    """Sanitize ComfyUI SaveVideo entry: strip heavy base64; keep ref for enrich fetch."""
    if not isinstance(entry, dict):
        return entry

    sanitize_result = _sanitize_result or (
        lambda x: _sanitize_generation_result_impl(
            x, max_keep_b64_bytes=max_keep_b64_bytes, string_limit=SANITIZED_STRING_LIMIT
        )
    )
    truncate = _truncate or truncate_large_string

    if entry.get("content_id") and entry.get("storage") == "unified":
        return {
            "content_id": entry["content_id"],
            "storage": "unified",
            "mime_type": entry.get("mime_type", "video/mp4"),
            "name": entry.get("name"),
            "filename": entry.get("filename"),
        }

    sanitized: dict[str, Any] = {}
    for key, value in entry.items():
        if key == "data" and isinstance(value, str):
            if max_keep_b64_bytes > 0 and len(value) <= max_keep_b64_bytes:
                sanitized[key] = value
            else:
                sanitized[key] = None
                sanitized["data_preview"] = truncate(value, limit=1024)
                sanitized["data_truncated"] = True
        elif isinstance(value, (dict, list)):
            sanitized[key] = sanitize_result(value)
        else:
            sanitized[key] = value

    filename = sanitized.get("filename")
    if filename:
        sanitized.setdefault(
            "storage_reference",
            {
                "provider": "comfyui",
                "kind": "video",
                "filename": filename,
                "subfolder": entry.get("subfolder", ""),
                "type": "output",
            },
        )
    return sanitized


def _sanitize_generation_result_impl(
    result: Any,
    *,
    max_keep_b64_bytes: int = MAX_KEEP_IMAGE_B64_BYTES,
    string_limit: int = SANITIZED_STRING_LIMIT,
) -> Any:
    """Clean generation result from heavy binary data before saving."""
    if isinstance(result, dict):
        sanitized: dict[str, Any] = {}
        for key, value in result.items():
            if key == "images" and isinstance(value, list):
                sanitized[key] = [
                    _sanitize_image_entry_impl(
                        item,
                        max_keep_b64_bytes=max_keep_b64_bytes,
                        _sanitize_result=lambda x: _sanitize_generation_result_impl(
                            x, max_keep_b64_bytes=max_keep_b64_bytes, string_limit=string_limit
                        ),
                        _truncate=truncate_large_string,
                    )
                    for item in value
                ]
            elif key == "audio" and isinstance(value, list):
                sanitized[key] = [
                    _sanitize_audio_entry_impl(
                        item,
                        max_keep_b64_bytes=MAX_KEEP_AUDIO_B64_BYTES,
                        _sanitize_result=lambda x: _sanitize_generation_result_impl(
                            x, max_keep_b64_bytes=max_keep_b64_bytes, string_limit=string_limit
                        ),
                        _truncate=truncate_large_string,
                    )
                    for item in value
                ]
            elif key == "videos" and isinstance(value, list):
                sanitized[key] = [
                    _sanitize_video_entry_impl(
                        item,
                        max_keep_b64_bytes=MAX_KEEP_VIDEO_B64_BYTES,
                        _sanitize_result=lambda x: _sanitize_generation_result_impl(
                            x, max_keep_b64_bytes=max_keep_b64_bytes, string_limit=string_limit
                        ),
                        _truncate=truncate_large_string,
                    )
                    for item in value
                ]
            else:
                sanitized[key] = _sanitize_generation_result_impl(
                    value, max_keep_b64_bytes=max_keep_b64_bytes, string_limit=string_limit
                )
        return sanitized

    if isinstance(result, list):
        return [
            _sanitize_generation_result_impl(item, max_keep_b64_bytes=max_keep_b64_bytes, string_limit=string_limit)
            for item in result
        ]

    if isinstance(result, str):
        return truncate_large_string(result, limit=string_limit)

    return result


def sanitize_generation_result(
    result: Any,
    max_keep_b64_bytes: int = MAX_KEEP_IMAGE_B64_BYTES,
    string_limit: int = SANITIZED_STRING_LIMIT,
) -> Any:
    """Public: clean generation result from heavy binary data (for DB / preview)."""
    return _sanitize_generation_result_impl(result, max_keep_b64_bytes=max_keep_b64_bytes, string_limit=string_limit)


def sanitize_image_entry(entry: Any, max_keep_b64_bytes: int = MAX_KEEP_IMAGE_B64_BYTES) -> Any:
    """Public: sanitize single image entry."""
    return _sanitize_image_entry_impl(
        entry,
        max_keep_b64_bytes=max_keep_b64_bytes,
        _sanitize_result=lambda x: _sanitize_generation_result_impl(x, max_keep_b64_bytes=max_keep_b64_bytes),
        _truncate=truncate_large_string,
    )


async def persist_result_images_to_shared_storage(
    content_service: Any,
    user_id: str,
    request_id: UUID,
    result: Any,
) -> Any:
    """
    Save image outputs to unified content (MinIO/shared storage).
    Replaces base64 image data with content_id ref so DB stays small.
    """
    if not content_service or not user_id:
        return result

    def _is_image_entry(obj: Any) -> bool:
        if not isinstance(obj, dict):
            return False
        fn = obj.get("filename")
        if isinstance(fn, str):
            suffix = Path(fn).suffix.lower()
            if suffix in _AUDIO_FILENAME_EXTS or suffix in _VIDEO_FILENAME_EXTS:
                return False
        if obj.get("content_id"):
            return False
        # Top-level generation payload may include helper field `image_data`.
        # Do not treat such envelopes as image entries; process nested `images` list instead.
        if isinstance(obj.get("images"), list):
            return False
        data = obj.get("data") or obj.get("image_data")
        if not (isinstance(data, str) and len(data) > 0):
            return False
        if any(
            key in obj
            for key in (
                "filename",
                "subfolder",
                "format",
                "width",
                "height",
                "storage_reference",
                "data_uri",
                "mime_type",
            )
        ):
            return True
        # Allow compact image objects produced by fallback paths: {"data": "..."}.
        return set(obj.keys()).issubset({"data", "image_data", "data_uri", "name"})

    async def _persist_one_image(entry: dict[str, Any], index: int) -> dict[str, Any]:
        data_b64 = entry.get("data") or entry.get("image_data")
        if not isinstance(data_b64, str):
            return entry
        try:
            # Allow data URI prefix (e.g. "data:image/png;base64,...") and strip it before decoding.
            # We also avoid strict validate=True because some providers may insert non-alphabet chars
            # (e.g. newlines) even though the payload is otherwise valid base64.
            data_b64_stripped = data_b64.strip()
            if data_b64_stripped.startswith("data:image"):
                parts = data_b64_stripped.split(",", 1)
                data_b64_stripped = parts[1] if len(parts) == 2 else data_b64_stripped
            file_bytes = base64.b64decode(data_b64_stripped)
        except Exception as e:
            # Truncated or non-base64 data: expected when result was sanitized and enrich didn't fill
            if entry.get("storage_reference"):
                logger.debug(
                    "UGS persist image: skipping (invalid base64, has storage_reference) request %s image #%s: %s",
                    request_id,
                    index,
                    e,
                )
            else:
                logger.warning(
                    "UGS persist image: invalid base64 for request %s image #%s: %s",
                    request_id,
                    index,
                    e,
                )
            return entry
        name = entry.get("filename") or f"ugs_{str(request_id)[:8]}_{index}.png"
        if len(name) > 200:
            name = name[:200]
        content_data = ContentCreate(
            name=name,
            description=None,
            content_type=ContentType.IMAGE,
            mime_type=_normalize_image_mime_type(entry.get("format"), name),
            sub_type=None,
            visibility=Visibility.PRIVATE,
            user_id=user_id,
            original_filename=name,
            source_service="ugs",
            source_id=str(request_id),
            tags=[],
            company_id=None,
            project_id=None,
            title=None,
            word_count=None,
            character_count=None,
            access_level=None,
            is_public=None,
            folder_item_id=None,
            apply_project_desktop_folder=True,
            metadata={},
        )
        try:
            async with asyncio.timeout(30.0):
                content = await content_service.create_content(
                    content_data=content_data,
                    file_data=file_bytes,
                    user_id=user_id,
                )
            return {
                "content_id": str(content.id),
                "storage": "unified",
                "mime_type": content_data.mime_type or "image/png",
                "name": content.name,
                "filename": name,
            }
        except TimeoutError:
            logger.warning("UGS persist image: timeout saving to unified content for request %s", request_id)
            return entry
        except Exception as e:
            logger.warning(
                "UGS persist image: failed to save to unified content for request %s: %s",
                request_id,
                str(e)[:200],
            )
            return entry

    async def _walk_and_persist(obj: Any, image_index: list[int]) -> Any:
        if isinstance(obj, dict):
            if _is_image_entry(obj):
                idx = image_index[0]
                image_index[0] += 1
                return await _persist_one_image(obj, idx)
            return {k: await _walk_and_persist(v, image_index) for k, v in obj.items()}
        if isinstance(obj, list):
            return [await _walk_and_persist(item, image_index) for item in obj]
        return obj

    return await _walk_and_persist(result, [0])


async def enrich_result_with_assets(provider_manager: Any, result: Any, provider: str | None) -> Any:
    """
    Enrich result with image data from provider (e.g. fetch ComfyUI images by storage_reference).
    """
    if isinstance(result, dict):
        enriched: dict[str, Any] = {}
        for key, value in result.items():
            enriched[key] = await enrich_result_with_assets(provider_manager, value, provider)

        storage_ref = enriched.get("storage_reference")
        if provider == "comfyui" and isinstance(storage_ref, dict):
            filename = storage_ref.get("filename")
            subfolder = storage_ref.get("subfolder", "")
            if filename:
                try:
                    if storage_ref.get("kind") == "audio":
                        audio_b64 = await provider_manager.fetch_comfyui_output_audio(filename, subfolder)
                        if audio_b64:
                            enriched["data"] = audio_b64
                            enriched.pop("data_preview", None)
                            enriched.pop("data_truncated", None)
                            logger.debug(
                                "Enriched audio from ComfyUI output: filename=%s, subfolder=%s, data_length=%d",
                                filename,
                                subfolder,
                                len(audio_b64) if audio_b64 else 0,
                            )
                        else:
                            logger.warning(
                                "Failed to fetch audio from ComfyUI output: filename=%s, subfolder=%s",
                                filename,
                                subfolder,
                            )
                    elif storage_ref.get("kind") == "video":
                        video_b64 = await provider_manager.fetch_comfyui_output_video(filename, subfolder)
                        if video_b64:
                            enriched["data"] = video_b64
                            enriched.pop("data_preview", None)
                            enriched.pop("data_truncated", None)
                            logger.debug(
                                "Enriched video from ComfyUI output: filename=%s, subfolder=%s, data_length=%d",
                                filename,
                                subfolder,
                                len(video_b64) if video_b64 else 0,
                            )
                        else:
                            logger.warning(
                                "Failed to fetch video from ComfyUI output: filename=%s, subfolder=%s",
                                filename,
                                subfolder,
                            )
                    else:
                        image_data = await provider_manager.fetch_comfyui_image(filename, subfolder)
                        if image_data:
                            enriched["data"] = image_data
                            enriched.setdefault("data_uri", f"data:image/png;base64,{image_data}")
                            enriched.setdefault("image_url", enriched.get("data_uri"))
                            if "image_data" not in enriched:
                                enriched["image_data"] = image_data
                            enriched.pop("data_preview", None)
                            enriched.pop("data_truncated", None)
                            logger.debug(
                                "Enriched image from storage: filename=%s, subfolder=%s, data_length=%d",
                                filename,
                                subfolder,
                                len(image_data) if image_data else 0,
                            )
                        else:
                            logger.warning(
                                "Failed to fetch image from ComfyUI: filename=%s, subfolder=%s",
                                filename,
                                subfolder,
                            )
                except Exception:
                    logger.exception("Error fetching ComfyUI asset %s/%s", subfolder, filename)

        return enriched

    if isinstance(result, list):
        return [await enrich_result_with_assets(provider_manager, item, provider) for item in result]

    return result
