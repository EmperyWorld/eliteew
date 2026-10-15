#!/usr/bin/env bash
# Current secure-reset acceptance entrypoint. Historical W1-W7 recipes are not
# acceptance authority for the active EmpiierOS payload profile.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

bash scripts/selftest-policy.sh
bash scripts/selftest-installer.sh
bash scripts/selftest-air-enroll-egress.sh
bash scripts/selftest-w4.sh

runtime_unit="config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-runtime.service"
bridge_socket="config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-shell-bridge.socket"
bridge_service="config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-shell-bridge.service"
rg -Fxq 'CapabilityBoundingSet=CAP_NET_ADMIN' "${runtime_unit}"
rg -Fxq 'AmbientCapabilities=CAP_NET_ADMIN' "${runtime_unit}"
! rg -q 'CAP_SYS_PTRACE|EMPIIEROS_ALLOWED_SHELL_' "${runtime_unit}"
rg -Fxq 'Environment=EMPIIEROS_ALLOWED_BRIDGE_UID=0' "${runtime_unit}"
rg -Fxq 'Environment=EMPIIEROS_ALLOWED_BRIDGE_EXE=/usr/lib/systemd/systemd-socket-proxyd' \
  "${runtime_unit}"
rg -Fxq 'SystemCallFilter=~@debug' "${runtime_unit}"
rg -Fxq 'SystemCallErrorNumber=EPERM' "${runtime_unit}"
test -x config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/sbin/empiieros-display-brightness
rg -Fxq 'ExecStart=/usr/local/sbin/empiieros-display-brightness' \
  config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-display-brightness.service
# empiieros-audio-volume (stripped ELF without in-tree source) retired → trash/
! test -e config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/sbin/empiieros-audio-volume
! test -e config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-audio-volume.service
test -x config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/sbin/empiieros-wifi-radio
rg -Fxq 'ExecStart=/usr/local/sbin/empiieros-wifi-radio' \
  config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-wifi-radio.service
test -x config/buildroot/external/board/eliteew-ts/rootfs_overlay/usr/local/sbin/empiieros-time-sync
rg -Fxq 'ExecStart=/usr/local/sbin/empiieros-time-sync' \
  config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/empiieros-time-sync.service
rg -Fxq 'ListenStream=/run/empiieros-shell/runtime.sock' "${bridge_socket}"
rg -Fxq 'SocketMode=0600' "${bridge_socket}"
rg -Fxq 'Wants=empiieros-runtime.service' "${bridge_socket}"
! rg -Fxq 'Requires=empiieros-runtime.service' "${bridge_socket}"
! rg -Fxq 'After=empiieros-runtime.service' "${bridge_socket}"
! rg -q '^Before=getty@tty1.service$' "${bridge_socket}"
rg -Fxq 'ExecStart=/usr/lib/systemd/systemd-socket-proxyd --connections-max=16 /run/empiieros/runtime.sock' \
  "${bridge_service}"
rg -Fxq 'BR2_PACKAGE_LIBSECCOMP=y' config/buildroot/fragments/10-base.frag
rg -Fxq 'BR2_PACKAGE_SYSTEMD_ANALYZE=y' config/buildroot/fragments/10-base.frag
rg -Fxq 'BR2_PACKAGE_UTIL_LINUX_RFKILL=y' \
  config/buildroot/fragments/20-network-base.frag
rg -Fxq 'BR2_PACKAGE_WEBKITGTK_SANDBOX=y' \
  config/buildroot/fragments/30-display-tauri-wayland.frag
rg -Fxq 'BR2_PACKAGE_WEBKITGTK_MULTIMEDIA=y' \
  config/buildroot/fragments/30-display-tauri-wayland.frag
rg -Fxq 'BR2_PACKAGE_GST1_PLUGINS_BAD_PLUGIN_WEBRTC=y' \
  config/buildroot/fragments/30-display-tauri-wayland.frag
rg -Fxq 'BR2_PACKAGE_GST1_PLUGINS_GOOD_PLUGIN_RTP=y' \
  config/buildroot/fragments/30-display-tauri-wayland.frag
rg -Fxq 'BR2_PACKAGE_GST1_PLUGINS_GOOD_PLUGIN_RTPMANAGER=y' \
  config/buildroot/fragments/30-display-tauri-wayland.frag
rg -Fxq 'BR2_PACKAGE_GST1_PLUGINS_BASE_PLUGIN_VIDEORATE=y' \
  config/buildroot/fragments/30-display-tauri-wayland.frag
