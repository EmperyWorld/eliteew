#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Remove exited stack4-*-stale-* leftovers from retire-before-recreate on prod-core.
# Related:
# - prod_core_deploy_retire_named_container in prod-core-deploy-lib.sh
# ---
set -euo pipefail

removed=0
while IFS= read -r name; do
  [[ -n "${name}" ]] || continue
  case "${name}" in
    stack4-*-stale-*)
      echo "INFO: removing stale container ${name}"
      podman container rm -f "${name}" >/dev/null
      removed=$((removed + 1))
      ;;
  esac
done < <(podman ps -a --format '{{.Names}}' | grep -E '^stack4-.+-stale-' || true)

if ((removed == 0)); then
  echo "INFO: no stack4-*-stale-* containers"
else
  echo "✅ removed ${removed} stale stack4 container(s)"
fi
