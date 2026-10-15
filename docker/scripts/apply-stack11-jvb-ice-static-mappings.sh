#!/usr/bin/env bash
# Patch stack11 JVB jvb.conf: static ICE mappings for Yandex VM relay (13400/13401) + LAN/stack12.
# Needed because older docker-jitsi-meet templates ignore IP#PORT in JVB_ADVERTISE_IPS
# (still required on stable-11031 for Yandex UDP-native public mappings).
#
# Profile (JITSI_JVB_ICE_PROFILE):
#   lan    — only LAN + stack12 (+ optional Wi-Fi); skip Yandex UDP-over-TCP relay (stable on LAN/VPN).
#   yandex — only Yandex VM relay ports (internet clients; needs coturn or fixed UDP relay).
#   both   — all mappings (default; LAN clients may pick broken 158.x:13400 socat path).
#
# Run after jvb init/recreate:
#   JITSI_JVB_ICE_PROFILE=lan bash docker/scripts/apply-stack11-jvb-ice-static-mappings.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_TUNNEL="${ROOT}/docker/env_file/.env.yandex-tunnel"
ENV_STACK11="${ROOT}/docker/env_file/.env.stack11"
JVB_CONF="${ROOT}/docker/data/stack11/jvb/jvb.conf"
JVB_CUSTOM_SRC="${ROOT}/docker/scripts/stack11-jvb-custom-jvb.conf"
JVB_CUSTOM_DST="${ROOT}/docker/data/stack11/jvb/custom-jvb.conf"
CONTAINER="${STACK11_JITSI_JVB_CONTAINER:-stack11-jitsi-jvb-elite}"
CONTAINER_RUNTIME="${ELITEEW_CONTAINER_RUNTIME:-podman}"

# Host-network JVB: public colibri :19090 (cockpit :9090) + private health on 127.0.0.1:8080.
# Must live inside the writable /config volume — a :ro bind breaks cont-init `chown -R /config`.
if [[ -f "$JVB_CUSTOM_SRC" ]]; then
	mkdir -p "$(dirname "$JVB_CUSTOM_DST")"
	if cp -f "$JVB_CUSTOM_SRC" "$JVB_CUSTOM_DST" 2>/dev/null; then
		echo "Installed ${JVB_CUSTOM_DST} (colibri :19090)"
	elif "${CONTAINER_RUNTIME}" ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
		"${CONTAINER_RUNTIME}" cp "$JVB_CUSTOM_SRC" "${CONTAINER}:/config/custom-jvb.conf"
		"${CONTAINER_RUNTIME}" exec -u root "$CONTAINER" chown jvb:jitsi /config/custom-jvb.conf
		echo "Installed custom-jvb.conf via ${CONTAINER} (colibri :19090)"
	else
		echo "WARN: cannot install custom-jvb.conf (permission); start JVB once then re-run" >&2
	fi
fi

VM_IP="${YANDEX_VM_IP:-}"
if [[ -z "$VM_IP" && -f "$ENV_TUNNEL" ]]; then
	# shellcheck disable=SC1090
	source "$ENV_TUNNEL"
	VM_IP="${YANDEX_VM_IP:-}"
fi
VM_IP="${VM_IP:-}"
if [[ -z "$VM_IP" ]]; then
	echo "Задай YANDEX_VM_IP в docker/env_file/.env.yandex-tunnel (edge, сейчас 93.77.165.185)" >&2
	exit 1
fi

ICE_PROFILE="${JITSI_JVB_ICE_PROFILE:-}"
if [[ -z "$ICE_PROFILE" && -f "$ENV_STACK11" ]]; then
	# shellcheck disable=SC1090
	source "$ENV_STACK11"
	ICE_PROFILE="${JITSI_JVB_ICE_PROFILE:-both}"
fi
ICE_PROFILE="${ICE_PROFILE:-both}"
case "$ICE_PROFILE" in
lan | yandex | both) ;;
*)
	echo "Invalid JITSI_JVB_ICE_PROFILE=${ICE_PROFILE} (use lan|yandex|both)" >&2
	exit 1
	;;
