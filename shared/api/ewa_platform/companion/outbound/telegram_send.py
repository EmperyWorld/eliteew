# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Send Telegram messages via Bot API for companion workflow outbound nodes.
# Invariants:
# - Requires ``TELEGRAM_BOT_TOKEN``; never logs token or full message bodies at info level.
# Related:
# - api/workers/queue_handlers.py (notification delivery pattern)
# ---

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import aiohttp


@dataclass(frozen=True, slots=True)
class TelegramSendResult:
    ok: bool
    delivery_status: str
    chat_id: str | None = None
    message_id: int | None = None
    error: str | None = None

    def as_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "delivery_status": self.delivery_status,
            "chat_id": self.chat_id,
        }
        if self.message_id is not None:
            payload["message_id"] = self.message_id
        if self.error:
            payload["error"] = self.error
        return payload


async def send_telegram_message(*, chat_id: str | int, message_text: str) -> TelegramSendResult:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id_str = str(chat_id or "").strip()
    text = str(message_text or "").strip()
    if not token:
        return TelegramSendResult(
            ok=False,
            delivery_status="failed",
            chat_id=chat_id_str or None,
            error="telegram_not_configured",
        )
    if not chat_id_str:
        return TelegramSendResult(ok=False, delivery_status="failed", error="chat_id_required")
    if not text:
        return TelegramSendResult(
            ok=False,
            delivery_status="failed",
            chat_id=chat_id_str,
            error="message_text_required",
        )

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id_str, "text": text}
    try:
        async with (
            aiohttp.ClientSession() as session,
            session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=20)) as response,
        ):
            body = await response.json(content_type=None)
            if response.status >= 400 or not bool(body.get("ok")):
                detail = str(body.get("description") or response.reason or "telegram_api_error")
                return TelegramSendResult(
                    ok=False,
                    delivery_status="failed",
                    chat_id=chat_id_str,
                    error=detail[:500],
                )
            result = body.get("result") if isinstance(body.get("result"), dict) else {}
            message_id_raw = result.get("message_id")
            message_id = int(message_id_raw) if message_id_raw is not None else None
            return TelegramSendResult(
                ok=True,
                delivery_status="sent",
                chat_id=chat_id_str,
                message_id=message_id,
            )
    except Exception as exc:  # noqa: BLE001 — surface as structured delivery failure
        return TelegramSendResult(
            ok=False,
            delivery_status="failed",
            chat_id=chat_id_str,
            error=str(exc)[:500],
        )
