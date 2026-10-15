#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# One-shot Phase-2 Qdrant refill after embed dim cutover to 1024 (ops, run inside stack0 API).
# Invariants:
# - Idempotent reindex via existing product services; no invented embed clients.
# - Memory cells without recoverable chat source are reported, not fabricated.
# Related:
# - documentation/platform/LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md (Phase 2 refill)
# ---
"""Phase 2: refill empty 1024-dim Qdrant collections from Postgres sources."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import time
from typing import Any
from uuid import UUID

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("phase2_qdrant_refill")


async def _qdrant_counts() -> dict[str, int]:
    from api.services.marketing_project_rag_service import _get_qdrant_client

    client = await _get_qdrant_client()
    if client is None:
        return {}
    cols = await client.get_collections()
    out: dict[str, int] = {}
    for col in cols.collections:
        info = await client.get_collection(col.name)
        out[col.name] = int(info.points_count or 0)
    return out


async def refill_product_assistant_kb() -> dict[str, int]:
    from api.routers.product_desktop_assistant_kb import _assistant_kb_reindex_all_background

    t0 = time.monotonic()
    await _assistant_kb_reindex_all_background()
    return {"seconds": int(time.monotonic() - t0)}


async def refill_eliteew_documents() -> dict[str, Any]:
    from api.services.unified_content.qdrant_migration_job import run_unified_content_qdrant_migration

    t0 = time.monotonic()
    stats = await run_unified_content_qdrant_migration(batch_size=50, dry_run=False)
    stats["seconds"] = int(time.monotonic() - t0)
    return stats


async def refill_marketing_project_rag(*, limit: int | None = None) -> dict[str, int]:
    from api.core.database_manager import get_database_manager
    from api.services.marketing_project_rag_sources_service import reindex_marketing_rag_source_if_included

    manager = await get_database_manager()
    pool = await manager.get_asyncpg_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id
            FROM unified_content
            WHERE marketing_rag_included IS TRUE
              AND deleted_at IS NULL
            ORDER BY updated_at ASC NULLS LAST, created_at ASC
            """
        )
    if limit is not None:
        rows = rows[: max(0, limit)]
    total = len(rows)
    ok = 0
    fail = 0
    skip = 0
    t0 = time.monotonic()
    logger.info("[STEP] marketing_rag refill started total=%s", total)
    for i, row in enumerate(rows):
        cid = UUID(str(row["id"]))
        try:
            did = await reindex_marketing_rag_source_if_included(pool, content_id=cid)
            if did:
                ok += 1
            else:
                skip += 1
        except Exception:
            logger.exception("[STEP] marketing_rag refill failed content_id=%s", cid)
            fail += 1
        if total and (i + 1) % 25 == 0:
            logger.info(
                "[STEP] marketing_rag refill progress %s/%s ok=%s skip=%s fail=%s",
                i + 1,
                total,
                ok,
                skip,
                fail,
            )
    logger.info(
        "[STEP] marketing_rag refill finished ok=%s skip=%s fail=%s total=%s",
        ok,
        skip,
        fail,
        total,
    )
    return {
        "total": total,
        "ok": ok,
        "skip": skip,
        "fail": fail,
        "seconds": int(time.monotonic() - t0),
    }


