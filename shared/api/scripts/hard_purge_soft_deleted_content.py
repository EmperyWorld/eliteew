#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Operator CLI: hard-purge soft-deleted unified_content older than retention.
# Invariants:
# - --dry-run is default; --apply required for deletes.
# - Retention from --days or UNIFIED_CONTENT_HARD_PURGE_DAYS (default 30).
# Related:
# - api/services/unified_content/storage_migrate_service.py
# ---
"""Hard-purge soft-deleted unified_content past retention window."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path
from uuid import UUID

_ELITEEW_ROOT = Path(__file__).resolve().parents[2]
if str(_ELITEEW_ROOT) not in sys.path:
    sys.path.insert(0, str(_ELITEEW_ROOT))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _run(*, dry_run: bool, limit: int, days: int | None, only: UUID | None) -> dict:
    from api.core.database_manager import get_asyncpg_pool
    from api.services.unified_content.storage_migrate_service import StorageMigrateService

    pool = await get_asyncpg_pool()
    service = StorageMigrateService(pool)
    return await service.hard_purge_soft_deleted(
        dry_run=dry_run,
        limit=limit,
        older_than_days=days,
        only_content_id=only,
    )


def main() -> None:
    p = argparse.ArgumentParser(description="Hard-purge soft-deleted unified_content")
    p.add_argument("--apply", action="store_true", help="Perform deletes (default is dry-run)")
    p.add_argument("--limit", type=int, default=500, help="Max rows per run")
    p.add_argument(
        "--days",
        type=int,
        default=None,
        help="Retention days (default env/30). Use 0 to purge all soft-deleted rows.",
    )
    p.add_argument("--only", type=str, default=None, help="Single content UUID")
    args = p.parse_args()
    only = UUID(args.only) if args.only else None
    dry_run = not args.apply
    result = asyncio.run(_run(dry_run=dry_run, limit=args.limit, days=args.days, only=only))
    logger.info("hard_purge_soft_deleted result=%s", result)
    if result.get("failed", 0):
        sys.exit(2)


if __name__ == "__main__":
    main()
