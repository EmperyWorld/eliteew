#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Закрепить и защитить периметр *.eliteew.ru на punisher: resolver + hosts, закрыть LAN HTTPS,
# firewalld reject, systemd timer валидации (обнаружение подмены).
# Invariants:
# - Канон edge IP — docker/env_file/.env.yandex-tunnel; после правок — validate-empery-tunnel-security.sh.
# Related:
# - validate-empery-tunnel-security.sh, block-lan-empery-https-firewalld.sh
# - documentation/platform/docker-re_doc/EMPERY-EDGE-IP-OPERATIONS.md
# ---
set -euo pipefail

if [[ "${EUID:-}" -ne 0 ]]; then
  echo "Запустите с sudo: sudo bash $0" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPTS="$REPO_ROOT/docker/scripts/internal-sites"
EDGE_IP="${EMPERY_EDGE_IP:-}"
if [[ -z "$EDGE_IP" && -f "$REPO_ROOT/docker/env_file/.env.yandex-tunnel" ]]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/docker/env_file/.env.yandex-tunnel"
  EDGE_IP="${YANDEX_VM_IP:-}"
fi
EDGE_IP="${EDGE_IP:-93.77.165.185}"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
if [[ "$CONTAINER_RUNTIME" != "docker" && "$CONTAINER_RUNTIME" != "podman" ]]; then
  CONTAINER_RUNTIME="podman"
fi
if ! command -v "$CONTAINER_RUNTIME" >/dev/null 2>&1; then
  echo "Container runtime not found in PATH: $CONTAINER_RUNTIME" >&2
  exit 1
fi
CONTAINER_USER="${EMPERY_CONTAINER_USER:-$(stat -c '%U' "$REPO_ROOT" 2>/dev/null || echo owned)}"

DROPIN="/etc/systemd/resolved.conf.d/zz-empery-tunnel-dns.conf"
HOSTS_MARKER="# EliteEW edge tunnel (configure-host-resolver-empery-tunnel.sh)"
VALIDATE="$SCRIPTS/validate-empery-tunnel-security.sh"
GUARD_SVC="/etc/systemd/system/empery-tunnel-dns-guard.service"
GUARD_TIMER="/etc/systemd/system/empery-tunnel-dns-guard.timer"

mkdir -p /etc/systemd/resolved.conf.d

cat >"$DROPIN" <<'EOF'
# EliteEW: *.eliteew.ru только через edge VM (публичный A), не LLMNR → 192.168.1.136
[Resolve]
LLMNR=no
MulticastDNS=no
Domains=~eliteew.ru
DNS=1.1.1.1#eliteew.ru
DNS=8.8.8.8#eliteew.ru
EOF

systemctl restart systemd-resolved
resolvectl flush-caches 2>/dev/null || true

if grep -qF "$HOSTS_MARKER" /etc/hosts 2>/dev/null; then
  sed -i "/$HOSTS_MARKER/,/^$/d" /etc/hosts
fi
{
  echo ""
  echo "$HOSTS_MARKER"
  echo "$EDGE_IP app.eliteew.ru auth.eliteew.ru admin.eliteew.ru meet.eliteew.ru"
  echo ""
} >>/etc/hosts

echo "=== Останов LAN HTTPS (stack666) ==="
"${CONTAINER_RUNTIME}" stop stack666-lan-proxy-eth stack666-lan-proxy-wifi 2>/dev/null || true
if command -v runuser >/dev/null 2>&1 && command -v podman >/dev/null 2>&1; then
  runuser -u "$CONTAINER_USER" -- podman stop stack666-lan-proxy-eth stack666-lan-proxy-wifi 2>/dev/null || true
fi

echo "=== firewalld: block LAN IP :80/:443 (обход edge) ==="
bash "$SCRIPTS/block-lan-empery-https-firewalld.sh"

echo "=== systemd guard (валидация после reboot) ==="
cat >"$GUARD_SVC" <<EOF
[Unit]
Description=EliteEW validate *.eliteew.ru tunnel-only perimeter
After=network-online.target docker.service podman.service
Wants=network-online.target

[Service]
Type=oneshot
Environment=EMPERY_TUNNEL_ENV=$REPO_ROOT/docker/env_file/.env.yandex-tunnel
Environment=ELITEEW_CONTAINER_RUNTIME=$CONTAINER_RUNTIME
Environment=EMPERY_CONTAINER_USER=$CONTAINER_USER
WorkingDirectory=$REPO_ROOT
ExecStart=/bin/bash $VALIDATE

[Install]
WantedBy=multi-user.target
EOF

cp "$SCRIPTS/empery-tunnel-dns-guard.timer" "$GUARD_TIMER"
systemctl daemon-reload
systemctl enable --now empery-tunnel-dns-guard.timer

echo ""
echo "=== Проверка периметра ==="
if bash "$VALIDATE"; then
  echo ""
  echo "Готово. Таймер: systemctl list-timers empery-tunnel-dns-guard.timer"
  echo "Ручная проверка: sudo bash $VALIDATE"
else
  echo "Валидация не прошла — см. FAIL выше" >&2
  exit 1
fi
