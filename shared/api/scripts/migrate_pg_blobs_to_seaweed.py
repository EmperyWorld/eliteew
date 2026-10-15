#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Operator CLI: migrate oversized unified_content BYTEA to SeaweedFS.
# Invariants:
# - --dry-run is default; --apply required for writes.
# Related:
# - api/services/unified_content/storage_migrate_service.py
# ---
"""Migrate PostgreSQL BYTEA blobs (≥ factory threshold) to SeaweedFS."""

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


async def _run(*, dry_run: bool, limit: int, only: UUID | None) -> dict:
    from api.core.database_manager import get_asyncpg_pool
    from api.services.unified_content.storage_migrate_service import StorageMigrateService

    pool = await get_asyncpg_pool()
    service = StorageMigrateService(pool)
    return await service.migrate_pg_blobs_to_seaweed(
        dry_run=dry_run,
        limit=limit,
        only_content_id=only,
    )


def main() -> None:
    p = argparse.ArgumentParser(description="Migrate PG BYTEA ≥ threshold to SeaweedFS")
    p.add_argument("--apply", action="store_true", help="Perform writes (default is dry-run)")
    p.add_argument("--limit", type=int, default=500, help="Max rows per run")
    p.add_argument("--only", type=str, default=None, help="Single content UUID")
    args = p.parse_args()
    only = UUID(args.only) if args.only else None
    dry_run = not args.apply
    result = asyncio.run(_run(dry_run=dry_run, limit=args.limit, only=only))
    logger.info("migrate_pg_blobs_to_seaweed result=%s", result)
    if result.get("failed", 0):
        sys.exit(2)


if __name__ == "__main__":
    main()
