#!/usr/bin/env bash
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Narrow selftest for Trusted Substrate Air pre-license egress overlay artifacts
# and global-IP filter contract (no live nft mutation required).
# Related:
# - documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md §7
# ---
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OV="${ROOT}/config/buildroot/external/board/eliteew-ts/rootfs_overlay"
RESOLVE="${OV}/usr/local/sbin/eliteew-ts-air-enroll-resolve"
NFT="${OV}/etc/eliteew-trusted-substrate/nft/prelicense.nft"
APPLY="${OV}/usr/local/sbin/eliteew-ts-prelicense-nft-apply"

die() { printf 'selftest-air-enroll-egress: FAIL %s\n' "$*" >&2; exit 1; }
ok() { printf 'selftest-air-enroll-egress: OK %s\n' "$*"; }

[[ -x "${RESOLVE}" ]] || die "resolve script not executable"
[[ -x "${APPLY}" ]] || die "apply script not executable"
[[ -f "${NFT}" ]] || die "missing prelicense.nft"
rg -q '62200-63200' "${NFT}" || die "nft missing air port range"
rg -q 'udp dport 123' "${NFT}" && die "nft must not allow public NTP udp/123"
rg -q 'udp sport 67 udp dport 68 accept' "${NFT}" || die "nft must accept DHCP replies on input"
rg -q 'air_enroll_dst4' "${NFT}" || die "nft missing v4 set"
rg -qF 'tcp dport { 80, 443 } ip daddr 10.88.89.1 accept' "${NFT}" \
  || die "nft missing portal VIP HTTP(S)"
rg -qF 'tcp dport 443 accept' "${NFT}" && die "tcp/443 must stay VIP-only"
rg -q 'app\.eliteew\.ru' "${RESOLVE}" || die "resolve host not baked"
rg -q 'HOST="app.eliteew.ru"' "${RESOLVE}" || die "resolve host overrideable unexpectedly"
! rg -q 'ELITEEW_TS_AIR_HOST' "${RESOLVE}" || die "caller host override must not exist"

# shellcheck source=/dev/null
# Extract filter helpers by sourcing a trimmed fragment via bash functions copy.
is_global_ipv4() {
  set -- $(printf '%s' "$1" | tr '.' ' ')
  [ "$#" -eq 4 ] || return 1
  a=$1; b=$2; c=$3; d=$4
  case "$a$b$c$d" in *[!0-9]*) return 1 ;; esac
  [ "$a" -le 255 ] && [ "$b" -le 255 ] && [ "$c" -le 255 ] && [ "$d" -le 255 ] || return 1
  [ "$a" -eq 0 ] && return 1
  [ "$a" -eq 127 ] && return 1
  [ "$a" -eq 10 ] && return 1
  [ "$a" -eq 192 ] && [ "$b" -eq 168 ] && return 1
  [ "$a" -eq 169 ] && [ "$b" -eq 254 ] && return 1
  [ "$a" -eq 100 ] && [ "$b" -ge 64 ] && [ "$b" -le 127 ] && return 1
  [ "$a" -eq 172 ] && [ "$b" -ge 16 ] && [ "$b" -le 31 ] && return 1
  [ "$a" -ge 224 ] && return 1
  return 0
}

is_global_ipv6() {
  addr=$(printf '%s' "$1" | tr 'A-F' 'a-f')
  case "$addr" in
    ::|::1|0:0:0:0:0:0:0:0|0:0:0:0:0:0:0:1) return 1 ;;
    fe[89ab]*) return 1 ;;
    f[cd]*) return 1 ;;
    ff*) return 1 ;;
    *) return 0 ;;
  esac
}

is_global_ipv4 8.8.8.8 || die "public v4 rejected"
is_global_ipv4 127.0.0.1 && die "loopback v4 accepted"
is_global_ipv4 10.1.2.3 && die "rfc1918 v4 accepted"
is_global_ipv4 192.168.1.1 && die "rfc1918 v4 accepted"
is_global_ipv4 169.254.1.1 && die "link-local v4 accepted"
is_global_ipv4 172.16.0.1 && die "rfc1918 v4 accepted"
is_global_ipv4 224.0.0.1 && die "multicast v4 accepted"
is_global_ipv6 2001:db8::1 || die "public v6 rejected"
is_global_ipv6 ::1 && die "loopback v6 accepted"
is_global_ipv6 fe80::1 && die "link-local v6 accepted"
is_global_ipv6 fd12::1 && die "ula v6 accepted"
is_global_ipv6 ff02::1 && die "multicast v6 accepted"

[[ -L "${OV}/etc/systemd/system/multi-user.target.wants/eliteew-ts-prelicense-nft.service" ]] \
  || die "prelicense service not wanted by multi-user"
[[ -L "${OV}/etc/systemd/system/timers.target.wants/eliteew-ts-air-enroll-resolve.timer" ]] \
  || die "resolve timer not wanted by timers.target"
[[ -L "${OV}/etc/systemd/system/systemd-timesyncd.service" ]] \
  && [[ "$(readlink "${OV}/etc/systemd/system/systemd-timesyncd.service")" == /dev/null ]] \
  || die "systemd-timesyncd must be masked"
[[ -e "${OV}/etc/systemd/system/sysinit.target.wants/systemd-timesyncd.service" ]] \
  && die "systemd-timesyncd must not be wanted by sysinit"
[[ -f "${OV}/etc/systemd/timesyncd.conf.d/00-no-public-ntp.conf" ]] \
  || die "missing timesyncd no-public-ntp drop-in"
[[ -L "${OV}/etc/systemd/system/multi-user.target.wants/systemd-networkd.service" ]] \
  || die "systemd-networkd not wanted by multi-user"
[[ -L "${OV}/etc/systemd/system/multi-user.target.wants/systemd-resolved.service" ]] \
  || die "systemd-resolved not wanted by multi-user"
[[ -L "${OV}/etc/localtime" ]] || die "missing /etc/localtime symlink"
readlink "${OV}/etc/localtime" | rg -q 'Europe/Moscow' || die "localtime must be Europe/Moscow"
rg -qx 'Europe/Moscow' "${OV}/etc/timezone" || die "timezone file must be Europe/Moscow"

# payload-templates must not be the install SoT for this policy
if [[ -f "${ROOT}/payload-templates/etc-nftables/eliteew-ts-egress.nft" ]]; then
  if rg -q '62200-63200' "${ROOT}/payload-templates/etc-nftables/eliteew-ts-egress.nft"; then
    die "air ports must not live only in payload-templates sketch"
  fi
fi

ok "overlay+filter"