async def refill_desktop_chat_rag() -> dict[str, int]:
    from api.core.database_manager import get_database_manager
    from api.services.desktop_chat.rag_service import index_unified_content_desktop_chat_rag

    manager = await get_database_manager()
    pool = await manager.get_asyncpg_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT a.chat_id, a.content_id, c.user_id AS owner_user_id
            FROM desktop_ai_chat_attachments a
            JOIN desktop_ai_chats c ON c.id = a.chat_id
            WHERE a.content_id IS NOT NULL
            """
        )
    ok = 0
    fail = 0
    skip = 0
    t0 = time.monotonic()
    for row in rows:
        try:
            did = await index_unified_content_desktop_chat_rag(
                pool,
                chat_id=UUID(str(row["chat_id"])),
                content_id=UUID(str(row["content_id"])),
                owner_user_id=UUID(str(row["owner_user_id"])),
            )
            if did:
                ok += 1
            else:
                skip += 1
        except Exception:
            logger.exception(
                "[STEP] desktop_chat_rag refill failed chat=%s content=%s",
                row["chat_id"],
                row["content_id"],
            )
            fail += 1
    logger.info(
        "[STEP] desktop_chat_rag refill finished ok=%s skip=%s fail=%s total=%s",
        ok,
        skip,
        fail,
        len(rows),
    )
    return {
        "total": len(rows),
        "ok": ok,
        "skip": skip,
        "fail": fail,
        "seconds": int(time.monotonic() - t0),
    }


async def refill_memory_cells_recoverable() -> dict[str, Any]:
    """Rebuild vectors for cells that still have a bound Desktop chat (no chat delete)."""
    from api.core.database_manager import get_database_manager
    from api.models.desktop_ai_chat import DesktopAiChat, DesktopAiMemoryCell
    from api.services.desktop_chat.memory_cells_rag import index_memory_cell_documents
    from api.services.desktop_chat.memory_cells_service import _gather_chat_documents
    from api.services.desktop_chat.memory_cells_settings import memory_cells_max_chunks, memory_cells_max_messages
    from api.services.desktop_chat.service_helpers import fetch_config_defaults
    from sqlalchemy import select

    manager = await get_database_manager()
    pool = await manager.get_asyncpg_pool()
    rebuilt: list[str] = []
    skipped: list[dict[str, str]] = []
    fail: list[str] = []

    async with manager.get_postgres_session() as session:
        cells = list((await session.execute(select(DesktopAiMemoryCell))).scalars().all())
        defaults = await fetch_config_defaults(session)
        max_messages = memory_cells_max_messages(defaults)
        max_chunks = memory_cells_max_chunks(defaults)
        for cell in cells:
            chat_row = (
                await session.execute(select(DesktopAiChat).where(DesktopAiChat.memory_cell_id == cell.id))
            ).scalar_one_or_none()
            if chat_row is None:
                skipped.append(
                    {
                        "cell_id": str(cell.id),
                        "reason": "no_bound_chat_and_source_chat_cleared",
                    }
                )
                continue
            try:
                documents, message_count, char_count = await _gather_chat_documents(
                    session, pool, chat_id=chat_row.id, max_messages=max_messages
                )
                if not documents:
                    skipped.append({"cell_id": str(cell.id), "reason": "empty_chat"})
                    continue
                chunk_count = await index_memory_cell_documents(
                    cell_id=cell.id,
                    owner_user_id=cell.owner_user_id,
                    documents=documents,
                    max_chunks=max_chunks,
                )
                cell.status = "ready"
                cell.message_count_indexed = message_count
                cell.chunk_count = chunk_count
                cell.char_count = char_count
                await session.commit()
                rebuilt.append(str(cell.id))
                logger.info(
                    "[STEP] memory_cell_reindex_ok cell_id=%s chunks=%s chat_kept=%s",
                    cell.id,
                    chunk_count,
                    chat_row.id,
                )
            except Exception as exc:  # noqa: BLE001
                logger.exception("[STEP] memory_cell refill failed cell_id=%s", cell.id)
                fail.append(f"{cell.id}:{type(exc).__name__}")

    return {"rebuilt": rebuilt, "skipped": skipped, "fail": fail}


async def refill_chat_history_from_messages(*, limit_pairs: int | None = None) -> dict[str, int]:
    """Best-effort turn memory rebuild from stored Desktop AI message pairs."""
    from api.core.database_manager import get_database_manager
    from api.services.desktop_chat.service_helpers import record_desktop_chat_turn_memory

    manager = await get_database_manager()
    pool = await manager.get_asyncpg_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT chat_id, role, content, id
            FROM desktop_ai_chat_messages
            WHERE role IN ('user', 'assistant')
              AND content IS NOT NULL
              AND btrim(content) <> ''
            ORDER BY chat_id, created_at ASC, id ASC
            """
        )
    pending_user: dict[str, tuple[str, UUID | None]] = {}
    pairs: list[tuple[UUID, str, str, UUID | None]] = []
    for row in rows:
        chat_id = UUID(str(row["chat_id"]))
        role = str(row["role"])
        text = str(row["content"] or "").strip()
        mid = UUID(str(row["id"])) if row["id"] is not None else None
        key = str(chat_id)
        if role == "user":
            pending_user[key] = (text, mid)
            continue
        if role == "assistant" and key in pending_user:
            ut, _uid = pending_user.pop(key)
            pairs.append((chat_id, ut, text, mid))
    if limit_pairs is not None:
        pairs = pairs[: max(0, limit_pairs)]

    ok = 0
    fail = 0
    t0 = time.monotonic()
    logger.info("[STEP] chat_history refill started pairs=%s", len(pairs))
    for i, (chat_id, ut, at, mid) in enumerate(pairs):
        try:
            await record_desktop_chat_turn_memory(
                chat_id=chat_id,
                user_text=ut,
                assistant_text=at,
                assistant_message_id=mid,
            )
            ok += 1
        except Exception:
            logger.exception("[STEP] chat_history refill failed chat=%s msg=%s", chat_id, mid)
            fail += 1
        if len(pairs) and (i + 1) % 50 == 0:
            logger.info("[STEP] chat_history refill progress %s/%s", i + 1, len(pairs))
    return {
        "pairs": len(pairs),
        "ok": ok,
        "fail": fail,
        "seconds": int(time.monotonic() - t0),
    }


