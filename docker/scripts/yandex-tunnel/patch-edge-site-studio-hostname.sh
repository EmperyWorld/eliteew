#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Patch edge nginx Site Studio server_name from *.sites.eliteew.ru to
# regex {slug}-site.eliteew.ru (covered by cert *.eliteew.ru).
# Related:
# - docker/host_conf/nginx-app-https.conf
# - documentation/platform/docker-re_doc/INTERNAL-SITES-ACCESS.md
# ---
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/_ssh_defaults.sh"
eliteew_yandex_source_env "${REPO_ROOT}" || true

VM_IP="${YANDEX_VM_IP:-93.77.165.185}"
ADMIN="${YANDEX_VM_ADMIN_USER:-eliteew-edge}"
KEY="$(eliteew_resolve_admin_private "${REPO_ROOT}" || true)"
if [[ -z "${KEY}" || ! -r "${KEY}" ]]; then
  echo "ERROR: no edge admin SSH key" >&2
  exit 1
fi

REMOTE_PY=$(
  cat <<'PY'
from pathlib import Path

p = Path("/etc/nginx/sites-available/app.eliteew.ru")
text = p.read_text()
old = "server_name *.sites.eliteew.ru;"
new = r"server_name ~^(?<site_label>[a-z0-9-]+)-site\.eliteew\.ru$;"
count = text.count(old)
if count == 0:
    if new in text or "site_label" in text:
        print("already_patched")
        raise SystemExit(0)
    raise SystemExit("pattern_missing")
bak = p.with_name(p.name + ".bak-site-host")
if not bak.exists():
    bak.write_text(text)
p.write_text(text.replace(old, new))
print(f"replaced={count}")
PY
)

ssh -i "${KEY}" -o BatchMode=yes -o ConnectTimeout=12 "${ADMIN}@${VM_IP}" \
  "sudo python3 -c $(printf '%q' "${REMOTE_PY}") && sudo nginx -t && sudo systemctl reload nginx && echo RELOAD_OK"
