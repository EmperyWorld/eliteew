#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Wave K4–K8 — sync shared Kernel-offline policy SoT → packaging + package embed.
# Invariants:
# - SoT is host/kernel-offline/kernelOfflineMounts.policy.json only.
# - Package embeds policy/ for pnpm file: resolution (no relative escape from node_modules).
# Related:
# - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHECK=0
if [[ "${1:-}" == "--check" ]]; then
  CHECK=1
fi

export DC_K4_ROOT="$ROOT"
export DC_K4_CHECK="$CHECK"

python3 <<'PY'
import json
import os
import sys
from pathlib import Path

root = Path(os.environ["DC_K4_ROOT"])
check = os.environ.get("DC_K4_CHECK") == "1"

sot = (
    root
    / "host"
    / "kernel-offline"
    / "kernelOfflineMounts.policy.json"
)
packaging = (
    root
    / "pack-organization"
    / "connection-agent"
    / "packaging"
    / "kernel-offline-mounts.policy.json"
)
pkg_policy = (
    root
    / "shared"
    / "packages"
    / "kernel-offline-policy"
    / "src"
    / "kernelOfflineMounts.policy.json"
)
# Soft-retired layouts — must not reappear at living roots
legacy_local = (
    root
    / "pack-organization"
    / "connection-agent"
    / "src"
    / "lib"
    / "kernel"
    / "kernelOfflineMounts.policy.json"
)
legacy_generated = (
    root
    / "shared"
    / "web"
    / "frontend"
    / "src"
    / "pages"
    / "Desktop"
    / "shell"
    / "kernelOfflineSpaDeepLink.generated.ts"
)

if not sot.is_file():
    print(f"FAIL: missing SoT {sot}", file=sys.stderr)
    sys.exit(1)

if legacy_local.is_file():
    print(
        f"FAIL: legacy local policy must be trash-moved (SoT is shared): {legacy_local}",
        file=sys.stderr,
    )
    sys.exit(1)

if legacy_generated.is_file():
    print(
        f"FAIL: legacy generated allowlist must be trash-moved: {legacy_generated}",
        file=sys.stderr,
    )
    sys.exit(1)

raw = sot.read_text(encoding="utf-8")
policy = json.loads(raw)
mounts = policy.get("mounts") or {}
spa_ids = sorted(
    mid
    for mid, ment in mounts.items()
    if isinstance(ment, dict) and ment.get("spa_deep_link") is True
)

body = json.dumps(policy, ensure_ascii=False, indent=2) + "\n"

targets = [
    (packaging, "packaging policy"),
    (pkg_policy, "package embedded policy"),
]

drift = False
for path, label in targets:
    current = path.read_text(encoding="utf-8") if path.is_file() else None
    if current != body:
        drift = True
        print(f"DRIFT: {label} ({path.relative_to(root)})", file=sys.stderr)

if check:
    if drift:
        print(
            "FAIL: run bash scripts/eliteew/desktop-client-kernel-offline-policy-sync.sh",
            file=sys.stderr,
        )
        sys.exit(1)
    print(f"OK: policy sync clean (spa_deep_link={spa_ids})")
    sys.exit(0)

for path, _label in targets:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
print(f"OK: synced packaging + package embed from shared SoT spa_deep_link={spa_ids}")
PY
