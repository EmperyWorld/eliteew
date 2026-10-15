#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Execute Redis FLUSHALL when STACK0_REDIS_FLUSHALL_ON_START=1 in start_all.sh.
# Invariants:
# - Uses REDIS_HOST/REDIS_PORT/REDIS_PASSWORD from environment only.
# - Non-zero exit on connection or flush failure; stderr carries exception class/message.
# Related:
# - docker/builders/stack0-api/scripts/start_all.sh
# ---
from __future__ import annotations

import os
import sys


def main() -> int:
    import redis

    host = os.environ["REDIS_HOST"]
    port = int(os.environ["REDIS_PORT"])
    password = os.environ.get("REDIS_PASSWORD")
    if password == "":
        password = None

    try:
        client = redis.Redis(
            host=host,
            port=port,
            password=password,
            socket_connect_timeout=30,
            decode_responses=False,
        )
        client.ping()
        client.flushall()
    except Exception as exc:
        print(f"Redis FLUSHALL failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
