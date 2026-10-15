# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Optional soft-delete for rejected Professional Worlds media enhancement outputs when retention policy env allows it.
# Invariants:
# - Never raises into HTTP layer — failures are swallowed after logging intent.
# - Guarded by `PROFESSIONAL_MEDIA_REJECT_CLEANUP_ENABLED` default-on (unset = allow).
# Related:
# - api/routers/professional_worlds.py (`reject`/batch review handlers)
# - api/services/content_service.py (`delete_content`)
# ---

from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING, Any
from uuid import UUID

if TYPE_CHECKING:
    from api.core.auth import User

logger = logging.getLogger(__name__)


def professional_media_reject_cleanup_enabled() -> bool:
    """Return True when operator allows deleting UC blobs for rejected enhancement candidates."""
    raw = os.environ.get("PROFESSIONAL_MEDIA_REJECT_CLEANUP_ENABLED", "1").strip().lower()
    return raw not in ("0", "false", "no", "off")


async def maybe_delete_rejected_enhancement_output(
    *,
    content_service: Any,
    user: User,
    output_content_id: UUID | None,
) -> None:
    """Soft-delete Unified Content rows produced as rejected enhancement outputs."""
    if not professional_media_reject_cleanup_enabled():
        return
    if output_content_id is None:
        return
    try:
        await content_service.delete_content(output_content_id, user)
        logger.info("Rejected enhancement output cleaned up: content_id=%s", output_content_id)
    except Exception as exc:  # pragma: no cover - defensive UC path
        logger.warning(
            "Could not cleanup rejected enhancement output %s: %s",
            output_content_id,
            exc,
            exc_info=True,
        )
