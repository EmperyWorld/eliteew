#!/usr/bin/env bash
# Run on command-center (192.168.1.136) as user owned after golden-image install.
# Canon: documentation/platform/COMMAND-CENTER-GOLDEN-IMAGE.md
set -euo pipefail

REPO_DIR="${REPO_DIR:-<repo>}"
FORGEJO_SSH="ssh://git@130.193.43.111:2222/eliteew/powered_by_emperyworld.git"
FIRSTBOOT_LOG="/var/log/eliteew-cc-firstboot.log"
FIRSTBOOT_STAMP="/var/lib/eliteew-cc-firstboot.done"

section() { printf '\n=== %s ===\n' "$1"; }

section "host"
hostname -f 2>/dev/null || hostname
ip -4 addr show scope global | awk '/inet / {print $2, $NF}'

section "firstboot"
if [[ -f "${FIRSTBOOT_STAMP}" ]]; then
  echo "firstboot: done (${FIRSTBOOT_STAMP})"
else
  echo "firstboot: pending — waiting for eliteew-cc-firstboot.service (NVIDIA, tuned, harden)"
  if systemctl is-active --quiet eliteew-cc-firstboot.service 2>/dev/null; then
    echo "service running; tail log with: sudo tail -f ${FIRSTBOOT_LOG}"
  else
    echo "start with: sudo systemctl start eliteew-cc-firstboot.service"
  fi
fi
if [[ -r "${FIRSTBOOT_LOG}" ]]; then
  sudo tail -n 30 "${FIRSTBOOT_LOG}" 2>/dev/null || true
fi

section "SSH key (before harden locks password auth)"
if [[ -s "${HOME}/.ssh/authorized_keys" ]]; then
  echo "authorized_keys: OK ($(wc -l <"${HOME}/.ssh/authorized_keys") keys)"
else
  echo "WARN: no ~/.ssh/authorized_keys — from your workstation run:"
  echo "  ssh-copy-id owned@192.168.1.136"
  echo "Harden disables password login; add a key before sudo harden if not done yet."
fi

section "NVIDIA (5060 Ti)"
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi --query-gpu=name,driver_version --format=csv,noheader || true
else
  echo "nvidia-smi missing — run drivers+tools script (needs sudo on host):"
  CC_SCR="${REPO_DIR}/pack-organization/command-center-image/scripts"
  if [[ -f "${CC_SCR}/install-host-drivers-and-tools.sh" ]]; then
    echo "  sudo bash ${CC_SCR}/install-host-drivers-and-tools.sh"
  elif [[ -f "${HOME}/cc-setup/scripts/install-host-drivers-and-tools.sh" ]]; then
    echo "  sudo bash ${HOME}/cc-setup/scripts/install-host-drivers-and-tools.sh"
  else
    echo "  copy pack-organization/command-center-image/scripts/ to CC, then sudo bash install-host-drivers-and-tools.sh"
  fi
  systemctl is-active akmods 2>/dev/null || true
fi

section "Forgejo git (optional clone)"
mkdir -p "${HOME}/.ssh"
chmod 0700 "${HOME}/.ssh"
if [[ ! -f "${HOME}/.ssh/id_ed25519" ]]; then
  echo "Generate deploy key (no passphrase ok on CC):"
  echo "  ssh-keygen -t ed25519 -f ${HOME}/.ssh/id_ed25519 -N '' -C 'command-center'"
  echo "Add ${HOME}/.ssh/id_ed25519.pub to Forgejo → Settings → SSH keys, then:"
fi
if [[ ! -f "${HOME}/.ssh/config" ]] || ! grep -q '130.193.43.111' "${HOME}/.ssh/config" 2>/dev/null; then
  cat >>"${HOME}/.ssh/config" <<'EOF'

Host forgejo eliteew-forgejo
  HostName 130.193.43.111
  Port 2222
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
EOF
  chmod 0600 "${HOME}/.ssh/config"
  echo "Appended Forgejo stanza to ~/.ssh/config"
fi

if [[ -d "${REPO_DIR}/.git" ]]; then
  echo "monorepo: already at ${REPO_DIR}"
elif [[ "${ELITEEW_CC_CLONE:-0}" == "1" ]]; then
  git clone "${FORGEJO_SSH}" "${REPO_DIR}"
else
  echo "Clone when Forgejo key works:"
  echo "  ELITEEW_CC_CLONE=1 bash $0"
  echo "  # or: git clone ${FORGEJO_SSH} ${REPO_DIR}"
fi

if [[ -d "${REPO_DIR}/.git" ]]; then
  section "monorepo deps"
  cd "${REPO_DIR}"
  if [[ ! -x .venv/bin/python ]]; then
    echo "API venv..."
    (cd shared/api && UV_PROJECT_ENVIRONMENT=../../.venv uv sync --extra dev)
    UV_PROJECT_ENVIRONMENT=../../.venv uv pip install --index-strategy unsafe-best-match \
      -r shared/api/requirements.txt --python ../../.venv/bin/python
  else
    echo ".venv: present"
  fi
  if [[ ! -d shared/web/frontend/node_modules ]]; then
    echo "frontend pnpm install (may take a while)..."
    (cd shared/web/frontend && pnpm install)
  else
    echo "frontend node_modules: present"
  fi
  echo "Optional OS tools: sudo bash .vscode/install-os-dev-tools.sh"
  echo "Preflight: bash .vscode/preflight-check.sh"
  echo "Smoke: bash docker/scripts/eliteew-command-center.sh smoke"
fi

section "harden (from git, idempotent)"
if [[ -d "${REPO_DIR}/docker/scripts/command-center/harden-command-center-host.sh" ]]; then
  echo "When SSH key login works:"
  echo "  sudo ELITEEW_HARDEN_FORCE=1 bash ${REPO_DIR}/docker/scripts/command-center/harden-command-center-host.sh"
elif [[ -x /opt/eliteew-cc/harden-command-center-host.sh ]]; then
  echo "Bundled harden (firstboot may have run it):"
  echo "  sudo ELITEEW_HARDEN_FORCE=1 /opt/eliteew-cc/harden-command-center-host.sh"
fi

section "done"
echo "Change password if still default: passwd"
echo "Do NOT enable prod-core podman autostart on .136"
