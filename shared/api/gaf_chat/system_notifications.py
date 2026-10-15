"""Server-initiated GAF messages (system user), e.g. energy balance updates."""

from __future__ import annotations

import logging

import asyncpg  # type: ignore[import-not-found,import-untyped]

from api.gaf_chat.energy_notify_text import EnergyCreditsNotifyKind, format_energy_credits_notify_text
from api.gaf_chat.service import GafChatService

logger = logging.getLogger(__name__)


async def notify_user_energy_credits_changed(
    db_pool: asyncpg.Pool,
    recipient_user_id: str,
    *,
    new_balance: float,
    delta: float | None = None,
    message_override: str | None = None,
    change_kind: EnergyCreditsNotifyKind | None = None,
) -> None:
    """Post a GAF chat line from the system account about UGS energy (credits) balance."""
    try:
        text = format_energy_credits_notify_text(
            new_balance=new_balance,
            delta=delta,
            message_override=message_override,
            change_kind=change_kind,
        )
        svc = GafChatService(db_pool)
        await svc.send_service_message_to_user(recipient_user_id, text)
    except Exception:
        logger.exception(
            "notify_user_energy_credits_changed failed recipient=%s",
            recipient_user_id,
        )
