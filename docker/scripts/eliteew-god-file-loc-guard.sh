#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fail if tracked god-files grow past LOC baselines (QW#2). Shrink/equal OK.
# Invariants:
# - WorkflowBuilder.tsx is excluded (see baselines JSON exclude list).
# - Baselines live in docker/scripts/data/god-file-loc-baselines.json.
# Related:
# - documentation/platform/GOD-FILE-LOC-BASELINES.md
# - documentation/platform/ENGINEERING-GOVERNANCE-MANIFESTO.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BASELINES_JSON="${REPO_ROOT}/docker/scripts/data/god-file-loc-baselines.json"

if [[ ! -f "${BASELINES_JSON}" ]]; then
  echo "[god-file-loc-guard] ERROR: baselines missing: ${BASELINES_JSON}" >&2
  exit 2
fi

python3 - "${REPO_ROOT}" "${BASELINES_JSON}" <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path

repo = Path(sys.argv[1])
baselines_path = Path(sys.argv[2])
data = json.loads(baselines_path.read_text(encoding="utf-8"))
files: dict[str, int] = data.get("files") or {}
exclude = {item.get("path") for item in (data.get("exclude") or []) if item.get("path")}

# Explicit exclude (WorkflowBuilder) — never guard even if accidentally listed in files.
WORKFLOW_BUILDER = "shared/web/frontend/src/components/WorkflowBuilder.tsx"
exclude.add(WORKFLOW_BUILDER)

failed = 0
print("[god-file-loc-guard] measuring against baselines…")
for rel, baseline in sorted(files.items()):
    if rel in exclude:
        print(f"  SKIP (exclude): {rel}")
        continue
    path = repo / rel
    if not path.is_file():
        print(f"  FAIL missing: {rel}", file=sys.stderr)
        failed += 1
        continue
    loc = sum(1 for _ in path.open("r", encoding="utf-8", errors="replace"))
    status = "ok"
    if loc > int(baseline):
        status = "GROWTH"
        failed += 1
        print(f"  FAIL {rel}: loc={loc} baseline={baseline} (+{loc - int(baseline)})", file=sys.stderr)
    elif loc < int(baseline):
        status = "shrink"
        print(f"  {status}: {rel}: loc={loc} baseline={baseline}")
    else:
        print(f"  {status}: {rel}: loc={loc}")

print(f"[god-file-loc-guard] exclude noted: {WORKFLOW_BUILDER}")
if failed:
    print(f"[god-file-loc-guard] FAILED ({failed} file(s) grew past baseline)", file=sys.stderr)
    sys.exit(1)
print("[god-file-loc-guard] OK")
PY
