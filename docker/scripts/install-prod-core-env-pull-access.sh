#!/usr/bin/env bash
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# One-time: allow prod-core (.111) SSH pull of env bundle from command-center (.136).
# - firewalld rich rule: .111 → ssh
# - prod-core ed25519 key → authorized_keys on .136 (run pull half from .136)
# Related:
# - documentation/platform/PROD-CORE-CONFIG-PLANE.md
# ---
set -euo pipefail

PROD_CORE_IP="${PROD_CORE_IP:-192.168.1.111}"
COMMAND_CENTER_IP="${COMMAND_CENTER_IP:-192.168.1.136}"
ZONE="${FIREWALLD_ZONE:-FedoraServer}"
PROD_CORE_SSH="${PROD_CORE_SSH:-prod-core}"

echo "=== Step 1/3: firewalld on command-center (ssh from ${PROD_CORE_IP}) ==="
if command -v firewall-cmd >/dev/null 2>&1; then
  rule="rule family=ipv4 source address=${PROD_CORE_IP}/32 service name=ssh accept"
  firewall-cmd --permanent --zone="${ZONE}" --add-rich-rule="${rule}" 2>/dev/null || \
    firewall-cmd --permanent --zone="${ZONE}" --add-rich-rule="${rule}"
  firewall-cmd --reload
  echo "[ok] firewalld ssh from ${PROD_CORE_IP}"
else
  echo "WARN: firewall-cmd not found; open tcp/22 from ${PROD_CORE_IP} manually" >&2
fi

echo "=== Step 2/3: SSH key on prod-core (if missing) ==="
ssh -o BatchMode=yes "${PROD_CORE_SSH}" bash -s -- "${COMMAND_CENTER_IP}" <<'REMOTE'
set -euo pipefail
CC_IP="$1"
mkdir -p ~/.ssh
chmod 700 ~/.ssh
if [[ ! -f ~/.ssh/id_ed25519 ]]; then
  ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -C "prod-core-env-pull"
fi
if ! grep -q "Host command-center" ~/.ssh/config 2>/dev/null; then
  cat >>~/.ssh/config <<EOF

Host command-center
    HostName ${CC_IP}
    User owned
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
EOF
  chmod 600 ~/.ssh/config
fi
ssh-keyscan -H "${CC_IP}" >>~/.ssh/known_hosts 2>/dev/null || true
cat ~/.ssh/id_ed25519.pub
REMOTE

echo "=== Step 3/3: authorize prod-core pubkey on command-center ==="
PUBKEY="$(ssh -o BatchMode=yes "${PROD_CORE_SSH}" cat ~/.ssh/id_ed25519.pub)"
if grep -qF "${PUBKEY}" ~/.ssh/authorized_keys 2>/dev/null; then
  echo "[ok] pubkey already in authorized_keys"
else
  echo "${PUBKEY}" >>~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  echo "[ok] pubkey appended to authorized_keys"
fi

echo "=== smoke: prod-core → command-center ==="
ssh -o BatchMode=yes "${PROD_CORE_SSH}" ssh -o BatchMode=yes command-center hostname
echo "✅ prod-core env-pull SSH access ready"
