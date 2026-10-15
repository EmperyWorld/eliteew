#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose: Wave K0–K12 catalog + Kernel-offline policy parity (+ policy sync --check).
# Invariants:
# - Fail-closed on missing id in any layer; does not claim Kernel offline Done.
# Related:
# - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
# - host/kernel-offline/kernelOfflineMounts.policy.json
# - scripts/eliteew/desktop-client-kernel-offline-policy-sync.sh
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Wave K4–K5: packaging must match shared policy SoT
bash "$ROOT/scripts/eliteew/desktop-client-kernel-offline-policy-sync.sh" --check

# Wave K8: private package must wrap shared SoT
pkg_index="$ROOT/shared/packages/kernel-offline-policy/src/index.ts"
pkg_json="$ROOT/shared/packages/kernel-offline-policy/package.json"
if [[ ! -f "$pkg_index" || ! -f "$pkg_json" ]]; then
  echo "FAIL: missing @eliteew/kernel-offline-policy package" >&2
  exit 1
fi
if ! rg -q "from './kernelOfflineMounts.policy.json'" "$pkg_index" && ! rg -q 'from "./kernelOfflineMounts.policy.json"' "$pkg_index"; then
  echo "FAIL: kernel-offline-policy must import ./kernelOfflineMounts.policy.json" >&2
  exit 1
fi
pkg_policy="$ROOT/shared/packages/kernel-offline-policy/src/kernelOfflineMounts.policy.json"
if [[ ! -f "$pkg_policy" ]]; then
  echo "FAIL: missing embedded package policy in src/ (run policy-sync)" >&2
  exit 1
fi
if ! rg -q '"name": "@eliteew/kernel-offline-policy"' "$pkg_json"; then
  echo "FAIL: package name must be @eliteew/kernel-offline-policy" >&2
  exit 1
fi
echo "OK: @eliteew/kernel-offline-policy wraps shared SoT (src embed)"

# Wave K9: consumers resolve via pnpm workspace:* (not fragile file: alone)
fe_pkg="$ROOT/shared/web/frontend/package.json"
dc_pkg="$ROOT/pack-organization/connection-agent/package.json"
fe_ws="$ROOT/shared/web/frontend/pnpm-workspace.yaml"
dc_ws="$ROOT/pack-organization/connection-agent/pnpm-workspace.yaml"
if ! rg -q '"@eliteew/kernel-offline-policy": "workspace:\*"' "$fe_pkg"; then
  echo "FAIL: frontend must depend on @eliteew/kernel-offline-policy via workspace:*" >&2
  exit 1
fi
if ! rg -q '"@eliteew/kernel-offline-policy": "workspace:\*"' "$dc_pkg"; then
  echo "FAIL: desktop-client must depend on @eliteew/kernel-offline-policy via workspace:*" >&2
  exit 1
fi
if ! rg -q 'packages/\*' "$fe_ws"; then
  echo "FAIL: frontend pnpm-workspace must include shared/packages/*" >&2
  exit 1
fi
if ! rg -q 'packages/\*' "$dc_ws"; then
  echo "FAIL: desktop-client pnpm-workspace must include ../../shared/packages/*" >&2
  exit 1
fi
echo "OK: K9 workspace:* consumers (FE + desktop-client)"


export DC_K0_ROOT="$ROOT"

python3 <<'PY'
import re
import sys
from pathlib import Path

root = Path(__import__("os").environ["DC_K0_ROOT"])
apps = root / "shared" / "apps"
router = (
    root
    / "pack-organization"
    / "connection-agent"
    / "src"
    / "features"
    / "shell"
    / "offlineAppRouter.ts"
)
registry = (
    root
    / "shared"
    / "web"
    / "frontend"
    / "src"
    / "pages"
    / "Desktop"
    / "shell"
    / "appMounts.registry.ts"
)

fail = 0


def die(msg: str) -> None:
    global fail
    print(f"FAIL: {msg}", file=sys.stderr)
    fail = 1


def ok(msg: str) -> None:
    print(f"OK: {msg}")


# --- manifests: edition_default.client: true → app_component
manifest_ids: set[str] = set()
for path in sorted(apps.glob("*/app.manifest.yaml")):
    text = path.read_text(encoding="utf-8")
    if not re.search(r"(?m)^\s*client:\s*true\s*$", text):
        continue
    m = re.search(r"(?m)^\s*app_component:\s*(\S+)\s*$", text)
    if not m:
        die(f"{path.relative_to(root)}: client:true but no app_component")
        continue
    manifest_ids.add(m.group(1).strip())

if not manifest_ids:
    die("no edition_default.client:true manifests found")
else:
    ok(f"manifests client:true → {sorted(manifest_ids)}")

# --- O5 PACK_OFFLINE_APP_IDS
router_text = router.read_text(encoding="utf-8")
block = re.search(
    r"export const PACK_OFFLINE_APP_IDS\s*=\s*\[(.*?)\]\s*as const",
    router_text,
    re.S,
)
if not block:
    die(f"PACK_OFFLINE_APP_IDS not found in {router}")
    pack_ids: set[str] = set()
else:
    pack_ids = set(re.findall(r"'([A-Za-z0-9_]+)'", block.group(1)))
    ok(f"O5 PACK_OFFLINE_APP_IDS → {sorted(pack_ids)}")

