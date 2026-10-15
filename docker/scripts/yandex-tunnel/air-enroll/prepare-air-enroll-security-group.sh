#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Safely create/attach the dedicated Air enrollment SG without losing NIC SGs.
# ---
set -euo pipefail

readonly SG_NAME="eliteew_air_enroll_security_group"
readonly NIC_INDEX=0

apply=0
confirmed=0

usage() {
  cat <<'EOF'
Usage:
  ELITEEW_AIR_ENROLL_INSTANCE_ID=<edge-instance-id> \
    bash prepare-air-enroll-security-group.sh [--apply --yes]

Default is a read-only plan. --apply requires --yes and preserves every security
group already attached to NIC 0. This script does not grant IAM roles.

The service account attached to edge must receive, through operator-controlled
IAM, vpc.securityGroups.admin and compute.viewer on the containing folder.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)
      apply=1
      ;;
    --yes)
      confirmed=1
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 64
      ;;
  esac
  shift
done

if [[ "$apply" -eq 1 && "$confirmed" -ne 1 ]]; then
  echo "--apply requires --yes" >&2
  exit 64
fi

instance_id="${ELITEEW_AIR_ENROLL_INSTANCE_ID:-}"
configured_sg_id="${ELITEEW_AIR_ENROLL_SG_ID:-}"
[[ -n "$instance_id" ]] || {
  echo "ELITEEW_AIR_ENROLL_INSTANCE_ID is required" >&2
  exit 1
}

command -v yc >/dev/null 2>&1 || {
  echo "yc CLI is required on command-center" >&2
  exit 1
}
yc config list >/dev/null 2>&1 || {
  echo "yc CLI authentication is unavailable" >&2
  exit 1
}

instance_json="$(yc compute instance get --id "$instance_id" --format json)"
mapfile -t instance_fields < <(
  python3 -c '
import json
import sys

payload = json.load(sys.stdin)
interfaces = payload.get("network_interfaces", payload.get("networkInterfaces", []))
if not isinstance(interfaces, list) or not interfaces:
    raise SystemExit("edge instance has no NIC 0")
nic = interfaces[0]
groups = nic.get("security_group_ids", nic.get("securityGroupIds", []))
print(payload.get("folder_id", payload.get("folderId", "")))
print(nic.get("subnet_id", nic.get("subnetId", "")))
print(payload.get("service_account_id", payload.get("serviceAccountId", "")))
for group_id in groups:
    print(group_id)
' <<<"$instance_json"
)

folder_id="${instance_fields[0]:-}"
subnet_id="${instance_fields[1]:-}"
service_account_id="${instance_fields[2]:-}"
attached_groups=("${instance_fields[@]:3}")

[[ -n "$folder_id" && -n "$subnet_id" ]] || {
  echo "edge instance folder/subnet metadata is incomplete" >&2
  exit 1
}
[[ -n "$service_account_id" ]] || {
  echo "edge VM has no attached service account; fail closed" >&2
  exit 1
}

subnet_json="$(yc vpc subnet get --id "$subnet_id" --format json)"
network_id="$(
  python3 -c '
import json
import sys
payload = json.load(sys.stdin)
print(payload.get("network_id", payload.get("networkId", "")))
' <<<"$subnet_json"
)"
[[ -n "$network_id" ]] || {
  echo "could not resolve edge network id" >&2
  exit 1
}

sg_id="$configured_sg_id"
if [[ -z "$sg_id" ]]; then
  sg_id="$(
    yc vpc security-group list --folder-id "$folder_id" --format json |
      python3 -c '
import json
import sys

matches = [
    item.get("id", "")
    for item in json.load(sys.stdin)
    if item.get("name") == "eliteew_air_enroll_security_group"
]
if len(matches) > 1:
    raise SystemExit("duplicate dedicated Air security groups")
print(matches[0] if matches else "")
'
  )"
fi

