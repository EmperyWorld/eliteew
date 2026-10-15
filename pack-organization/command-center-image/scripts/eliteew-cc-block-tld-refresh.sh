#!/usr/bin/env bash
# Resolve mirror/host IPs for blocked TLD zones (e.g. .ua) → /var/lib/eliteew-cc-block-tld-ips
set -euo pipefail

BLOCKED_ZONES="${ELITEEW_BLOCKED_TLD_ZONES:-/etc/eliteew/blocked-tld-zones.txt}"
OUT="/var/lib/eliteew-cc-block-tld-ips"
OUT_HOSTS="/var/lib/eliteew-cc-block-tld-hosts"
TMP="$(mktemp)"
TMP_HOSTS="$(mktemp)"
METALINKS=(
  "https://mirrors.fedoraproject.org/metalink?repo=fedora-44&arch=x86_64"
  "https://mirrors.fedoraproject.org/metalink?repo=updates-released-f44&arch=x86_64"
  "https://mirrors.rpmfusion.org/metalink?repo=free-fedora-44&arch=x86_64"
  "https://mirrors.rpmfusion.org/metalink?repo=nonfree-fedora-44&arch=x86_64"
)

log() { printf '[eliteew-block-tld] %s\n' "$*"; }

read_zones() {
  local z
  while IFS= read -r z || [[ -n "${z}" ]]; do
    z="${z%%#*}"
    z="$(echo "${z}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
    [[ -z "${z}" ]] && continue
    z="${z#.}"
    printf '%s\n' "${z}"
  done <"${BLOCKED_ZONES}"
}

host_matches_zone() {
  local host="$1"
  local z="$2"
  host="${host,,}"
  [[ "${host}" == *".${z}" ]] || [[ "${host}" == "${z}" ]]
}

extract_hosts_from_metalink() {
  local url="$1"
  local xml zones z host
  mapfile -t zones < <(read_zones)
  [[ ${#zones[@]} -gt 0 ]] || return 0
  xml="$(curl -fsSL --max-time 12 "${url}" 2>/dev/null)" || return 0
  python3 - "${xml}" "${zones[@]}" <<'PY'
import re, sys

xml = sys.argv[1]
zones = sys.argv[2:]
hosts: set[str] = set()
for m in re.finditer(r"<url[^>]*>([^<]+)</url>", xml, re.I):
    u = m.group(1).strip()
    m2 = re.match(r"https?://([^/:]+)", u)
    if not m2:
        continue
    h = m2.group(1).lower()
    for z in zones:
        if h == z or h.endswith("." + z):
            hosts.add(h)
            break
# Do not block MirrorManager location="UA" entries: hostnames are often .net/.org
# and resolve to shared mirror IPs (false positives break dnf).
for h in sorted(hosts):
    print(h)
PY
}

resolve_host() {
  local host="$1"
  getent ahostsv4 "${host}" 2>/dev/null | awk '{print $1}' | sort -u
}

main() {
  [[ -f "${BLOCKED_ZONES}" ]] || {
    log "no ${BLOCKED_ZONES} — skip"
    exit 0
  }
  : >"${TMP}"
  local url host ip
  for url in "${METALINKS[@]}"; do
    while IFS= read -r host; do
      [[ -z "${host}" ]] && continue
      printf '%s\n' "${host}" >>"${TMP_HOSTS}"
      resolve_host "${host}" >>"${TMP}" || true
    done < <(extract_hosts_from_metalink "${url}")
  done
  sort -u "${TMP_HOSTS}" >"${OUT_HOSTS}" || : >"${OUT_HOSTS}"
  sort -u "${TMP}" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' >"${OUT}" || : >"${OUT}"
  rm -f "${TMP}" "${TMP_HOSTS}"
  log "blocked .ua hostnames: $(wc -l <"${OUT_HOSTS}") → ${OUT_HOSTS}"
  log "blocked egress IPs: $(wc -l <"${OUT}") → ${OUT}"
}

main "$@"