# --- K5 shared policy SoT
policy_path = (
    root
    / "host"
    / "kernel-offline"
    / "kernelOfflineMounts.policy.json"
)
try:
    import json

    policy = json.loads(policy_path.read_text(encoding="utf-8"))
except Exception as e:
    die(f"policy load failed: {e}")
    policy = {"mounts": {}}

policy_ids = set((policy.get("mounts") or {}).keys())
ok(f"K2 policy mounts → {sorted(policy_ids)}")

missing_policy = sorted(pack_ids - policy_ids)
if missing_policy:
    die(f"O5 pack missing from kernelOfflineMounts.policy.json: {missing_policy}")
else:
    ok("O5 pack ⊆ K2 policy")

extra_policy = sorted(policy_ids - pack_ids)
spa_offline_only_ids: list[str] = []
for mid in extra_policy:
    ment = (policy.get("mounts") or {}).get(mid) or {}
    mode = ment.get("mode")
    if mode != "spa_offline_only":
        die(
            f"policy id {mid} not in O5 pack must use mode spa_offline_only (K10), got {mode!r}"
        )
    spa_offline_only_ids.append(mid)
if extra_policy:
    ok(f"K10 spa_offline_only beyond pack → {sorted(spa_offline_only_ids)}")
else:
    ok("K10: no spa_offline_only beyond pack (allowed)")

spa_deep_link_ids: list[str] = []
offline_subset_ids: list[str] = []
for mid, ment in (policy.get("mounts") or {}).items():
    mode = ment.get("mode")
    if mode not in ("presentation_url", "o5_panel_only", "spa_offline_only"):
        die(f"policy {mid}: bad mode {mode!r}")
    if mode == "presentation_url":
        path = (ment.get("path") or "").strip()
        if not path.startswith("/"):
            die(f"policy {mid}: presentation_url needs absolute path")
    if mode in ("presentation_url", "o5_panel_only") and mid not in pack_ids:
        die(f"policy {mid}: pack modes require O5 pack membership")
    if mode == "spa_offline_only" and mid in pack_ids:
        die(f"policy {mid}: spa_offline_only must not be in O5 pack")
    sdl = ment.get("spa_deep_link")
    if mode == "spa_offline_only" and sdl is True:
        die(f"policy {mid}: spa_offline_only must not set spa_deep_link (K12)")
    if sdl is not None and not isinstance(sdl, bool):
        die(f"policy {mid}: spa_deep_link must be bool")
    if sdl is True:
        spa_deep_link_ids.append(mid)
    oss = ment.get("offline_spa_subset")
    if oss is not None and not isinstance(oss, bool):
        die(f"policy {mid}: offline_spa_subset must be bool")
    if oss is True:
        offline_subset_ids.append(mid)
    elif oss is not True:
        die(f"policy {mid}: offline_spa_subset must be true for SoT mounts (K6/K10)")
ok("K2–K12 policy modes/paths/spa_deep_link/offline_spa_subset sane")
ok(f"K3 spa_deep_link mounts → {sorted(spa_deep_link_ids)}")
ok(f"K6/K12 offline_spa_subset mounts → {sorted(offline_subset_ids)}")

missing_subset = sorted(pack_ids - set(offline_subset_ids))
if missing_subset:
    die(f"O5 pack missing offline_spa_subset:true: {missing_subset}")
else:
    ok("O5 pack ⊆ offline_spa_subset")

# Wave K10: offline_spa_subset may strictly supersede O5 pack (spa_offline_only)
beyond_pack = sorted(set(offline_subset_ids) - pack_ids)
if beyond_pack:
    ok(f"K10 offline_spa_subset beyond O5 pack → {beyond_pack}")
else:
    ok("offline_spa_subset == O5 pack (no K10 extras)")

# --- SPA APP_MOUNTED_COMPONENTS
reg_text = registry.read_text(encoding="utf-8")
mblock = re.search(
    r"export const APP_MOUNTED_COMPONENTS\s*=\s*\[(.*?)\]\s*as const",
    reg_text,
    re.S,
)
if not mblock:
    die(f"APP_MOUNTED_COMPONENTS not found in {registry}")
    mounted: set[str] = set()
else:
    mounted = set(re.findall(r"'([A-Za-z0-9_]+)'", mblock.group(1)))
    ok(f"SPA APP_MOUNTED count={len(mounted)}")

missing_pack = sorted(manifest_ids - pack_ids)
if missing_pack:
    die(f"manifests client:true missing from O5 pack: {missing_pack}")
else:
    ok("manifests ⊆ O5 pack")

extra_pack = sorted(pack_ids - manifest_ids)
if extra_pack:
    die(f"O5 pack ids not client:true in manifests: {extra_pack}")
else:
    ok("O5 pack ⊆ manifests client:true")

missing_spa = sorted(pack_ids - mounted)
if missing_spa:
    die(f"O5 pack missing from SPA APP_MOUNTED_COMPONENTS: {missing_spa}")
else:
    ok("O5 pack ⊆ SPA APP_MOUNTED_COMPONENTS")

missing_beyond_spa = sorted(set(beyond_pack) - mounted)
if missing_beyond_spa:
    die(
        f"K10 spa_offline_only ids missing from SPA APP_MOUNTED_COMPONENTS: {missing_beyond_spa}"
    )
elif beyond_pack:
    ok("K10 spa_offline_only ⊆ SPA APP_MOUNTED_COMPONENTS")

if fail:
    sys.exit(1)
print("PASS desktop-client-kernel-offline-catalog-parity")
PY
