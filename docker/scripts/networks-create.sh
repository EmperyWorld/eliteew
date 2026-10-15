#!/usr/bin/env bash
# Создание Docker-сетей для сегментации (все external).
# Выполняй из любой директории; нужны права на Docker.
# Соответствие сетей и сервисов — см. docker/SEGMENTATION.md (WireGuard из stack12 compose удалён — VPN отдельно).

set -e
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"
if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
  echo "Container runtime not found: ${CONTAINER_RUNTIME}" >&2
  exit 1
fi

create_net() {
  local name="$1"
  "${CONTAINER_RUNTIME}" network create "$name" 2>/dev/null || true
}

create_net ew_net_6211
create_net ew_net_2847
create_net ew_net_9O11   # Keycloak: буква O, не ноль
create_net ew_net_4532
create_net ew_net_7198
create_net ew_net_3365
create_net ew_net_5402
create_net ew_net_monitor  # Stack3: Prometheus, VictoriaLogs, Vector

echo "Networks ready: ew_net_6211, ew_net_2847, ew_net_9O11, ew_net_4532, ew_net_7198, ew_net_3365, ew_net_5402, ew_net_monitor"
