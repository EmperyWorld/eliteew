#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Install the fail-closed Air enrollment ingress/controller on canonical edge.
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
# shellcheck source=../_ssh_defaults.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../_ssh_defaults.sh"

eliteew_yandex_source_env "$REPO_ROOT" 2>/dev/null || true

EDGE_IP="${YANDEX_VM_IP:-}"
EDGE_ADMIN_USER="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
EDGE_SG_ID="${ELITEEW_AIR_ENROLL_SG_ID:-}"
EDGE_INSTANCE_ID="${ELITEEW_AIR_ENROLL_INSTANCE_ID:-}"
CONTROL_PUBLIC_KEY="${ELITEEW_AIR_ENROLL_SSH_PUBLIC_KEY_PATH:-}"
EDGE_ADMIN_KEY="${YANDEX_VM_ADMIN_KEY_PATH:-}"

CONTROLLER_SRC="$SCRIPT_DIR/eliteew_air_enroll_edge.py"
FORCE_COMMAND_SRC="$SCRIPT_DIR/eliteew-air-enroll-force-command.sh"
NFT_SRC="$SCRIPT_DIR/eliteew-air-enroll.nft"
NGINX_SRC="$REPO_ROOT/docker/host_conf/nginx-air-enroll.conf.template"
BACKHAUL_WG_SRC="$REPO_ROOT/docker/host_conf/backhaul/eliteew-backhaul-upstreams-wg.inc"
BACKHAUL_SSH_SRC="$REPO_ROOT/docker/host_conf/backhaul/eliteew-backhaul-upstreams-ssh.inc"

usage() {
  cat <<'EOF'
Usage:
  ELITEEW_AIR_ENROLL_SG_ID=<dedicated-sg-id> \
  ELITEEW_AIR_ENROLL_SSH_PUBLIC_KEY_PATH=<prod-core-public-key> \
  bash docker/scripts/yandex-tunnel/air-enroll/install-air-enroll-edge.sh

Required preconditions:
  - dedicated SG is named eliteew_air_enroll_security_group;
  - it is attached only to the canonical edge NIC;
  - edge VM has an attached service account with least-privilege SG read/update
    and Compute read permissions;
  - the regular app :443 vhost already denies the Air WebSocket path.
EOF
}

for path in \
  "$CONTROLLER_SRC" \
  "$FORCE_COMMAND_SRC" \
  "$NFT_SRC" \
  "$NGINX_SRC" \
  "$BACKHAUL_WG_SRC" \
  "$BACKHAUL_SSH_SRC"; do
  [[ -f "$path" ]] || {
    echo "missing install source: $path" >&2
    exit 1
  }
done

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

[[ -n "$EDGE_IP" ]] || {
  echo "YANDEX_VM_IP is required" >&2
  exit 1
}
[[ -n "$EDGE_SG_ID" ]] || {
  echo "ELITEEW_AIR_ENROLL_SG_ID is required" >&2
  exit 1
}
[[ -r "$CONTROL_PUBLIC_KEY" ]] || {
  echo "ELITEEW_AIR_ENROLL_SSH_PUBLIC_KEY_PATH must point to a readable public key" >&2
  exit 1
}
if ! awk 'NF >= 2 && $1 == "ssh-ed25519" && $2 ~ /^[A-Za-z0-9+\/=]+$/ { ok=1 } END { exit !ok }' \
  "$CONTROL_PUBLIC_KEY"; then
  echo "Air control key must be an OpenSSH Ed25519 public key" >&2
  exit 1
fi

if [[ -z "$EDGE_ADMIN_KEY" ]]; then
  EDGE_ADMIN_KEY="$(eliteew_resolve_admin_private "$REPO_ROOT" "$EDGE_ADMIN_USER")"
fi
[[ -r "$EDGE_ADMIN_KEY" ]] || {
  echo "canonical edge admin key is unavailable" >&2
  exit 1
}

python3 "$CONTROLLER_SRC" selftest
bash -n "$FORCE_COMMAND_SRC"

