#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world · Author: po&T && TZBrand
# ---
# Purpose:
# One-time/idempotent bootstrap for Celery → edge wg-mobile auto-sync after trusted-device bind.
# Invariants:
# - Generates a dedicated ed25519 key under keys/ (gitignored); never prints private key material.
# - Installs only the public key on eliteew-edge; does not mutate wg-mobile peers.
# Related:
# - documentation/product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md
# - api.services.mobile_private_tunnel_edge_sync
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
# shellcheck source=../yandex-tunnel/_ssh_defaults.sh
source "$SCRIPT_DIR/../yandex-tunnel/_ssh_defaults.sh"

ROOT="$(mobile_private_tunnel_repo_root "$SCRIPT_DIR")"
eliteew_yandex_source_env "$ROOT" 2>/dev/null || true

KEY_PATH="${MOBILE_WG_EDGE_CELERY_KEY_PATH:-$ROOT/keys/mobile_wg_edge_celery_key}"
VM_IP="${YANDEX_VM_IP:-93.77.165.185}"
ADMIN_USER="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
ENV_FILE="${MOBILE_PRIVATE_TUNNEL_STACK0_ENV:-$ROOT/docker/env_file/.env.stack0.backend}"

if [[ ! -f "$KEY_PATH" ]]; then
  echo ">>> generating $KEY_PATH"
  ssh-keygen -t ed25519 -f "$KEY_PATH" -N "" -C "eliteew-prod-core-celery-wg-edge-sync"
  chmod 600 "$KEY_PATH"
fi

ADMIN_KEY="$(eliteew_resolve_admin_private "$ROOT" "$ADMIN_USER")"
PUB="$(cat "${KEY_PATH}.pub")"
ssh -o BatchMode=yes -i "$ADMIN_KEY" "${ADMIN_USER}@${VM_IP}" \
  "mkdir -p ~/.ssh && chmod 700 ~/.ssh && grep -qF '${PUB}' ~/.ssh/authorized_keys 2>/dev/null || echo '${PUB}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
echo "PASS: celery edge SSH pubkey installed on ${ADMIN_USER}@${VM_IP}"

ssh -o BatchMode=yes -i "$KEY_PATH" "${ADMIN_USER}@${VM_IP}" 'sudo -n wg show wg-mobile peers | wc -l' >/dev/null
echo "PASS: celery key can SSH and sudo wg on edge"

if [[ "${1:-}" == "--write-env" ]]; then
  python3 - "$ENV_FILE" "$KEY_PATH" <<'PY'
import sys
from pathlib import Path

env_path = Path(sys.argv[1])
key_path = Path(sys.argv[2])
pem = key_path.read_text(encoding="utf-8").strip() + "\n"
lines = env_path.read_text(encoding="utf-8").splitlines()
prefix = "MOBILE_PRIVATE_TUNNEL_EDGE_"
lines = [ln for ln in lines if not ln.startswith(prefix)]
insert_at = next(
    (i + 1 for i, ln in enumerate(lines) if ln.startswith("MOBILE_TRUSTED_DEVICE_WG_ALLOWED_IPS=")),
    len(lines),
)
block = [
    "",
    "# Mobile trusted-device WireGuard edge auto-sync (Celery SSH → eliteew-edge)",
    "MOBILE_PRIVATE_TUNNEL_EDGE_SYNC_ENABLED=true",
    "MOBILE_PRIVATE_TUNNEL_EDGE_SSH_HOST=93.77.165.185",
    "MOBILE_PRIVATE_TUNNEL_EDGE_SSH_USER=eliteew-edge",
    "MOBILE_PRIVATE_TUNNEL_EDGE_SSH_TIMEOUT_SECONDS=15",
    "MOBILE_PRIVATE_TUNNEL_INTERFACE=wg-mobile",
    "MOBILE_PRIVATE_TUNNEL_PEER_KEEPALIVE_SECONDS=25",
    "MOBILE_PRIVATE_TUNNEL_EDGE_RECONCILE_INTERVAL_MINUTES=10",
    'MOBILE_PRIVATE_TUNNEL_EDGE_SSH_PRIVATE_KEY="' + pem.replace('"', '\\"') + '"',
]
lines[insert_at:insert_at] = block
env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"PASS: updated {env_path} (edge sync env block)")
PY
  echo "NEXT: bash docker/scripts/prod-core-env-bundle-build.sh"
  echo "       bash docker/scripts/prod-core-env-sops-encrypt.sh"
  echo "       bash docker/scripts/eliteew-prod-core-env-push.sh --yes"
  echo "       eeprodbaked --yes --backend-only"
fi

echo "OK: bootstrap-edge-celery-ssh complete"
