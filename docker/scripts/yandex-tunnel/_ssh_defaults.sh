# shellcheck shell=bash
# Резолв SSH-ключей для Yandex VM / туннеля. Source из других скриптов в этой папке.
# Приоритет: явный путь в env → keys/<имя> в корне репозитория → $HOME/.ssh/id_ed25519 → id_rsa

eliteew_yandex_source_env() {
  local rr="$1"
  local _e
  local _lib="${BASH_SOURCE[0]%/*}/../prod-core-env-lib.sh"
  if [[ -f "${_lib}" ]]; then
    # shellcheck source=/dev/null
    source "${_lib}"
    _e="$(prod_core_env_file_path "${rr}" .env.yandex-tunnel)"
    if [[ -f "${_e}" ]]; then
      set -a
      # shellcheck source=/dev/null
      source "${_e}"
      set +a
      return 0
    fi
  fi
  for _e in "$rr/docker/env_file/.env.yandex-tunnel" "$rr/docker/env_file/.env.yandex-tunnel.local"; do
    if [[ -f "$_e" ]]; then
      set -a
      # shellcheck source=/dev/null
      source "$_e"
      set +a
      return 0
    fi
  done
  return 0
}

eliteew_default_ssh_private() {
  local f
  for f in "${HOME}/.ssh/id_ed25519" "${HOME}/.ssh/id_rsa"; do
    if [[ -r "$f" ]]; then
      printf '%s' "$f"
      return 0
    fi
  done
  return 1
}

# Публичная часть: рядом .pub или ssh-keygen -y
eliteew_pubkey_for_private() {
  local priv="$1"
  if [[ ! -r "$priv" ]]; then
    return 1
  fi
  if [[ -f "${priv}.pub" ]]; then
    cat "${priv}.pub"
    return 0
  fi
  if command -v ssh-keygen >/dev/null 2>&1; then
    ssh-keygen -y -f "$priv" 2>/dev/null
    return 0
  fi
  return 1
}

# Приватный ключ админа edge VM (по умолчанию eliteew-edge + ~/.ssh, не keys/glock_key).
eliteew_resolve_admin_private() {
  local rr="$1"
  local admin="${2:-${YANDEX_VM_ADMIN_USER:-eliteew-edge}}"
  local p

  if [[ -n "${YANDEX_VM_ADMIN_KEY_PATH:-}" && -r "${YANDEX_VM_ADMIN_KEY_PATH}" ]]; then
    printf '%s' "${YANDEX_VM_ADMIN_KEY_PATH}"
    return 0
  fi
  for p in \
    "${HOME}/.ssh/sgbot-deploy/ssh-key-sg-bot" \
    "${HOME}/.ssh/id_ed25519" \
    "${HOME}/.ssh/.ssh/id_ed25519" \
    "$rr/keys/${admin}_key" \
    "$rr/keys/eliteew-edge_key" \
    "$rr/keys/gateway_alive_key"; do
    if [[ -r "$p" ]]; then
      printf '%s' "$p"
      return 0
    fi
  done
  if p="$(eliteew_default_ssh_private)"; then
    printf '%s' "$p"
    return 0
  fi
  return 1
}

# Приватный ключ пользователя tunnel (обратный SSH); часто тот же, что и админский.
eliteew_resolve_tunnel_private() {
  local rr="$1"
  local p

  if [[ -n "${YANDEX_TUNNEL_KEY_PATH:-}" && -r "${YANDEX_TUNNEL_KEY_PATH}" ]]; then
    printf '%s' "${YANDEX_TUNNEL_KEY_PATH}"
    return 0
  fi
  for p in "$rr/keys/yandex_tunnel_key" "$rr/keys/${YANDEX_VM_ADMIN_USER:-eliteew-edge}_key" "$rr/keys/gateway_alive_key"; do
    if [[ -r "$p" ]]; then
      printf '%s' "$p"
      return 0
    fi
  done
  if p="$(eliteew_resolve_admin_private "$rr" "${YANDEX_VM_ADMIN_USER:-eliteew-edge}")"; then
    printf '%s' "$p"
    return 0
  fi
  return 1
}
