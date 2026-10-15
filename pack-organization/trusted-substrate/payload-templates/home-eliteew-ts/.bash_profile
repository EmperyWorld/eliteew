# EliteEW Trusted Substrate — tty1 session router (agetty --autologin)
# Sourced for login shells only. Product/install surfaces must not drop to a shell.
if [[ -z "${BASH_VERSION:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi
_tty="$(tty 2>/dev/null || true)"
if [[ "${_tty}" == /dev/tty1 ]] && [[ -z "${WAYLAND_DISPLAY:-}" ]] && [[ -z "${DISPLAY:-}" ]]; then
  if [[ -x /usr/local/bin/eliteew-ts-session-router ]]; then
    exec /usr/local/bin/eliteew-ts-session-router
  fi
  # Fail closed: no interactive console on tty1.
  printf '\r\neliteew-ts: missing session-router — holding tty1\n' >/dev/tty1 2>/dev/null || true
  sleep infinity
fi