if [[ -z "$sg_id" ]]; then
  if [[ "$apply" -ne 1 ]]; then
    printf 'PLAN create SG name=%s network=%s folder=%s\n' \
      "$SG_NAME" "$network_id" "$folder_id"
    printf 'PLAN attach new SG to instance=%s nic=%s preserving=%s\n' \
      "$instance_id" "$NIC_INDEX" "${attached_groups[*]:-<none>}"
    printf 'SERVICE_ACCOUNT=%s requires roles: vpc.securityGroups.admin compute.viewer\n' \
      "$service_account_id"
    exit 0
  fi
  created_json="$(
    yc vpc security-group create \
      --name "$SG_NAME" \
      --description "EliteEW one-shot Air enrollment ports; controller managed" \
      --network-id "$network_id" \
      --folder-id "$folder_id" \
      --format json
  )"
  sg_id="$(
    python3 -c 'import json,sys; print(json.load(sys.stdin).get("id", ""))' \
      <<<"$created_json"
  )"
  [[ -n "$sg_id" ]] || {
    echo "Yandex did not return the created security-group id" >&2
    exit 1
  }
fi

sg_json="$(yc vpc security-group get --id "$sg_id" --format json)"
python3 -c '
import json
import sys

expected_name, expected_network = sys.argv[1:]
payload = json.load(sys.stdin)
name = payload.get("name")
network = payload.get("network_id", payload.get("networkId"))
if name != expected_name:
    raise SystemExit("configured SG has an unexpected name")
if network != expected_network:
    raise SystemExit("configured SG belongs to another network")
' "$SG_NAME" "$network_id" <<<"$sg_json"

mapfile -t foreign_attachments < <(
  yc compute instance list --folder-id "$folder_id" --format json |
    python3 -c '
import json
import sys

sg_id, expected_instance, expected_index = sys.argv[1:]
for instance in json.load(sys.stdin):
    instance_id = instance.get("id", "")
    interfaces = instance.get(
        "network_interfaces",
        instance.get("networkInterfaces", []),
    )
    for index, interface in enumerate(interfaces):
        groups = interface.get(
            "security_group_ids",
            interface.get("securityGroupIds", []),
        )
        if (
            sg_id in groups
            and (instance_id != expected_instance or str(index) != expected_index)
        ):
            print(f"{instance_id}:{index}")
' "$sg_id" "$instance_id" "$NIC_INDEX"
)
if [[ "${#foreign_attachments[@]}" -gt 0 ]]; then
  printf 'dedicated Air SG is already attached outside canonical NIC: %s\n' \
    "${foreign_attachments[*]}" >&2
  exit 1
fi

already_attached=0
for group_id in "${attached_groups[@]}"; do
  if [[ "$group_id" == "$sg_id" ]]; then
    already_attached=1
  fi
done

if [[ "$already_attached" -eq 0 && "${#attached_groups[@]}" -ge 5 ]]; then
  echo "edge NIC already has 5 security groups; no Air SG slot" >&2
  exit 1
fi

printf 'SG=%s name=%s instance=%s nic=%s service_account=%s\n' \
  "$sg_id" "$SG_NAME" "$instance_id" "$NIC_INDEX" "$service_account_id"
printf 'Attached before: %s\n' "${attached_groups[*]:-<none>}"

if [[ "$already_attached" -eq 0 ]]; then
  if [[ "$apply" -ne 1 ]]; then
    echo "PLAN: attach dedicated SG while preserving all listed groups"
  else
    update_arguments=(
      compute instance update-network-interface
      --id "$instance_id"
      --network-interface-index "$NIC_INDEX"
    )
    for group_id in "${attached_groups[@]}" "$sg_id"; do
      update_arguments+=(--security-group-id "$group_id")
    done
    yc "${update_arguments[@]}" >/dev/null
  fi
fi

if [[ "$apply" -eq 1 ]]; then
  verify_json="$(yc compute instance get --id "$instance_id" --format json)"
  python3 -c '
import json
import sys

expected = set(sys.argv[1:])
payload = json.load(sys.stdin)
interfaces = payload.get("network_interfaces", payload.get("networkInterfaces", []))
actual = set(
    interfaces[0].get(
        "security_group_ids",
        interfaces[0].get("securityGroupIds", []),
    )
)
if actual != expected:
    raise SystemExit(f"NIC SG read-back mismatch: expected={sorted(expected)} actual={sorted(actual)}")
' "$sg_id" "${attached_groups[@]}" <<<"$verify_json"
  echo "APPLIED and verified."
fi

printf 'ELITEEW_AIR_ENROLL_SG_ID=%s\n' "$sg_id"
printf 'ELITEEW_AIR_ENROLL_INSTANCE_ID=%s\n' "$instance_id"
