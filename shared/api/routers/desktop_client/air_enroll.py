# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Bounded one-attempt pre-license WebSocket for in-memory Capsule delivery.
# ---

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from api.core.database_manager import get_asyncpg_pool
from api.schemas.desktop_client.air_enroll import (
    AirEnrollActivationAckFrame,
    AirEnrollAuthRequestFrame,
    AirEnrollImportNackFrame,
)
from api.services.desktop_client.air_enroll_service import AirEnrollService
from api.services.desktop_client.license_models import DesktopClientError
from api.services.desktop_client.limits import air_enroll_ws_rate_limiter

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Desktop Client Air Enrollment"])

_PROTOCOL = "eliteew-air-enroll-v1"
_MAX_AUTH_FRAME_BYTES = 16 * 1024
_MAX_ACK_FRAME_BYTES = 2 * 1024
_AUTH_TIMEOUT_SECONDS = 10
_ACK_TIMEOUT_SECONDS = 120
_FAILURE_FLOOR_SECONDS = 0.15
_MAX_CONCURRENT_SOCKETS = 32
_socket_slots = asyncio.Semaphore(_MAX_CONCURRENT_SOCKETS)


async def _generic_close(
    websocket: WebSocket,
    *,
    started_at: float,
    code: int = 4403,
) -> None:
    remaining = _FAILURE_FLOOR_SECONDS - (time.monotonic() - started_at)
    if remaining > 0:
        await asyncio.sleep(remaining)
    try:
        await websocket.close(code=code)
    except RuntimeError:
        return


async def _receive_text(
    websocket: WebSocket,
    *,
    timeout_seconds: int,
    maximum_bytes: int,
) -> str:
    message = await asyncio.wait_for(
        websocket.receive(),
        timeout=timeout_seconds,
    )
    if message.get("type") == "websocket.disconnect":
        raise WebSocketDisconnect(message.get("code", 1000))
    text = message.get("text")
    if not isinstance(text, str):
        raise ValueError("text_frame_required")
    if len(text.encode("utf-8")) > maximum_bytes:
        raise ValueError("frame_too_large")
    return text


def _preclaim_fields(raw: str) -> tuple[str, str]:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("invalid_json") from exc
    if not isinstance(payload, dict) or payload.get("type") != "auth_and_request":
        raise ValueError("invalid_auth_frame")
    selector = payload.get("selector")
    secret = payload.get("secret")
    if not isinstance(selector, str) or not isinstance(secret, str):
        raise ValueError("invalid_auth_fields")
    return selector, secret


def _source_bucket_key(websocket: WebSocket) -> str:
    forwarded = websocket.headers.get("x-real-ip", "").strip()
    if forwarded:
        return f"air-ws:{forwarded[:64]}"
    if websocket.client is not None:
        return f"air-ws:{websocket.client.host[:64]}"
    return "air-ws:unknown"


async def _safe_failure(
    websocket: WebSocket,
    *,
    service: AirEnrollService,
    session_id: Any,
    error_code: str,
    capsule_may_have_arrived: bool,
) -> None:
    # Best-effort notify: the peer may already have closed the socket.
    with contextlib.suppress(RuntimeError, WebSocketDisconnect):
        await websocket.send_json({"type": "failed", "code": "enrollment_failed"})
    await _generic_close(
        websocket,
        started_at=time.monotonic(),
        code=1011,
    )
    if session_id is not None:
        try:
            await service.delivery_failed(
                session_id=session_id,
                error_code=error_code,
                capsule_may_have_arrived=capsule_may_have_arrived,
            )
        finally:
            await service.cleanup(session_id=session_id)


