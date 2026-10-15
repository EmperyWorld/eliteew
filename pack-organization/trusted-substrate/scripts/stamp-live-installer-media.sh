#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Stamp live-installer flag + wipe sudoers onto a mounted live rootfs / ISO work tree.
# Factory-flashed runtime images must NOT carry these (they boot kiosk; no NOPASSWD wipe).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-}"
[[ -n "$TARGET" && -d "$TARGET" ]] || {
  echo "usage: $0 <mounted-live-rootfs>" >&2
  exit 2
}

install -D -m 0644 \
  "${ROOT}/live-media/stamp/etc/eliteew-trusted-substrate/live-installer" \
  "${TARGET}/etc/eliteew-trusted-substrate/live-installer"

install -D -m 0440 \
  "${ROOT}/live-media/stamp/etc/sudoers.d/eliteew-ts-installer" \
  "${TARGET}/etc/sudoers.d/eliteew-ts-installer"
# sudo refuses the whole drop-in dir if ownership is not root (host cp -a leak).
chown -R root:root "${TARGET}/etc/sudoers.d"
chmod 0755 "${TARGET}/etc/sudoers.d"
chmod 0440 "${TARGET}/etc/sudoers.d/"*

# Live media must not claim install complete
rm -f "${TARGET}/etc/eliteew-trusted-substrate/INSTALL-COMPLETE"

# Never carry a leftover PSK or installer network overlay onto the stick.
rm -f "${TARGET}"/etc/wpa_supplicant/wpa_supplicant-*.conf
rm -f "${TARGET}"/etc/systemd/network/10-eliteew-ts-install-*.network
rm -f "${TARGET}"/etc/systemd/network/20-eliteew-ts-install-*.network

# V2 wipe ticket: product family only. Never plant a living .ecap here.
mkdir -p "${TARGET}/opt/eliteew-ts-install"
printf '%s\n' '{"v":1,"kind":"empiieros-install-proof-v1","product_id":"eliteew-fofline"}' \
  >"${TARGET}/opt/eliteew-ts-install/install-proof.json"
chmod 0644 "${TARGET}/opt/eliteew-ts-install/install-proof.json"
rm -f "${TARGET}/opt/eliteew-ts-install/current.ecap"