async def refill_companion_episodic(*, max_rounds: int = 80) -> dict[str, Any]:
    from api.ewa_platform.companion.episodic.reembed import companion_reembed_drain_pending_backlog
    from api.ewa_platform.settings.service import bootstrap_ewa_platform_settings
    from api.ewa_platform.workers.ewa_pool import open_initialized_ewa_worker_pool

    pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=4)
    await bootstrap_ewa_platform_settings(pool)
    async with pool.acquire() as conn:
        status = await conn.execute(
            """
            UPDATE ewa_companion_episodes
            SET vector_status = 'pending'
            WHERE vector_status IN ('indexed', 'failed')
            """
        )
        pending = await conn.fetchval(
            "SELECT COUNT(*)::int FROM ewa_companion_episodes WHERE vector_status = 'pending'"
        )
    logger.info("[STEP] companion mark pending status=%s pending=%s", status, pending)
    t0 = time.monotonic()
    drain = await companion_reembed_drain_pending_backlog(pool, max_rounds=max_rounds)
    drain["mark_pending"] = pending
    drain["seconds"] = int(time.monotonic() - t0)
    return drain


async def run(args: argparse.Namespace) -> int:
    summary: dict[str, Any] = {"before": await _qdrant_counts()}
    logger.info("[STEP] qdrant before=%s", summary["before"])

    steps = [s.strip() for s in args.steps.split(",") if s.strip()]
    if "assistant_kb" in steps:
        summary["assistant_kb"] = await refill_product_assistant_kb()
    if "eliteew_documents" in steps:
        summary["eliteew_documents"] = await refill_eliteew_documents()
    if "desktop_chat_rag" in steps:
        summary["desktop_chat_rag"] = await refill_desktop_chat_rag()
    if "memory_cells" in steps:
        summary["memory_cells"] = await refill_memory_cells_recoverable()
    if "chat_history" in steps:
        summary["chat_history"] = await refill_chat_history_from_messages(limit_pairs=args.chat_history_limit)
    if "marketing" in steps:
        summary["marketing"] = await refill_marketing_project_rag(limit=args.marketing_limit)
    if "companion" in steps:
        summary["companion"] = await refill_companion_episodic(max_rounds=args.companion_max_rounds)

    summary["after"] = await _qdrant_counts()
    logger.info("[STEP] qdrant after=%s", summary["after"])
    logger.info("[STEP] summary=%s", summary)
    print(summary)
    return 0


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--steps",
        default=("assistant_kb,eliteew_documents,desktop_chat_rag,memory_cells,chat_history,marketing,companion"),
        help="Comma-separated refill steps",
    )
    p.add_argument("--marketing-limit", type=int, default=None)
    p.add_argument("--chat-history-limit", type=int, default=None)
    p.add_argument("--companion-max-rounds", type=int, default=80)
    args = p.parse_args()
    raise SystemExit(asyncio.run(run(args)))


if __name__ == "__main__":
    main()