rg -Fxq 'BR2_PACKAGE_GST1_PLUGINS_BASE_PLUGIN_VIDEOTESTSRC=y' \
  config/buildroot/fragments/30-display-tauri-wayland.frag
rg -Fxq 'BR2_PACKAGE_GST1_PLUGINS_BASE_PLUGIN_AUDIOTESTSRC=y' \
  config/buildroot/fragments/30-display-tauri-wayland.frag
rg -Fxq 'BR2_PACKAGE_GST1_PLUGINS_GOOD_PLUGIN_INTERLEAVE=y' \
  config/buildroot/fragments/30-display-tauri-wayland.frag
rg -Fxq 'BR2_PACKAGE_BUBBLEWRAP=y' \
  config/buildroot/fragments/30-display-tauri-wayland.frag
rg -Fxq 'BR2_PACKAGE_XDG_DBUS_PROXY=y' \
  config/buildroot/fragments/30-display-tauri-wayland.frag
defconfig="config/buildroot/external/configs/eliteew_ts_x86_64_defconfig"
allowlist="config/buildroot/package-allowlist"
for selected in \
  BR2_PACKAGE_LIBSECCOMP \
  BR2_PACKAGE_SYSTEMD_ANALYZE \
  BR2_PACKAGE_UTIL_LINUX_RFKILL \
  BR2_PACKAGE_WEBKITGTK_SANDBOX \
  BR2_PACKAGE_WEBKITGTK_MULTIMEDIA \
  BR2_PACKAGE_GST1_PLUGINS_BAD_PLUGIN_WEBRTC \
  BR2_PACKAGE_GST1_PLUGINS_GOOD_PLUGIN_RTP \
  BR2_PACKAGE_GST1_PLUGINS_GOOD_PLUGIN_RTPMANAGER \
  BR2_PACKAGE_GST1_PLUGINS_BASE_PLUGIN_VIDEORATE \
  BR2_PACKAGE_GST1_PLUGINS_BASE_PLUGIN_VIDEOTESTSRC \
  BR2_PACKAGE_GST1_PLUGINS_BASE_PLUGIN_AUDIOTESTSRC \
  BR2_PACKAGE_GST1_PLUGINS_GOOD_PLUGIN_INTERLEAVE \
  BR2_PACKAGE_BUBBLEWRAP \
  BR2_PACKAGE_XDG_DBUS_PROXY; do
  rg -Fxq "${selected}=y" "${defconfig}"
  rg -Fxq "${selected#BR2_PACKAGE_}" "${allowlist}"
done
rg -Fxq 'CONFIG_ATH10K=m' \
  config/buildroot/external/board/eliteew-ts/linux-wifi.fragment
rg -Fxq 'CONFIG_ATH10K_PCI=m' \
  config/buildroot/external/board/eliteew-ts/linux-wifi.fragment
! rg -q '^CONFIG_ATH10K=y$' config/buildroot/external/board/eliteew-ts/linux-wifi.fragment
rg -Fxq 'CONFIG_BRCMFMAC=m' \
  config/buildroot/external/board/eliteew-ts/linux-wifi.fragment
rg -Fxq 'CONFIG_BRCMFMAC_PCIE=y' \
  config/buildroot/external/board/eliteew-ts/linux-wifi.fragment
! rg -q '^CONFIG_BRCMFMAC_PCIE=m$' \
  config/buildroot/external/board/eliteew-ts/linux-wifi.fragment
rg -Fxq 'RequiredForOnline=yes' \
  config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/network/20-wired.network
rg -Fq 'systemd-reconfigure util-linux-reconfigure' scripts/buildroot-build.sh
rg -Fq 'webkitgtk-reconfigure' scripts/buildroot-build.sh
rg -Fq 'ENABLE_BUBBLEWRAP_SANDBOX:BOOL=ON' scripts/buildroot-build.sh
rg -Fq 'ENABLE_WEB_RTC:BOOL=ON' scripts/buildroot-build.sh
rg -Fq 'ENABLE_WEB_RTC=ON' config/buildroot/external/external.mk
rg -Fq 'WEBKITGTK_DEPENDENCIES += libnice gst1-plugins-good' \
  config/buildroot/external/external.mk
rg -Fq 'ENABLE_WEB_RTC=ON' \
  config/buildroot/patches/0004-webkitgtk-enable-webrtc.patch
rg -Fq 'WEBKITGTK_VERSION = 2.52.6' \
  config/buildroot/patches/0005-webkitgtk-2.52.6.patch
