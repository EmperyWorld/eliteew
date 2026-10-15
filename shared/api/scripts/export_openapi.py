# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Dump FastAPI OpenAPI JSON from api.main (no HTTP, no Bearer) for pilot extract.
# Invariants:
# - Prefer container/SSH export via export_openapi_docker.sh on hosts without full API venv.
# Related:
# - documentation/api/FRONTEND-BACKEND-HTTP.md
# - shared/web/frontend/scripts/openapi-extract-pilots.mjs
# ---
"""Dump FastAPI OpenAPI JSON to stdout or a file (no HTTP, no Bearer).

Typical use when host venv is incomplete:
  podman exec stack0-eliteew-api-prod-baked python /app/api/scripts/export_openapi.py /tmp/openapi.json

From monorepo with working EliteEW API env (PYTHONPATH includes EliteEW or /app):
  python shared/api/scripts/export_openapi.py documentation/api/eliteew-openapi-export.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _repo_root_for_imports() -> Path:
    """EliteEW on host, or /app in API container (api lives under api/)."""
    here = Path(__file__).resolve()
    return here.parent.parent.parent


def main() -> int:
    parser = argparse.ArgumentParser(description="Export FastAPI OpenAPI schema")
    parser.add_argument(
        "out",
        nargs="?",
        default="-",
        help="Output path, or '-' for stdout (default: -)",
    )
    args = parser.parse_args()
    root = _repo_root_for_imports()
    sys.path.insert(0, str(root))
    try:
        import api.main as main_mod
    except ImportError as e:
        print(
            "Failed to import api.main (missing deps or wrong cwd). Try inside API container:\n"
            "  podman exec stack0-eliteew-api-prod-baked python /app/api/scripts/export_openapi.py /tmp/o.json\n"
            "Or from command-center: pnpm run openapi:export:prod-core (shared/web/frontend)",
            file=sys.stderr,
        )
        print(f"ImportError: {e}", file=sys.stderr)
        return 1
    from fastapi import FastAPI

    target = getattr(main_mod, "fastapi_app", main_mod.app)
    if not isinstance(target, FastAPI):
        print(
            "Loaded api.main but no FastAPI instance for .openapi() "
            "(expected api.main.fastapi_app after Socket.IO wrap).",
            file=sys.stderr,
        )
        return 1
    schema = target.openapi()
    text = json.dumps(schema, ensure_ascii=False, separators=(",", ":"))
    if args.out == "-":
        sys.stdout.write(text)
        return 0
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(text, encoding="utf-8")
    print(f"Wrote {out_path} ({len(text)} bytes)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