# Live apply refuses wipe unless this tree exists and its index.html bundle
# contains the clock/portal copy. Copy only the files index.html names so a
# leftover assets/*.js cannot hide the current bundle.
plant_live_seat_shell() {
  local live html js css dest
  live="${TARGET}/opt/empiieros/shell"
  html="${live}/index.html"
  [[ -f "$html" && ! -L "$html" ]] || {
    echo "[stamp-live-installer] FATAL: ${html} missing; refuse stick without clock shell" >&2
    exit 1
  }
  js="$(grep -oE 'src="\./assets/[^"]+\.js"' "$html" | head -n 1 | sed 's/^src="\.\///;s/"$//')"
  css="$(grep -oE 'href="\./assets/[^"]+\.css"' "$html" | head -n 1 | sed 's/^href="\.\///;s/"$//')"
  [[ -n "$js" && -f "${live}/${js}" ]] || {
    echo "[stamp-live-installer] FATAL: shell bundle missing in ${html}" >&2
    exit 1
  }
  grep -q 'Поставить часы' "${live}/${js}" || {
    echo "[stamp-live-installer] FATAL: shell bundle lacks clock control" >&2
    exit 1
  }
  grep -qE 'Сначала поставьте часы|Установите время перед активацией' "${live}/${js}" || {
    echo "[stamp-live-installer] FATAL: shell bundle lacks clock-before-activate copy" >&2
    exit 1
  }
  dest="${TARGET}/usr/local/share/eliteew-ts-installer/seat-shell"
  rm -rf "$dest"
  install -d -m 0755 "${dest}/assets"
  install -m 0644 "$html" "${dest}/index.html"
  install -m 0644 "${live}/${js}" "${dest}/${js}"
  if [[ -n "$css" && -f "${live}/${css}" ]]; then
    install -m 0644 "${live}/${css}" "${dest}/${css}"
  fi
  if [[ -d "${live}/product-chrome" && ! -L "${live}/product-chrome" ]]; then
    cp -a "${live}/product-chrome" "${dest}/product-chrome"
  fi
  chown -R root:root "$dest"
  echo "[stamp-live-installer] planted seat-shell ${js}"
}
plant_live_seat_shell

# Apply plants this pair onto the seat and refuses wipe if it still enables NTP.
# Copy the overlay SoT, never the live /usr/local/sbin helper (that one may
# still be the old set-ntp trigger).
plant_live_time_helper() {
  local share src_bin src_unit
  share="${TARGET}/usr/local/share/eliteew-ts-installer"
  src_bin="${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/sbin/empiieros-time-sync"
  src_unit="${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-time-sync.service"
  [[ -f "$src_bin" && ! -L "$src_bin" && -f "$src_unit" && ! -L "$src_unit" ]] || {
    echo "[stamp-live-installer] FATAL: overlay time helper SoT missing" >&2
    exit 1
  }
  grep -q 'ntp_masked' "$src_bin" || {
    echo "[stamp-live-installer] FATAL: overlay time helper lacks ntp_masked" >&2
    exit 1
  }
  if grep -q 'set-ntp' "$src_bin"; then
    echo "[stamp-live-installer] FATAL: overlay time helper still enables NTP" >&2
    exit 1
  fi
  grep -q 'Do not enable timesyncd' "$src_unit" || {
    echo "[stamp-live-installer] FATAL: overlay time unit still enables timesyncd" >&2
    exit 1
  }
  install -d -m 0755 "$share"
  install -m 0755 "$src_bin" "${share}/empiieros-time-sync"
  install -m 0644 "$src_unit" "${share}/empiieros-time-sync.service"
  chown root:root "${share}/empiieros-time-sync" "${share}/empiieros-time-sync.service"
  echo "[stamp-live-installer] planted time helper ntp_masked"
}
plant_live_time_helper

# Live runner must match overlay apply (no OTA PK plant). The SoT tar
# extracted onto the seat is a different file; this is the USB apply.
unplant_live_ota_keys() {
  local share leftover
  share="${TARGET}/usr/local/share/eliteew-ts-installer"
  rm -f "${share}/artifact.pk.hex" "${share}/artifact.sk.hex"
  rm -f "${share}/empiieros-ota-plant-seat-pk.py"
  leftover="$(find "$TARGET" -xdev \( -name 'artifact.pk.hex' -o -name 'artifact.sk.hex' \) -print 2>/dev/null || true)"
  if [[ -n "$leftover" ]]; then
    echo "[stamp-live-installer] FATAL: leftover OTA key on live media:" >&2
    printf '%s\n' "$leftover" >&2
    exit 1
  fi
  echo "[stamp-live-installer] unplanted live OTA artifact keys"
}
unplant_live_ota_keys

plant_live_apply() {
  local src dest
  src="${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/bin/eliteew-ts-install-apply"
  dest="${TARGET}/usr/local/bin/eliteew-ts-install-apply"
  [[ -f "$src" && ! -L "$src" ]] || {
    echo "[stamp-live-installer] FATAL: overlay apply missing: ${src}" >&2
    exit 1
  }
  if grep -qE 'plant_seat_ota_pk|require_seat_ota_pk' "$src"; then
    echo "[stamp-live-installer] FATAL: overlay apply still plants OTA PK" >&2
    exit 1
  fi
  install -m 0755 "$src" "$dest"
  chown 0:0 "$dest"
  if grep -qE 'plant_seat_ota_pk|require_seat_ota_pk' "$dest"; then
    echo "[stamp-live-installer] FATAL: planted live apply still plants OTA PK" >&2
    exit 1
  fi
  echo "[stamp-live-installer] planted overlay apply (no OTA PK)"
}
plant_live_apply

if [[ ! -x "${TARGET}/usr/local/bin/eliteew-ts-installer" ]]; then
  echo "[stamp-live-installer] WARN: eliteew-ts-installer missing — run build-installer-from-source.sh" >&2
fi
if [[ ! -f "${TARGET}/opt/eliteew-ts-install/rootfs.tar.gz" ]]; then
  echo "[stamp-live-installer] WARN: missing ${TARGET}/opt/eliteew-ts-install/rootfs.tar.gz — commit install will fail closed" >&2
fi

echo "[stamp-live-installer] stamped live-installer + sudoers + install-proof on ${TARGET}"
