#!/usr/bin/env bash
# Run openapi-typescript from the isolated TS5 tooling package (SPA uses typescript@7).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLING="$ROOT/tools/openapi-typescript-runtime"
if [[ ! -x "$TOOLING/node_modules/.bin/openapi-typescript" ]]; then
	echo "openapi-typescript-runtime: missing deps — run: pnpm run openapi:tooling:install" >&2
	exit 1
fi
# Resolve paths relative to frontend root (callers pass openapi/pilot/… and src/generated/…).
cd "$ROOT"
exec "$TOOLING/node_modules/.bin/openapi-typescript" "$@"
