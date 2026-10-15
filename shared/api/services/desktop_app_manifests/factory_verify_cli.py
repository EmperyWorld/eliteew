# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# CLI for verify-app-factory.sh — print gate reports; exit 1 on any FAILED.
# Invariants:
# - --all-manifests verifies every shared/apps/*/app.manifest.yaml id.
# Related:
# - factory_verify.py
# ---

from __future__ import annotations

import argparse
import sys

from api.services.desktop_app_manifests.factory_verify import (
    format_report,
    verify_apps,
)
from api.services.desktop_app_manifests.loader import load_manifests


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="EliteEW app factory DoD verify (D1–D3)")
    parser.add_argument(
        "app_ids",
        nargs="*",
        help="Manifest ids under shared/apps/<id>",
    )
    parser.add_argument(
        "--all-manifests",
        action="store_true",
        help="Verify every product manifest in shared/apps",
    )
    args = parser.parse_args(argv)

    ids = sorted(m.id for m in load_manifests()) if args.all_manifests else list(args.app_ids)
    if not ids:
        parser.error("pass app ids or --all-manifests")

    reports = verify_apps(ids)
    failed = 0
    for report in reports:
        print(format_report(report))
        if not report.ok:
            failed += 1
    if failed:
        print(f"FAIL: {failed}/{len(reports)} app(s) verify_status=FAILED", file=sys.stderr)
        return 1
    print(f"PASS: {len(reports)} app(s) verify_status=PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