rg -Fq '179a2ea3f8f6edd4be7f31fdc55afc57bd0729f1fba648c61d4181539ac116fc' \
  config/buildroot/patches/0005-webkitgtk-2.52.6.patch
! rg -q '2.54.0' config/buildroot/patches/0005-webkitgtk-2.52.6.patch
rg -Fq 'ENABLE_MEDIA_STREAM=ON' config/buildroot/external/external.mk
rg -Fq 'USE_LIBRICE=OFF' config/buildroot/external/external.mk
rg -Fq 'ENABLE_SPEECH_SYNTHESIS=OFF' config/buildroot/external/external.mk
rg -Fq 'CONFIG_BRCMFMAC_PCIE=y' scripts/buildroot-build.sh
rg -Fq -- '--resume' scripts/buildroot-build.sh
rg -Fq 'kiosk identity still has authorized_keys' \
  config/buildroot/external/board/eliteew-ts/post-build.sh
webkit_cmake_patch="config/buildroot/patches/package-dropins/webkitgtk/0001-cmake4-empty-strequal.patch"
test -f "${webkit_cmake_patch}"
rg -Fq '"${framework}" STREQUAL "${_linked_into}"' "${webkit_cmake_patch}"
webkit_dtls_patch="config/buildroot/patches/package-dropins/webkitgtk/0002-webrtc-dtls-pem-before-sdp.patch"
test -f "${webkit_dtls_patch}"
rg -Fq 'Propagated DTLS PEM to webrtcbin' "${webkit_dtls_patch}"
rg -Fq 'Applied DTLS PEM on' "${webkit_dtls_patch}"
rg -Fq 'X509_digest' "${webkit_dtls_patch}"
rg -Fq 'sha-256' "${webkit_dtls_patch}"
rg -Fq 'custom certificates not propagated to webrtcbin' "${webkit_dtls_patch}"
! rg -q '2.54' "${webkit_dtls_patch}"
rg -Fq '0002-webrtc-dtls-pem-before-sdp' config/buildroot/external/external.mk
gst_dtls_patch="config/buildroot/patches/package-dropins/gstreamer1/gst1-plugins-bad/0001-dtlsdec-rebind-peer-cert-after-pem.patch"
test -f "${gst_dtls_patch}"
rg -Fq 'bound on-peer-certificate after create_connection' "${gst_dtls_patch}"
! rg -q '2.54' "${gst_dtls_patch}"
rg -Fq '0001-dtlsdec-rebind-peer-cert-after-pem' config/buildroot/external/external.mk
rg -F -- '--any --ipv4 --timeout=30' \
  config/buildroot/external/board/eliteew-ts/rootfs_overlay/etc/systemd/system/systemd-networkd-wait-online.service.d/10-empiieros.conf
rg -Fq "empiieros-runtime: seccomp mode=2" scripts/qemu-empiieros-smoke.sh
rg -Fq "+SECCOMP" scripts/qemu-empiieros-smoke.sh
rg -Fq "WebKit sandbox enabled" scripts/qemu-empiieros-smoke.sh
rg -Fq "Ordering cycle" scripts/qemu-empiieros-smoke.sh

bridge_fixture="$(mktemp)"
trap 'rm -f -- "${bridge_fixture}"' EXIT INT TERM
printf '%s\n' \
  'empiieros-runtime: response id=shell-1 ok=true status=observed' \
  >"${bridge_fixture}"
bash scripts/verify-runtime-bridge-log.sh "${bridge_fixture}"
printf '%s\n' \
  'empiieros-runtime: response id=shell-1 ok=true status=observed' \
  'empiieros-runtime: peer_authorization_denied pid=10 uid=105 gid=113 code=peer_executable_unavailable detail=Permission denied' \
  >"${bridge_fixture}"
if bash scripts/verify-runtime-bridge-log.sh "${bridge_fixture}" >/dev/null 2>&1; then
  echo "selftest-secure-reset: FAIL Runtime denial fixture was accepted" >&2
  exit 1
fi
echo "PASS  Runtime bridge verifier rejects authorization denial"

if [[ "${ELITEEW_TS_SECURE_RESET_QEMU:-0}" == "1" ]]; then
  bash scripts/qemu-empiieros-smoke.sh
  bash scripts/qemu-installed-system-smoke.sh
else
  echo "SKIP  QEMU direct-boot and real-install smoke (set ELITEEW_TS_SECURE_RESET_QEMU=1 after building the image)"
fi

echo "PASS  Trusted Substrate secure-reset source acceptance"