ssh_options=(
  -o BatchMode=yes
  -o ConnectTimeout=15
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=accept-new
  -i "$EDGE_ADMIN_KEY"
)

edge_host="$EDGE_IP"
if ! ssh "${ssh_options[@]}" -l "$EDGE_ADMIN_USER" "$edge_host" true 2>/dev/null; then
  edge_host="${WG_BACKHAUL_EDGE_ADMIN_HOST:-10.77.77.1}"
fi

remote_stage=".eliteew-air-enroll-install"
ssh "${ssh_options[@]}" -l "$EDGE_ADMIN_USER" "$edge_host" \
  "install -d -m 0700 '$remote_stage'"
scp "${ssh_options[@]}" \
  "$CONTROLLER_SRC" \
  "${EDGE_ADMIN_USER}@${edge_host}:${remote_stage}/eliteew_air_enroll_edge.py"
scp "${ssh_options[@]}" \
  "$FORCE_COMMAND_SRC" \
  "${EDGE_ADMIN_USER}@${edge_host}:${remote_stage}/eliteew-air-enroll-force-command"
scp "${ssh_options[@]}" \
  "$NFT_SRC" \
  "${EDGE_ADMIN_USER}@${edge_host}:${remote_stage}/eliteew-air-enroll.nft"
scp "${ssh_options[@]}" \
  "$NGINX_SRC" \
  "${EDGE_ADMIN_USER}@${edge_host}:${remote_stage}/nginx-air-enroll.conf.template"
scp "${ssh_options[@]}" \
  "$BACKHAUL_WG_SRC" \
  "${EDGE_ADMIN_USER}@${edge_host}:${remote_stage}/backhaul-wg.conf"
scp "${ssh_options[@]}" \
  "$BACKHAUL_SSH_SRC" \
  "${EDGE_ADMIN_USER}@${edge_host}:${remote_stage}/backhaul-ssh.conf"
scp "${ssh_options[@]}" \
  "$CONTROL_PUBLIC_KEY" \
  "${EDGE_ADMIN_USER}@${edge_host}:${remote_stage}/control-key.pub"

ssh "${ssh_options[@]}" -l "$EDGE_ADMIN_USER" "$edge_host" \
  sudo bash -s -- "$remote_stage" "$EDGE_SG_ID" "$EDGE_INSTANCE_ID" <<'REMOTE'
set -euo pipefail

stage="$1"
security_group_id="$2"
expected_instance_id="$3"
runtime_user="eliteew-air-enroll"
runtime_dir="/var/lib/eliteew-air-enroll"
controller_py="/usr/local/libexec/eliteew_air_enroll_edge.py"
controller="/usr/local/libexec/eliteew-air-enroll-edge"
force_command="/usr/local/libexec/eliteew-air-enroll-force-command"
nft_init="/usr/local/libexec/eliteew-air-enroll-nft-init"
nft_config="/etc/eliteew/eliteew-air-enroll.nft"
env_file="/etc/eliteew/air-enroll.env"
nginx_config="/etc/nginx/conf.d/10-eliteew-air-enroll.conf"

for command in python3 nft nginx systemctl sudo; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "required edge command is missing: $command" >&2
    exit 1
  }
done
nft_binary="$(command -v nft)"

nginx_dump="$(nginx -T 2>&1)"
if ! printf '%s\n' "$nginx_dump" |
  grep -Fq 'location = /api/v1/desktop-client/air-enroll/ws { return 404; }'; then
  echo "regular app :443 vhost does not explicitly deny the Air WebSocket path" >&2
  exit 1
fi

if [[ -r /etc/letsencrypt/live/app.eliteew.ru/fullchain.pem &&
      -r /etc/letsencrypt/live/app.eliteew.ru/privkey.pem ]]; then
  tls_cert="/etc/letsencrypt/live/app.eliteew.ru/fullchain.pem"
  tls_key="/etc/letsencrypt/live/app.eliteew.ru/privkey.pem"
