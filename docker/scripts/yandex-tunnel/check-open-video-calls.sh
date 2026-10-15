#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose: One-shot check for open ringing/active video_calls via stack0 API container.
# Related: video_calls table, video_call_ringing_watchdog celery tasks.
# ---
set -euo pipefail

RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
API_CTR="${ELITEEW_API_CONTAINER:-stack0-eliteew-api-prod-baked}"

"$RUNTIME" exec -i -e PYTHONDONTWRITEBYTECODE=1 "$API_CTR" python - <<'PY'
import asyncio
import os

import asyncpg


async def main() -> None:
    host = os.environ.get("POSTGRES_HOST", "stack1-postgres")
    db = os.environ.get("POSTGRES_DB") or os.environ.get("POSTGRES_DATABASE") or "ai_services"
    user = os.environ.get("POSTGRES_USER", "ai_user")
    password = os.environ.get("POSTGRES_PASSWORD", "")
    dsn = os.environ.get("DATABASE_URL") or f"postgresql://{user}:{password}@{host}/{db}"
    conn = await asyncpg.connect(dsn, timeout=8)
    open_rows = await conn.fetch(
        """
        SELECT id::text AS id, status, missed_reason, created_at, ended_at
        FROM video_calls
        WHERE status IN ('ringing', 'active')
        ORDER BY created_at DESC
        LIMIT 20
        """
    )
    print(f"open_count={len(open_rows)}")
    for row in open_rows:
        print(dict(row))
    recent = await conn.fetch(
        """
        SELECT id::text AS id, status, created_at, ended_at
        FROM video_calls
        WHERE created_at > NOW() - INTERVAL '2 hours'
        ORDER BY created_at DESC
        LIMIT 10
        """
    )
    print(f"recent_2h={len(recent)}")
    for row in recent:
        print(row["status"], row["id"][:8], "ended=", row["ended_at"])
    await conn.close()


asyncio.run(main())
PY