esac

# Prod-core public runtime is .111; .136 is command-center (legacy default).
LAN_IP="${JITSI_JVB_LAN_IP:-192.168.1.111}"
WIFI_IP="${JITSI_JVB_WIFI_IP:-192.168.38.5}"
STACK12_GW="${JITSI_JVB_STACK12_GW:-172.29.12.1}"
UDP_LOCAL="${JITSI_JVB_UDP_BIND:-34000}"
TCP_LOCAL="${JITSI_JVB_TCP_BIND:-34001}"
UDP_PUBLIC="${YANDEX_TUNNEL_JVB_UDP_REMOTE_PORT:-13400}"
UDP_NATIVE="${JITSI_JVB_UDP_NATIVE_PORT:-${MEET_JVB_UDP_NATIVE_PORT:-}}"
TCP_PUBLIC="${YANDEX_TUNNEL_JVB_TCP_REMOTE_PORT:-13401}"
# Meet WG media face on prod-core host wg0 (preferred for yandex profile).
WG_MEDIA_IP="${MEET_EDGE_WG_CLIENT_IP:-10.77.77.2}"

if ! command -v "${CONTAINER_RUNTIME}" >/dev/null 2>&1; then
	echo "Container runtime not found: ${CONTAINER_RUNTIME}" >&2
	exit 1
fi

if ! "${CONTAINER_RUNTIME}" ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
	echo "Container ${CONTAINER} is not running." >&2
	exit 1
fi

# Override first: JITSI_JVB_LOCAL_ADDRESS. For yandex/both prefer host wg0 if present
# inside the container netns (host-network JVB). Else default-route src.
LOCAL_ADDRESS="${JITSI_JVB_LOCAL_ADDRESS:-}"
if [[ -z "$LOCAL_ADDRESS" ]]; then
	if [[ "$ICE_PROFILE" == "yandex" || "$ICE_PROFILE" == "both" ]]; then
		LOCAL_ADDRESS="$(
			"${CONTAINER_RUNTIME}" exec "$CONTAINER" sh -ec \
				"ip -4 -o addr show 2>/dev/null | awk -v ip='${WG_MEDIA_IP}' '\$0 ~ ip {print ip; exit}'" \
				2>/dev/null || true
		)"
	fi
fi
if [[ -z "$LOCAL_ADDRESS" ]]; then
	LOCAL_ADDRESS="$(
		"${CONTAINER_RUNTIME}" exec "$CONTAINER" sh -ec 'ip route get 1 2>/dev/null | awk "{for(i=1;i<=NF;i++) if(\$i==\"src\") {print \$(i+1); exit}}"' 2>/dev/null \
			|| grep -m1 'local-address' "$JVB_CONF" | sed -E 's/.*"([^"]+)".*/\1/'
	)"
fi
if [[ -z "$LOCAL_ADDRESS" ]]; then
	echo "Cannot resolve JVB LOCAL_ADDRESS" >&2
	exit 1
fi
echo "JVB ICE local-address=${LOCAL_ADDRESS} (profile=${ICE_PROFILE})"

