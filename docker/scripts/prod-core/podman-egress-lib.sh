#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared helpers for prod-core Podman egress policy (lock|allowlist|wan_open).
# Related: apply-podman-egress-lock.sh, podman-egress-monitor.sh
# ---

EGRESS_POLICY_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/eliteew"
EGRESS_POLICY_PATH="${ELITEEW_PODMAN_EGRESS_POLICY:-$EGRESS_POLICY_DIR/podman-egress-policy.json}"
# Consumed by apply-podman-egress-lock.sh (sourced); keep exported for monitor/status.
# shellcheck disable=SC2034
EGRESS_STATUS_PATH="${ELITEEW_PODMAN_EGRESS_STATUS:-${XDG_STATE_HOME:-$HOME/.local/state}/eliteew/podman-egress-status.json}"
EGRESS_DEFAULT_POLICY="${EGRESS_DEFAULT_POLICY:-}"

egress_repo_default_policy() {
  local root="${REPO_ROOT:-}"
  if [[ -z "$root" ]]; then
    root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
  fi
  echo "${root}/docker/host_conf/podman-egress/policy.default.json"
}

egress_ensure_policy() {
  mkdir -p "$(dirname "$EGRESS_POLICY_PATH")"
  if [[ ! -f "$EGRESS_POLICY_PATH" ]]; then
    local src="${EGRESS_DEFAULT_POLICY:-$(egress_repo_default_policy)}"
    if [[ -f "$src" ]]; then
      cp "$src" "$EGRESS_POLICY_PATH"
    else
      echo '{"version":1,"wan_hosts":["93.77.165.185"],"containers":{}}' >"$EGRESS_POLICY_PATH"
    fi
  fi
}

# Print mode for container name (default lock if unknown running container not in policy)
egress_mode_for() {
  local name="$1"
  python3 - "$EGRESS_POLICY_PATH" "$name" <<'PY'
import json, sys
path, name = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
mode = (data.get("containers") or {}).get(name)
print(mode or "")
PY
}

egress_set_mode() {
  local name="$1" mode="$2"
  case "$mode" in
    lock|allowlist|wan_open) ;;
    *) echo "ERROR: mode must be lock|allowlist|wan_open" >&2; return 2 ;;
  esac
  egress_ensure_policy
  python3 - "$EGRESS_POLICY_PATH" "$name" "$mode" <<'PY'
import json, sys
path, name, mode = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
data.setdefault("containers", {})[name] = mode
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")
print(f"OK: {name} -> {mode}")
PY
}

egress_list_by_mode() {
  local want="$1"
  python3 - "$EGRESS_POLICY_PATH" "$want" <<'PY'
import json, sys
path, want = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
for name, mode in sorted((data.get("containers") or {}).items()):
    if mode == want:
        print(name)
PY
}

egress_wan_hosts() {
  python3 - "$EGRESS_POLICY_PATH" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
for h in data.get("wan_hosts") or []:
    print(h)
PY
  local extra="${XDG_CONFIG_HOME:-$HOME/.config}/eliteew/podman-egress-wan-hosts.txt"
  if [[ -f "$extra" ]]; then
    grep -vE '^\s*(#|$)' "$extra" || true
  fi
}
