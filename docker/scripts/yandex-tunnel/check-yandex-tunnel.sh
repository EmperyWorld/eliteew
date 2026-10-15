#!/usr/bin/env bash
# Проверка доступа до VM Yandex и контейнера обратного SSH-туннеля.
# Запуск из корня репозитория: bash docker/scripts/yandex-tunnel/check-yandex-tunnel.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
YTunnel="$SCRIPT_DIR"
RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-}"
# shellcheck source=_ssh_defaults.sh
source "$YTunnel/_ssh_defaults.sh"

eliteew_yandex_source_env "$REPO_ROOT"

VM_IP="${YANDEX_VM_IP:-158.160.205.181}"
ADMIN_USER="${YANDEX_VM_ADMIN_USER:-glock}"

if [[ -z "$RUNTIME" ]]; then
  if command -v podman >/dev/null 2>&1; then
    RUNTIME="podman"
  elif command -v docker >/dev/null 2>&1; then
    RUNTIME="docker"
  fi
fi

_runtime_available() {
  [[ -n "$RUNTIME" ]] && command -v "$RUNTIME" >/dev/null 2>&1
}

_tunnel_container_running() {
  _runtime_available || return 1
  "$RUNTIME" ps --format '{{.Names}}' 2>/dev/null | grep -qx stack-yandex-tunnel
}

echo "=== Исходящий IP (разрешить в Security Group VM: TCP 22) ==="
OUTBOUND_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "не получен")
echo "$OUTBOUND_IP"
echo ""

echo "=== Доступ до VM:22 (SSH) ==="
if timeout 6 nc -zv "$VM_IP" 22 2>&1; then
  echo "OK: порт 22 доступен"
else
  echo "FAIL: таймаут или недоступен. В Yandex Cloud → VPC → Security groups разреши TCP 22 с ${OUTBOUND_IP}/32 (или по политике)"
fi
echo ""

echo "=== Прямой SSH с хоста (админ $ADMIN_USER, BatchMode) ==="
if _apk="$(eliteew_resolve_admin_private "$REPO_ROOT" "$ADMIN_USER")"; then
  echo "Ключ: $_apk"
  OUT_DIRECT=$(ssh -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -i "$_apk" -o BatchMode=yes -o ConnectTimeout=10 -l "$ADMIN_USER" "$VM_IP" "echo OK" 2>&1) || true
  if echo "$OUT_DIRECT" | grep -q "^OK$"; then
    echo "OK: вход по ключу работает"
  else
    echo "$OUT_DIRECT"
    echo "Если Permission denied: на VM в ~${ADMIN_USER}/.ssh/authorized_keys должен быть pubkey от этого ключа (setup-vm-no-ssh.sh)."
  fi
else
  echo "SKIP: не найден приватный ключ (YANDEX_VM_ADMIN_KEY_PATH, keys/, ~/.ssh/id_ed25519)"
fi
echo ""

echo "=== Контейнер туннеля ==="
if ! _runtime_available; then
  echo "SKIP: container runtime не найден (ELITEEW_CONTAINER_RUNTIME, podman или docker)"
elif "$RUNTIME" ps --filter name=stack-yandex-tunnel --format '{{.Names}} {{.Status}}' 2>/dev/null | grep -q .; then
  echo "runtime: $RUNTIME"
  "$RUNTIME" ps --filter name=stack-yandex-tunnel --format '{{.Names}} {{.Status}}'
else
  echo "(нет запущенного stack-yandex-tunnel) — поднять: bash docker/scripts/yandex-tunnel/compose-up.sh"
fi
echo ""

echo "=== Тест SSH из контейнера (ключ → VM, пользователь tunnel) ==="
if ! _tunnel_container_running; then
  echo "SKIP: контейнер stack-yandex-tunnel не запущен"
  exit 0
fi

OUT=$("$RUNTIME" exec stack-yandex-tunnel ssh -i /key -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/ssh_known_hosts -o ConnectTimeout=8 -o BatchMode=yes "tunnel@$VM_IP" "echo OK" 2>&1) || true
if echo "$OUT" | grep -q "^OK$"; then
  echo "OK: SSH с ключом работает"
elif echo "$OUT" | grep -q "account is currently not available"; then
  echo "OK: SSH с ключом работает (nologin у tunnel — норма)"
else
  echo "$OUT"
  if echo "$OUT" | grep -q "Permission denied (publickey)"; then
    echo "→ ~tunnel/.ssh/authorized_keys должен совпадать с приватным ключом, смонтированным в контейнер (compose-up.sh / YANDEX_TUNNEL_KEY_PATH)."
    echo "→ bash docker/scripts/yandex-tunnel/print-vm-oneliner.sh"
  fi
  echo "FAIL или таймаут: Security Group и authorized_keys пользователя tunnel"
