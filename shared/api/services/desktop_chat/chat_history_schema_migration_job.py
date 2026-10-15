# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Idempotent Qdrant chat_history turn-point schema migration (message_id → source_message_id).
# Invariants:
# - Only memory_kind=turn points; dry-run default; no writes unless apply=True.
# Related:
# - api/services/chat_memory_service.py
# - documentation/product/DESKTOP-AI-CHAT-CHAT-HISTORY-MIGRATION.md
# ---

"""Qdrant chat_history legacy turn payload migration."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

from api.services.chat_memory_service import (
    CHAT_HISTORY_COLLECTION,
    DESKTOP_EPISODIC_MEMORY_POINT_NAMESPACE,
    MEMORY_KIND_TURN,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class MigrationStats:
    scanned: int
    updated: int
    skipped: int
    errors: int

    def as_dict(self) -> dict[str, int]:
        return {
            "scanned": self.scanned,
            "updated": self.updated,
            "skipped": self.skipped,
            "errors": self.errors,
        }


def _needs_migration(payload: dict[str, Any]) -> bool:
    if payload.get("memory_kind") != MEMORY_KIND_TURN:
        return False
    if payload.get("source_message_id"):
        return False
    return bool(payload.get("message_id"))


def _migrate_payload(payload: dict[str, Any]) -> dict[str, Any]:
    out = dict(payload)
    msg_id = out.pop("message_id", None)
    if msg_id and not out.get("source_message_id"):
        out["source_message_id"] = msg_id
    return out


def _stable_point_id(session_id: str, idempotency_key: str) -> str:
    return str(
        uuid.uuid5(
            DESKTOP_EPISODIC_MEMORY_POINT_NAMESPACE,
            f"{session_id}:{idempotency_key}",
        )
    )


async def run_chat_history_schema_migration(
    *,
    apply: bool = False,
    batch_size: int = 64,
) -> MigrationStats:
    from qdrant_client.models import FieldCondition, Filter, MatchValue

    from api.services.chat_memory_service import _get_qdrant_client

    client = await _get_qdrant_client()
    if client is None:
        raise RuntimeError("qdrant unavailable")

    q_filter = Filter(must=[FieldCondition(key="memory_kind", match=MatchValue(value=MEMORY_KIND_TURN))])
    scanned = updated = skipped = errors = 0
    offset = None
    while True:
        points, offset = await client.scroll(
            collection_name=CHAT_HISTORY_COLLECTION,
            scroll_filter=q_filter,
            limit=batch_size,
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        for pt in points or []:
            scanned += 1
            payload = dict(pt.payload or {})
            if not _needs_migration(payload):
                skipped += 1
                continue
            new_payload = _migrate_payload(payload)
            try:
                if apply:
                    await client.set_payload(
                        collection_name=CHAT_HISTORY_COLLECTION,
                        payload=new_payload,
                        points=[pt.id],
                    )
                    if payload.get("message_id"):
                        await client.delete_payload(
                            collection_name=CHAT_HISTORY_COLLECTION,
                            keys=["message_id"],
                            points=[pt.id],
                        )
                    if new_payload.get("idempotency_key") and new_payload.get("session_id"):
                        target_id = _stable_point_id(
                            str(new_payload["session_id"]),
                            str(new_payload["idempotency_key"]),
                        )
                        if str(pt.id) != target_id:
                            logger.debug(
                                "[STEP] chat_history_migration point_id_drift old=%s target=%s",
                                pt.id,
                                target_id,
                            )
                updated += 1
            except Exception:  # noqa: BLE001
                logger.exception("[STEP] chat_history_migration error point=%s", pt.id)
                errors += 1
        if offset is None:
            break

    logger.info(
        "[STEP] chat_history_migration done apply=%s updated=%s scanned=%s skipped=%s errors=%s",
        apply,
        updated,
        scanned,
        skipped,
        errors,
    )
    return MigrationStats(scanned=scanned, updated=updated, skipped=skipped, errors=errors)
