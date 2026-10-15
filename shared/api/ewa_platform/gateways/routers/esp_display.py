# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Device-token HTTP entry for ESP TFT desk display companion turns + ComfyUI image.
# Invariants:
# - Feature flag default off; token via X-EliteEW-Esp-Display-Token; tools skipped in companion surface.
# - Image path always re-encodes WebP before RGB565 TFT payload.
# Related:
# - documentation/product/ewa/EWA-ESP-DISPLAY-AI.md
# - api/ewa_platform/companion/esp_display/
# ---
"""ESP TFT display AI / image router."""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.database_manager import get_postgres_session
from api.ewa_platform.companion.esp_display import (
    esp_display_ai_enabled,
    esp_display_device_token_expected,
    esp_display_principal_id,
    rate_limit_allow,
    run_esp_display_turn,
    verify_esp_display_token,
)
from api.ewa_platform.companion.esp_display.image_gen import (
    image_rate_limit_allow,
    run_esp_display_image,
)
from api.ewa_platform.schemas.pydantic.esp_display import (
    EspDisplayImageIn,
    EspDisplayTurnIn,
    EspDisplayTurnOut,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ewa-esp-display"])


def _pool(request: Request) -> Any | None:
    return getattr(request.app.state, "ewa_orchestration_pool", None)


def _require_device_token(token: str | None) -> None:
    if not esp_display_device_token_expected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="esp_display_token_unconfigured",
        )
    if not verify_esp_display_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid esp display token")


@router.post(
    "/esp-display/turn",
    response_model=EspDisplayTurnOut,
    operation_id="ewa_esp_display_turn",
    summary="ESP TFT: button intent → short companion reply (device token)",
)
async def post_esp_display_turn(
    request: Request,
    body: EspDisplayTurnIn,
    x_eliteew_esp_display_token: str | None = Header(default=None, alias="X-EliteEW-Esp-Display-Token"),
) -> EspDisplayTurnOut:
    if not esp_display_ai_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="esp_display_ai_disabled")

    _require_device_token(x_eliteew_esp_display_token)

    if not esp_display_principal_id():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="esp_display_principal_unconfigured",
        )

    if not rate_limit_allow():
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="esp_display_rate_limited")

    pool = _pool(request)
    if pool is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="ewa_pool_unavailable")

    ambient = body.ambient.model_dump(exclude_none=True) if body.ambient is not None else None
    try:
        raw = await run_esp_display_turn(
            pool,
            intent=body.intent,
            ambient=ambient,
            client_turn_id=body.client_turn_id,
        )
        return EspDisplayTurnOut.model_validate(raw)
    except ValueError as e:
        if str(e) == "companion_profile_not_initialized":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="companion_profile_not_initialized",
            ) from e
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except RuntimeError as e:
        code = str(e)
        if code == "esp_display_principal_unconfigured":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=code,
            ) from e
        if code == "companion_chat_llm_disabled":
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=code) from e
        logger.warning("[STEP] esp_display_turn_failed code=%s", code)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"esp_display_failed:{code}") from e


@router.post(
    "/esp-display/image",
    operation_id="ewa_esp_display_image",
    summary="ESP TFT: LLM prompt → ComfyUI → WebP → RGB565/WebP (device token)",
    responses={
        200: {
            "content": {
                "application/octet-stream": {"schema": {"type": "string", "format": "binary"}},
                "image/webp": {"schema": {"type": "string", "format": "binary"}},
            }
        }
    },
)
async def post_esp_display_image(
    body: EspDisplayImageIn,
    db: AsyncSession = Depends(get_postgres_session),
    x_eliteew_esp_display_token: str | None = Header(default=None, alias="X-EliteEW-Esp-Display-Token"),
    format: Literal["rgb565", "webp"] = Query(default="rgb565"),
) -> Response:
    if not esp_display_ai_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="esp_display_ai_disabled")

    _require_device_token(x_eliteew_esp_display_token)

    if not esp_display_principal_id():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="esp_display_principal_unconfigured",
        )

    if not image_rate_limit_allow():
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="esp_display_image_rate_limited")

    try:
        raw = await run_esp_display_image(db, preset=body.preset, prompt=body.prompt)
    except TimeoutError as e:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="esp_display_image_timeout") from e
    except RuntimeError as e:
        code = str(e)
        logger.warning("[STEP] esp_display_image_failed code=%s", code)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=code) from e
    except Exception as e:
        logger.exception("[STEP] esp_display_image_error err=%s", e)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="esp_display_image_error") from e

    if format == "webp":
        payload = raw["webp"]
        media = "image/webp"
    else:
        payload = raw["rgb565"]
        media = "application/octet-stream"

    return Response(
        content=payload,
        media_type=media,
        headers={
            "X-EliteEW-Image-Width": str(raw["width"]),
            "X-EliteEW-Image-Height": str(raw["height"]),
            "X-EliteEW-Image-Format": format,
            "X-EliteEW-Webp-Bytes": str(raw["webp_bytes"]),
            "X-EliteEW-Content-Id": str(raw["content_id"]),
            "X-EliteEW-Preset": str(raw["preset"]),
            "X-EliteEW-Prompt-Source": str(raw.get("prompt_source") or "unknown"),
        },
    )