elif [[ -r /etc/nginx/ssl/offline-empery/fullchain.pem &&
        -r /etc/nginx/ssl/offline-empery/privkey.pem ]]; then
  tls_cert="/etc/nginx/ssl/offline-empery/fullchain.pem"
  tls_key="/etc/nginx/ssl/offline-empery/privkey.pem"
else
  echo "app.eliteew.ru TLS certificate pair is unavailable" >&2
  exit 1
fi

backhaul_mode="$(tr -d '[:space:]' </etc/eliteew-backhaul-mode 2>/dev/null || true)"
case "$backhaul_mode" in
  wg)
    install -o root -g root -m 0644 "$stage/backhaul-wg.conf" \
      /etc/nginx/conf.d/00-eliteew-backhaul-upstreams.conf
    ;;
  ssh)
    install -o root -g root -m 0644 "$stage/backhaul-ssh.conf" \
      /etc/nginx/conf.d/00-eliteew-backhaul-upstreams.conf
    ;;
  *)
    echo "edge backhaul mode must be explicitly wg or ssh" >&2
    exit 1
    ;;
esac

if ! id "$runtime_user" >/dev/null 2>&1; then
  useradd \
    --system \
    --create-home \
    --home-dir "$runtime_dir" \
    --shell /bin/bash \
    "$runtime_user"
fi
install -d -o root -g root -m 0755 /usr/local/libexec /etc/eliteew
install -d -o "$runtime_user" -g "$runtime_user" -m 0700 \
  "$runtime_dir" "$runtime_dir/.ssh" "$runtime_dir/leases"

install -o root -g root -m 0755 \
  "$stage/eliteew_air_enroll_edge.py" "$controller_py"
install -o root -g root -m 0755 \
  "$stage/eliteew-air-enroll-force-command" "$force_command"
install -o root -g root -m 0644 \
  "$stage/eliteew-air-enroll.nft" "$nft_config"

cat >"$controller" <<EOF
#!/usr/bin/env bash
set -euo pipefail
set -a
source "$env_file"
set +a
exec /usr/bin/python3 "$controller_py" "\$@"
EOF
chmod 0755 "$controller"
chown root:root "$controller"

cat >"$nft_init" <<EOF
#!/usr/bin/env bash
set -euo pipefail
"$nft_binary" delete table inet eliteew_air_enroll 2>/dev/null || true
exec "$nft_binary" -f "$nft_config"
EOF
chmod 0755 "$nft_init"
chown root:root "$nft_init"

{
  printf 'ELITEEW_AIR_ENROLL_SG_ID=%q\n' "$security_group_id"
  printf 'ELITEEW_AIR_ENROLL_SG_NAME=%q\n' \
    "eliteew_air_enroll_security_group"
  if [[ -n "$expected_instance_id" ]]; then
    printf 'ELITEEW_AIR_ENROLL_INSTANCE_ID=%q\n' "$expected_instance_id"
  fi
  printf 'ELITEEW_AIR_ENROLL_NIC_INDEX=0\n'
  printf 'ELITEEW_AIR_ENROLL_INGRESS_PORT=39443\n'
  printf 'ELITEEW_AIR_ENROLL_STATE_DIR=%q\n' "$runtime_dir"
  printf 'ELITEEW_AIR_ENROLL_LOCK_PATH=/run/lock/eliteew-air-enroll.lock\n'
} >"$env_file"
chmod 0644 "$env_file"
chown root:root "$env_file"

key_body="$(awk 'NF >= 2 && $1 == "ssh-ed25519" { print $1 " " $2; exit }' \
  "$stage/control-key.pub")"
[[ -n "$key_body" ]] || {
  echo "validated control public key could not be read" >&2
  exit 1
}
printf '%s %s\n' \
  'from="10.77.77.2",command="/usr/local/libexec/eliteew-air-enroll-force-command",no-agent-forwarding,no-port-forwarding,no-pty,no-user-rc,no-X11-forwarding' \
  "$key_body" >"$runtime_dir/.ssh/authorized_keys"
