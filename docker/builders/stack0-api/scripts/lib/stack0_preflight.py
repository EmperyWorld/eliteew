#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# CLI entrypoint for stack0 API container preflight (imports, TCP/HTTP, guards).
# Invariants:
# - Exit 0 only when report.exit_code is 0.
# - Reads configuration from environment only (twelve-factor).
# Related:
# - docker/builders/stack0-api/scripts/start_all.sh
# - docker/builders/stack0-api/scripts/lib/stack0_preflight_lib.py
# ---
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Allow `python stack0_preflight.py` from lib/ without package install.
_LIB_DIR = Path(__file__).resolve().parent
if str(_LIB_DIR) not in sys.path:
    sys.path.insert(0, str(_LIB_DIR))

from stack0_preflight_lib import format_operator_lines, run_preflight


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="stack0 API startup preflight")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON on stdout (logs on stderr).",
    )
    parser.add_argument(
        "--python",
        dest="python_executable",
        default=None,
        help="Python interpreter for import checklist (default: sys.executable).",
    )
    args = parser.parse_args(argv)

    report = run_preflight(python_executable=args.python_executable)

    if args.json:
        payload = {
            "exit_code": report.exit_code,
            "checks": [
                {
                    "key": c.key,
                    "name": c.name,
                    "status": c.status,
                    "detail": c.detail,
                }
                for c in report.checks
            ],
        }
        sys.stdout.write(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    else:
        for line in format_operator_lines(report):
            stream = sys.stderr if line.startswith("[FAIL]") or line.startswith("[WARN]") else sys.stdout
            print(line, file=stream)

    return report.exit_code


if __name__ == "__main__":
    raise SystemExit(main())
