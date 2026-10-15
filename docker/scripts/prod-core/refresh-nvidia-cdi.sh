#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Refresh NVIDIA CDI so Podman GPU inject matches current /dev/dri/cardN after reboot.
# Invariants:
# - Always refreshes user CDI ($XDG_CONFIG_HOME/cdi) without sudo.
# - Optionally refreshes /etc/cdi when running as root.
# - Ensures containers.conf prefers the user CDI dir (cardN renumber resilience).
# Related:
# - documentation/platform/STACK2-LLM-CONTRACT.md (§CDI cardN)
# - docker/scripts/start-prod-core-stacks.sh (_require_cdi)
# - nvidia-cdi-refresh.service (system unit; may be disabled by harden until NVIDIA OK)
# ---
set -euo pipefail

XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-${HOME}/.config}"
USER_CDI_DIR="${ELITEEW_USER_CDI_DIR:-${XDG_CONFIG_HOME}/cdi}"
USER_CDI_FILE="${USER_CDI_DIR}/nvidia.yaml"
CONTAINERS_CONF="${XDG_CONFIG_HOME}/containers/containers.conf"
CTK="${NVIDIA_CTK_BIN:-nvidia-ctk}"

if ! command -v "${CTK}" >/dev/null 2>&1; then
  echo "ERROR: ${CTK} not found" >&2
  exit 1
fi

if ! nvidia-smi -L >/dev/null 2>&1; then
  echo "ERROR: nvidia-smi failed — driver not ready" >&2
  exit 1
fi

mkdir -p "${USER_CDI_DIR}" "${XDG_CONFIG_HOME}/containers"

echo ">>> refresh user CDI → ${USER_CDI_FILE}" >&2
"${CTK}" cdi generate --output="${USER_CDI_FILE}"

# Prefer user CDI so stale /etc/cdi/nvidia.yaml (old cardN) cannot block stack2.
if [[ ! -f "${CONTAINERS_CONF}" ]] || ! grep -q 'cdi_spec_dirs' "${CONTAINERS_CONF}" 2>/dev/null; then
  cat >"${CONTAINERS_CONF}" <<EOF
[engine]
# Prefer refreshed user CDI (cardN can renumber after reboot). System /etc/cdi may lag.
cdi_spec_dirs = ["${USER_CDI_DIR}", "/etc/cdi", "/var/run/cdi"]
EOF
elif ! grep -q "${USER_CDI_DIR}" "${CONTAINERS_CONF}" 2>/dev/null; then
  echo "WARN: ${CONTAINERS_CONF} has cdi_spec_dirs but not ${USER_CDI_DIR} — check manually" >&2
fi

if [[ "$(id -u)" -eq 0 ]]; then
  mkdir -p /etc/cdi
  echo ">>> refresh system CDI → /etc/cdi/nvidia.yaml" >&2
  "${CTK}" cdi generate --output=/etc/cdi/nvidia.yaml
fi

# Sanity: generated spec must reference an existing DRM card node.
if ! rg -q 'path: /dev/dri/card[0-9]+' "${USER_CDI_FILE}"; then
  echo "ERROR: ${USER_CDI_FILE} has no /dev/dri/cardN entry" >&2
  exit 1
fi
card_paths="$(rg -o 'path: (/dev/dri/card[0-9]+)' -r '$1' "${USER_CDI_FILE}" | sort -u)"
missing=0
while IFS= read -r p; do
  [[ -z "${p}" ]] && continue
  if [[ ! -e "${p}" ]]; then
    echo "ERROR: CDI references missing ${p}" >&2
    missing=1
  fi
done <<<"${card_paths}"
if (( missing )); then
  exit 1
fi

echo "✅ CDI refresh OK (cards: $(tr '\n' ' ' <<<"${card_paths}"))" >&2
