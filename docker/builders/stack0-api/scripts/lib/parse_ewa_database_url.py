#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# CLI wrapper: parse EWA_DATABASE_URL for host/port/db (no secrets in stdout).
# Invariants:
# - Exit 2 when EWA_DATABASE_URL is unset/empty (EWA pool disabled).
# - Exit 3 on malformed DSN; stderr carries operator-safe message without password.
# Related:
# - docker/builders/stack0-api/scripts/lib/stack0_preflight_lib.py
# ---
from __future__ import annotations

import os
import sys
from pathlib import Path

_LIB_DIR = Path(__file__).resolve().parent
if str(_LIB_DIR) not in sys.path:
    sys.path.insert(0, str(_LIB_DIR))

from stack0_preflight_lib import parse_ewa_database_url


def main() -> int:
    raw = (os.environ.get("EWA_DATABASE_URL") or "").strip()
    if not raw:
        return 2
    try:
        target = parse_ewa_database_url(raw)
        if target is None:
            return 2
        sys.stdout.write(f"{target.host}\t{target.port}\t{target.database}\n")
        return 0
    except ValueError as exc:
        print(f"EWA_DATABASE_URL parse error: {exc}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