@router.websocket("/air-enroll/ws")
async def air_enroll_websocket(websocket: WebSocket) -> None:
    started_at = time.monotonic()
    if websocket.headers.get("x-eliteew-air-ingress") != "edge-v1":
        await _generic_close(websocket, started_at=started_at)
        return
    offered_protocols = {
        value.strip()
        for value in websocket.headers.get(
            "sec-websocket-protocol",
            "",
        ).split(",")
        if value.strip()
    }
    if _PROTOCOL not in offered_protocols:
        await _generic_close(websocket, started_at=started_at)
        return
    if not air_enroll_ws_rate_limiter.allow(_source_bucket_key(websocket)):
        await _generic_close(websocket, started_at=started_at, code=4429)
        return
    try:
        await asyncio.wait_for(_socket_slots.acquire(), timeout=0.05)
    except TimeoutError:
        await _generic_close(websocket, started_at=started_at, code=1013)
        return

    service: AirEnrollService | None = None
    claimed_session_id = None
    capsule_sent = False
    try:
        await websocket.accept(subprotocol=_PROTOCOL)
        pool = await get_asyncpg_pool()
        service = AirEnrollService(pool)
        try:
            auth_raw = await _receive_text(
                websocket,
                timeout_seconds=_AUTH_TIMEOUT_SECONDS,
                maximum_bytes=_MAX_AUTH_FRAME_BYTES,
            )
            selector, secret = _preclaim_fields(auth_raw)
            claim = await service.claim(selector=selector, secret=secret)
        except (
            DesktopClientError,
            TimeoutError,
            ValueError,
            WebSocketDisconnect,
        ):
            await _generic_close(websocket, started_at=started_at)
            return

        if not claim.authenticated or claim.session is None:
            await _generic_close(websocket, started_at=started_at)
            if claim.known_selector and claim.session is not None and claim.reason in {"secret_invalid", "expired"}:
                await service.cleanup(session_id=claim.session.id)
            return

        claimed_session_id = claim.session.id
        try:
            auth_frame = AirEnrollAuthRequestFrame.model_validate_json(auth_raw)
        except ValidationError:
            await _safe_failure(
                websocket,
                service=service,
                session_id=claimed_session_id,
                error_code="device_request_invalid",
                capsule_may_have_arrived=False,
            )
            return

        await websocket.send_json({"type": "claimed", "protocol": "v1"})
        try:
            sealed = await service.seal_for_claim(
                session_id=claimed_session_id,
                device_request=auth_frame.device_request.model_dump(),
            )
        except DesktopClientError:
            await _safe_failure(
                websocket,
                service=service,
                session_id=claimed_session_id,
                error_code="capsule_issue_failed",
                capsule_may_have_arrived=False,
            )
            return

        await websocket.send_json(
            {
                "type": "capsule_meta",
                "length": len(sealed.capsule),
                "sha256": sealed.sha256,
                "request_id": sealed.request_id,
                "redelivery": sealed.redelivery,
            }
        )
        await websocket.send_bytes(sealed.capsule)
        capsule_sent = True

        try:
            ack_raw = await _receive_text(
                websocket,
                timeout_seconds=_ACK_TIMEOUT_SECONDS,
                maximum_bytes=_MAX_ACK_FRAME_BYTES,
            )
            ack_payload = json.loads(ack_raw)
            if isinstance(ack_payload, dict) and ack_payload.get("type") == "import_nack":
                AirEnrollImportNackFrame.model_validate(ack_payload)
                await websocket.send_json({"type": "failed", "code": "capsule_import_failed"})
                await websocket.close(code=4400)
                await service.delivery_failed(
                    session_id=claimed_session_id,
                    error_code="client_import_nack",
                )
                await service.cleanup(session_id=claimed_session_id)
                return
            ack = AirEnrollActivationAckFrame.model_validate(ack_payload)
            if ack.request_id != sealed.request_id:
                raise ValueError("activation_request_mismatch")
            completed = await service.activation_ack(
                session_id=claimed_session_id,
                request_id=ack.request_id,
                activation_token=ack.activation_token,
                device_signing_pubkey=ack.device_signing_pubkey,
                proof_nonce=ack.proof_nonce,
                proof_signature=ack.proof_signature,
            )
            await websocket.send_json({"type": "completed", "status": completed.lifecycle})
            await websocket.close(code=1000)
            await service.cleanup(session_id=claimed_session_id)
        except (
            DesktopClientError,
            TimeoutError,
            ValueError,
            ValidationError,
            WebSocketDisconnect,
        ):
            await _safe_failure(
                websocket,
                service=service,
                session_id=claimed_session_id,
                error_code="activation_ack_failed",
                capsule_may_have_arrived=True,
            )
    except WebSocketDisconnect:
        if service is not None and claimed_session_id is not None:
            await service.delivery_failed(
                session_id=claimed_session_id,
                error_code=("delivery_disconnected" if capsule_sent else "claim_disconnected"),
                capsule_may_have_arrived=capsule_sent,
            )
            await service.cleanup(session_id=claimed_session_id)
    except Exception:
        logger.exception(
            "[STEP] air_enroll_ws_unexpected claimed=%s",
            claimed_session_id is not None,
        )
        if service is not None and claimed_session_id is not None:
            await service.delivery_failed(
                session_id=claimed_session_id,
                error_code="websocket_unexpected",
                capsule_may_have_arrived=capsule_sent,
            )
            await service.cleanup(session_id=claimed_session_id)
        await _generic_close(
            websocket,
            started_at=started_at,
            code=1011,
        )
    finally:
        _socket_slots.release()
