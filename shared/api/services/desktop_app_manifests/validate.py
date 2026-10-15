# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# CLI entry: validate shared/apps manifests + legacy union (exit 0/1).
# Invariants:
# - Fail closed on schema/overlap/duplicate errors.
# Related:
# - scripts/eliteew/validate-app-manifests.sh
# ---

from __future__ import annotations

import sys

from api.services.desktop_app_manifests.loader import validate_all


def main() -> int:
    try:
        for line in validate_all():
            print(line)
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    print("PASS: app manifests + install profiles valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