build_mappings() {
	local blocks=()
	# LAN first so clients on Wi-Fi/LAN/VPN see 192.168.x:34000 before Yandex srflx (when profile=both).
	if [[ "$ICE_PROFILE" == "lan" || "$ICE_PROFILE" == "both" ]]; then
		blocks+=("                {
                    local-address = \"${LOCAL_ADDRESS}\"
                    public-address = \"${LAN_IP}\"
                    local-port = ${UDP_LOCAL}
                    public-port = ${UDP_LOCAL}
                    name = \"lan\"
                }")
		if [[ -n "$WIFI_IP" ]]; then
			blocks+=("                {
                    local-address = \"${LOCAL_ADDRESS}\"
                    public-address = \"${WIFI_IP}\"
                    local-port = ${UDP_LOCAL}
                    public-port = ${UDP_LOCAL}
                    name = \"wifi\"
                }")
		fi
		blocks+=("                {
                    local-address = \"${LOCAL_ADDRESS}\"
                    public-address = \"${STACK12_GW}\"
                    local-port = ${UDP_LOCAL}
                    public-port = ${UDP_LOCAL}
                    name = \"stack12-vpn\"
                }")
	fi
	if [[ "$ICE_PROFILE" == "yandex" || "$ICE_PROFILE" == "both" ]]; then
		if [[ -n "$UDP_NATIVE" && "$UDP_NATIVE" != "$UDP_PUBLIC" ]]; then
			blocks+=("                {
                    local-address = \"${LOCAL_ADDRESS}\"
                    public-address = \"${VM_IP}\"
                    local-port = ${UDP_LOCAL}
                    public-port = ${UDP_NATIVE}
                    name = \"yandex-udp-native\"
                }")
		fi
		blocks+=("                {
                    local-address = \"${LOCAL_ADDRESS}\"
                    public-address = \"${VM_IP}\"
                    local-port = ${UDP_LOCAL}
                    public-port = ${UDP_PUBLIC}
                    name = \"yandex-udp\"
                }")
		blocks+=("                {
                    local-address = \"${LOCAL_ADDRESS}\"
                    public-address = \"${VM_IP}\"
                    local-port = ${TCP_LOCAL}
                    public-port = ${TCP_PUBLIC}
                    name = \"yandex-tcp\"
                }")
	fi
	local joined=""
	local i
	for i in "${!blocks[@]}"; do
		if [[ -n "$joined" ]]; then
			joined+=","
		fi
		joined+=$'\n'"${blocks[$i]}"
	done
	cat <<EOF
            static-mappings = [
${joined}
            ]
EOF
}

MAPPINGS="$(build_mappings)"

TMP_CONF="$(mktemp)"
trap 'rm -f "$TMP_CONF"' EXIT
"${CONTAINER_RUNTIME}" exec "$CONTAINER" cat /config/jvb.conf >"$TMP_CONF"

python3 - "$TMP_CONF" "$MAPPINGS" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
mappings = sys.argv[2].rstrip() + "\n"
text = path.read_text(encoding="utf-8")
pattern = re.compile(r"static-mappings\s*=\s*\[[\s\S]*?\]\s*")
match = pattern.search(text)
if not match:
    raise SystemExit(f"static-mappings block not found in {path}")
path.write_text(text[: match.start()] + mappings + text[match.end() :], encoding="utf-8")
print(f"Patched static-mappings in {path}")
PY

"${CONTAINER_RUNTIME}" cp "$TMP_CONF" "${CONTAINER}:/config/jvb.conf"
"${CONTAINER_RUNTIME}" exec -u root "$CONTAINER" chown jvb:jitsi /config/jvb.conf

echo "Reloading JVB process (profile=${ICE_PROFILE}, LAN ${LAN_IP}, Wi-Fi ${WIFI_IP}, stack12 ${STACK12_GW})..."
"${CONTAINER_RUNTIME}" exec "$CONTAINER" s6-svc -r /var/run/s6/services/jvb
for _ in $(seq 1 30); do
	status="$("${CONTAINER_RUNTIME}" inspect "$CONTAINER" --format '{{.State.Health.Status}}' 2>/dev/null || echo starting)"
	if [[ "$status" == "healthy" ]]; then
		break
	fi
	sleep 2
done

if "${CONTAINER_RUNTIME}" logs "$CONTAINER" 2>&1 | tail -40 | grep -q 'NullPointerException'; then
	echo "WARN: NullPointerException in recent JVB logs — check harvesters" >&2
	exit 1
fi

"${CONTAINER_RUNTIME}" exec "$CONTAINER" grep -E 'name = "(yandex-udp|yandex-udp-native|lan|stack12-vpn)"' /config/jvb.conf || true
echo "Done."