chmod 0600 "$runtime_dir/.ssh/authorized_keys"
chown "$runtime_user:$runtime_user" "$runtime_dir/.ssh/authorized_keys"

cat >/etc/sudoers.d/eliteew-air-enroll <<'EOF'
Cmnd_Alias ELITEEW_AIR_ENROLL = /usr/local/libexec/eliteew-air-enroll-edge preflight, /usr/local/libexec/eliteew-air-enroll-edge reconcile, /usr/local/libexec/eliteew-air-enroll-edge open *, /usr/local/libexec/eliteew-air-enroll-edge close *
eliteew-air-enroll ALL=(root) NOPASSWD: ELITEEW_AIR_ENROLL
EOF
chmod 0440 /etc/sudoers.d/eliteew-air-enroll
visudo -cf /etc/sudoers.d/eliteew-air-enroll >/dev/null

python3 - "$stage/nginx-air-enroll.conf.template" "$nginx_config" \
  "$tls_cert" "$tls_key" <<'PY'
from pathlib import Path
import sys

source, target, cert, key = sys.argv[1:]
rendered = (
    Path(source)
    .read_text(encoding="utf-8")
    .replace("__ELITEEW_AIR_TLS_CERT__", cert)
    .replace("__ELITEEW_AIR_TLS_KEY__", key)
)
if "__ELITEEW_AIR_" in rendered:
    raise SystemExit("unresolved Air nginx placeholder")
Path(target).write_text(rendered, encoding="utf-8")
PY
chmod 0644 "$nginx_config"
chown root:root "$nginx_config"

if command -v ufw >/dev/null 2>&1 && ufw status | grep -Fq "Status: active"; then
  if ! ufw status | grep -Eq '^39443/tcp[[:space:]]+ALLOW'; then
    ufw allow in proto tcp to any port 39443 comment 'EliteEW Air nft-gated ingress'
  fi
fi

cat >/etc/systemd/system/eliteew-air-enroll-firewall.service <<EOF
[Unit]
Description=EliteEW Air enrollment nftables fail-closed gate
Before=nginx.service
After=network-pre.target

[Service]
Type=oneshot
ExecStart=$nft_init
RemainAfterExit=yes
User=root
Group=root
NoNewPrivileges=true
CapabilityBoundingSet=CAP_NET_ADMIN
AmbientCapabilities=CAP_NET_ADMIN
ProtectHome=true
ProtectSystem=strict
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_UNIX AF_NETLINK AF_INET AF_INET6
LockPersonality=true
MemoryDenyWriteExecute=true

[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/eliteew-air-enroll-reconcile.service <<EOF
[Unit]
Description=Reconcile EliteEW Air enrollment edge leases
After=network-online.target nginx.service eliteew-air-enroll-firewall.service
Wants=network-online.target
Requires=eliteew-air-enroll-firewall.service

[Service]
Type=oneshot
ExecStart=$controller reconcile
User=root
Group=root
NoNewPrivileges=true
CapabilityBoundingSet=CAP_NET_ADMIN
AmbientCapabilities=CAP_NET_ADMIN
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=$runtime_dir /run/lock
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_UNIX AF_NETLINK AF_INET AF_INET6
RestrictSUIDSGID=true
LockPersonality=true
MemoryDenyWriteExecute=true
EOF

cat >/etc/systemd/system/eliteew-air-enroll-reconcile.timer <<'EOF'
[Unit]
Description=Run EliteEW Air enrollment edge reconciliation

[Timer]
OnBootSec=30s
OnUnitActiveSec=30s
AccuracySec=2s
Persistent=true
Unit=eliteew-air-enroll-reconcile.service

[Install]
WantedBy=timers.target
EOF

"$controller_py" selftest
"$nft_init"
nginx -t
systemctl daemon-reload
systemctl enable eliteew-air-enroll-firewall.service
systemctl restart nginx
systemctl enable --now eliteew-air-enroll-reconcile.timer
"$controller" preflight
REMOTE

echo "Air enrollment edge foundation installed and preflight passed via ${edge_host}."
