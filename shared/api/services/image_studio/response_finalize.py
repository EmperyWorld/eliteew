# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Image Studio response shaping: UGS payload → unified content persist + API JSON.
# Invariants:
# - Hydrates stripped base64 via content_id when UGS returns storage-only refs.
# Related:
# - api/routers/image_studio.py
# - api/services/image_studio/streaming.py
# ---

from __future__ import annotations

import base64
import logging
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException

from api.core.auth import User
from api.schemas.unified_content import ContentType, Visibility, build_content_create, build_content_update
from api.services.unified_content.content_storage_service import ContentStorageService
from api.utils.llm_json_extract import strip_llm_channel_markup, strip_llm_thinking_prefix

logger = logging.getLogger(__name__)


def unwrap_image_block(ugs_result: dict[str, Any]) -> dict[str, Any]:
    block = ugs_result.get("result") or {}
    if isinstance(block, dict) and "images" not in block and isinstance(block.get("result"), dict):
        inner = block.get("result")
        if isinstance(inner, dict) and "images" in inner:
            return inner
    return block if isinstance(block, dict) else {}


async def hydrate_studio_images_from_content(
    images: list[dict[str, Any]],
    *,
    user_id: str,
    content_service: ContentStorageService,
) -> list[dict[str, Any]]:
    """UGS may strip base64 and leave content_id — reload bytes for the studio UI."""
    out: list[dict[str, Any]] = []
    for raw in images:
        img = dict(raw)
        if img.get("data"):
            out.append(img)
            continue
        cid = img.get("content_id")
        if not cid:
            out.append(img)
            continue
        try:
            file_bytes, meta = await content_service.read_file_bytes_for_owner(UUID(str(cid)), user_id)
            img["data"] = base64.b64encode(file_bytes).decode("ascii")
            if not img.get("filename"):
                img["filename"] = str(meta.get("original_filename") or meta.get("name") or "image.png")
        except Exception as exc:
            logger.warning(
                "Image Studio: failed to hydrate image from content_id=%s: %s",
                cid,
                exc,
            )
        out.append(img)
    return out


def any_image_has_data(images: list[dict[str, Any]]) -> bool:
    for img in images:
        data = img.get("data")
        if isinstance(data, str) and data.strip():
            return True
    return False


def sanitize_image_prompt_text(raw: str) -> str:
    """Strip llama-server / Gemma channel+thinking wrappers before Comfy positive prompt."""
    original = raw or ""
    text = strip_llm_thinking_prefix(strip_llm_channel_markup(original)).strip()
    if not text:
        return ""
    low = original.lower()
    if "<|channel" in low or "<channel|" in low:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        if len(lines) >= 2:
            for i, ln in enumerate(lines):
                if "," in ln or len(ln) >= 48:
                    return "\n".join(lines[i:]).strip()
            return lines[-1]
    return text


def text_from_ugs_result(ugs_result: dict[str, Any]) -> str:
    block = ugs_result.get("result") or {}
    raw = ""
    if isinstance(block, dict):
        if isinstance(block.get("result"), dict):
            inner = block["result"]
            raw = str(inner.get("text") or inner.get("content") or inner.get("response") or "")
        else:
            raw = str(block.get("text") or block.get("content") or block.get("response") or "")
    return sanitize_image_prompt_text(raw)


async def persist_image_result(
    *,
    content_service: ContentStorageService,
    user: User,
    first_image: dict[str, Any],
    name: str,
    description: str,
    tags: list[str],
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    b64 = first_image.get("data")
    if not b64:
        return {
            "history_saved": False,
            "history_error": "Generated image is missing data for history storage",
        }

    try:
        image_bytes = base64.b64decode(b64)
        filename = first_image.get("filename") or "image.png"
        content_data = build_content_create(
            user_id=str(user.id),
            name=name,
            description=description,
            content_type=ContentType.IMAGE,
            mime_type="image/png",
            sub_type="image_studio",
            original_filename=filename,
            tags=tags,
            visibility=Visibility.PRIVATE,
            source_service="image_studio",
            source_id=str(uuid4()),
            apply_project_desktop_folder=True,
            metadata=dict(metadata or {}),
        )
        content = await content_service.create_content(
            content_data=content_data,
            file_data=image_bytes,
            user_id=str(user.id),
        )
        if (content.source_service or "").strip() != "image_studio":
            content = await content_service.update_content(
                content.id,
                str(user.id),
                build_content_update(
                    name=name,
                    description=description,
                    tags=tags,
                    sub_type="image_studio",
                    source_service="image_studio",
                    source_id=str(uuid4()),
                ),
            )
    except Exception as exc:
        logger.warning("Image Studio: failed to save to content: %s", exc)
        return {
            "history_saved": False,
            "history_error": "Generated image was created, but saving to history failed",
        }

    return {
        "history_saved": True,
        "content_id": str(content.id),
        "name": content.name or name,
    }


async def finalize_image_response(
    *,
    resp: dict[str, Any],
    content_service: ContentStorageService,
    user: User,
    default_filename: str,
    name: str,
    description: str,
    tags: list[str],
) -> dict[str, Any]:
    block = unwrap_image_block(resp)
    images = block.get("images") or []
    if not images:
        raise HTTPException(status_code=502, detail="No image returned")
    images = await hydrate_studio_images_from_content(
        images,
        user_id=str(user.id),
        content_service=content_service,
    )
    if not any_image_has_data(images):
        raise HTTPException(status_code=502, detail="No image returned")
    out: dict[str, Any] = {
        "images": [{"data": img.get("data"), "filename": img.get("filename", default_filename)} for img in images],
        "history_saved": False,
    }
    out.update(
        await persist_image_result(
            content_service=content_service,
            user=user,
            first_image=images[0],
            name=name,
            description=description,
            tags=tags,
        )
    )
    return out


def finalize_suggest_prompt_response(resp: dict[str, Any]) -> dict[str, str]:
    content = text_from_ugs_result(resp)
    if not content:
        raise HTTPException(status_code=502, detail="AI returned empty prompt")
    if len(content) > 4000:
        content = content[:4000].rsplit(",", 1)[0] + "…"
    return {"prompt": content}
