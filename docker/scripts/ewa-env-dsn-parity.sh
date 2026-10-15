#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Assert EWA Postgres dual-env parity: .env.stack-ewa EWA_POSTGRES_* vs
# EWA_DATABASE_URL in .env.stack0.backend (same user/password/db).
# Invariants:
# - Never prints password or full DSN.
# - Exit 0 on match; non-zero on missing files or mismatch.
# Related:
# - documentation/platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md
# - documentation/platform/PROD-CORE-CONFIG-PLANE.md
# - docker/scripts/eliteew-prod-core-env-push.sh
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_DIR="${EWA_ENV_PARITY_DIR:-${REPO_ROOT}/docker/env_file}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [--env-dir DIR]

Compare EWA_POSTGRES_USER/PASSWORD/DB in .env.stack-ewa with credentials
parsed from EWA_DATABASE_URL in .env.stack0.backend.

Options:
  --env-dir DIR   directory containing both env files (default: docker/env_file
                  or EWA_ENV_PARITY_DIR)
  -h, --help

Exit codes:
  0  parity OK
  1  mismatch or missing keys
  2  usage / missing files
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-dir)
      ENV_DIR="$2"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown arg: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

STACK_EWA="${ENV_DIR}/.env.stack-ewa"
STACK0_BE="${ENV_DIR}/.env.stack0.backend"

if [[ ! -f "${STACK_EWA}" ]]; then
  echo "ERROR: missing ${STACK_EWA}" >&2
  exit 2
fi
if [[ ! -f "${STACK0_BE}" ]]; then
  echo "ERROR: missing ${STACK0_BE}" >&2
  exit 2
fi

# shellcheck disable=SC1090
set -a
# Intentionally source only keys we need via python extract (avoid sourcing whole secrets into shell for unrelated vars).
set +a

python3 - "${STACK_EWA}" "${STACK0_BE}" <<'PY'
from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import unquote, urlparse


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip("'").strip('"')
        if key:
            out[key] = val
    return out


def main() -> int:
    stack_ewa = Path(sys.argv[1])
    stack0 = Path(sys.argv[2])
    ewa = load_env(stack_ewa)
    be = load_env(stack0)

    user = ewa.get("EWA_POSTGRES_USER", "").strip()
    password = ewa.get("EWA_POSTGRES_PASSWORD", "")
    db = ewa.get("EWA_POSTGRES_DB", "").strip()
    dsn = be.get("EWA_DATABASE_URL", "").strip()

    errors: list[str] = []
    if not user:
        errors.append("EWA_POSTGRES_USER missing/empty in .env.stack-ewa")
    if not password:
        errors.append("EWA_POSTGRES_PASSWORD missing/empty in .env.stack-ewa")
    if not db:
        errors.append("EWA_POSTGRES_DB missing/empty in .env.stack-ewa")
    if not dsn:
        errors.append("EWA_DATABASE_URL missing/empty in .env.stack0.backend")

    if errors:
        for e in errors:
            print(f"ERROR: {e}", file=sys.stderr)
        return 1

    parsed = urlparse(dsn)
    if parsed.scheme not in ("postgresql", "postgres"):
        print(
            f"ERROR: EWA_DATABASE_URL scheme must be postgresql/postgres, got {parsed.scheme!r}",
            file=sys.stderr,
        )
        return 1

    dsn_user = unquote(parsed.username or "")
    dsn_password = unquote(parsed.password or "")
    dsn_db = (parsed.path or "").lstrip("/")
    dsn_host = parsed.hostname or ""

    if dsn_user != user:
        print("ERROR: EWA user mismatch (.env.stack-ewa vs EWA_DATABASE_URL)", file=sys.stderr)
        errors.append("user")
    if dsn_password != password:
        print(
            "ERROR: EWA password mismatch (.env.stack-ewa vs EWA_DATABASE_URL)",
            file=sys.stderr,
        )
        errors.append("password")
    if dsn_db != db:
        print("ERROR: EWA database name mismatch (.env.stack-ewa vs EWA_DATABASE_URL)", file=sys.stderr)
        errors.append("db")

    # Prod container DSN should use service name; 127.0.0.1 is OK for host-side migrations only.
    if dsn_host and dsn_host not in ("stack-ewa-postgres", "127.0.0.1", "localhost"):
        print(
            f"WARN: EWA_DATABASE_URL host={dsn_host!r} "
            f"(expected stack-ewa-postgres for API containers)",
            file=sys.stderr,
        )

    if errors:
        print("FAIL: ewa-env-dsn-parity", file=sys.stderr)
        return 1

    print(
        f"OK: ewa-env-dsn-parity user={user!r} db={db!r} host={dsn_host!r} "
        f"(password match, not printed)"
    )
    return 0


raise SystemExit(main())
PY