fi

echo ""
echo "=== JVB media (reverse SSH, loopback на VM) ==="
if _tunnel_container_running; then
  JVB_UDP_R="${YANDEX_TUNNEL_JVB_UDP_REMOTE_PORT:-13400}"
  JVB_TCP_R="${YANDEX_TUNNEL_JVB_TCP_REMOTE_PORT:-13401}"
  OUT_MEDIA=$(ssh -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
    -i "$(eliteew_resolve_admin_private "$REPO_ROOT" "$ADMIN_USER" 2>/dev/null || echo /dev/null)" \
    -o BatchMode=yes -o ConnectTimeout=8 -l "$ADMIN_USER" "$VM_IP" \
    "ss -lun | grep -E ':${JVB_UDP_R}\\s' || true; ss -lnt | grep -E ':${JVB_TCP_R}\\s' || true; printf 'legacy_relay=%s\n' \"\$(systemctl is-active eliteew-jvb-media-relay.service 2>/dev/null || true)\"; printf 'udp_wg_relay=%s\n' \"\$(systemctl is-active eliteew-jvb-media-relay-udp-wg.service 2>/dev/null || true)\"" 2>&1) || true
  if [[ -n "${OUT_MEDIA:-}" ]]; then
    echo "$OUT_MEDIA"
  fi
  if echo "$OUT_MEDIA" | grep -qE ":${JVB_UDP_R}[[:space:]]"; then
    echo "OK: публичный UDP ${JVB_UDP_R} слушает на edge (prod media path может быть udp-wg)."
  elif echo "$OUT_MEDIA" | grep -q "udp_wg_relay=active"; then
    echo "OK: eliteew-jvb-media-relay-udp-wg active."
  else
    echo "→ На VM: bash docker/scripts/yandex-tunnel/deploy-jvb-media-relay-udp-wg-on-vm.sh"
    echo "→ Security group: inbound UDP ${JVB_UDP_R}; TCP ${JVB_TCP_R} нужен только legacy fallback"
  fi
else
  echo "SKIP: stack-yandex-tunnel не запущен"
fi

echo ""
echo "=== Edge loopback 29173/29180 (residual vs living OTA) ==="
if _apk="$(eliteew_resolve_admin_private "$REPO_ROOT" "$ADMIN_USER" 2>/dev/null || true)"; then
  OUT_PORTS=$(ssh -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
    -i "$_apk" -o BatchMode=yes -o ConnectTimeout=8 -l "$ADMIN_USER" "$VM_IP" \
    "ss -lnt | grep -E ':29173|:29180' || true" 2>&1) || true
  if [[ -n "${OUT_PORTS:-}" ]]; then
    echo "$OUT_PORTS"
  fi
  if echo "$OUT_PORTS" | grep -q ':29180'; then
    echo "OK: edge :29180 listening (living path = Meet WG → prod-core local Mobile OTA :29180)"
    echo "NOTE: SSH reverse 29180→.136:4180 in stack-yandex-tunnel.yml is DEWA legacy reserve — do not treat as OTA canon"
  else
    echo "→ Living OTA: ensure WG/proxy 29180→127.0.0.1:29180 on prod-core (stack-mobile-release); not DEWA :4180"
  fi
  if echo "$OUT_PORTS" | grep -q ':29173'; then
    echo "NOTE: :29173 is residual EWPower/DEWA-era edge debt (wontfix) — not an acceptance gate"
  fi
else
  echo "SKIP: admin SSH key not found"
fi

echo ""
echo "=== Meet (HTTPS с внешним DNS, без hosts на punisher) ==="
MEET_IP=$(dig @8.8.8.8 +short meet.eliteew.ru A 2>/dev/null | head -1 || true)
if [[ -z "${MEET_IP:-}" ]]; then
  echo "SKIP: dig meet.eliteew.ru @8.8.8.8 не вернул A"
else
  echo "meet.eliteew.ru A (8.8.8.8) → $MEET_IP"
  if CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 --resolve "meet.eliteew.ru:443:${MEET_IP}" "https://meet.eliteew.ru/" 2>/dev/null); then
    echo "curl https://meet.eliteew.ru/ (через --resolve) → HTTP $CODE (ожидается 200 или 403 от JWT-gate без jwt)"
  else
    echo "FAIL: curl meet (проверь nginx на VM и туннель -R 13402)"
  fi
fi
