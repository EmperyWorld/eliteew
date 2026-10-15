# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — Trusted Substrate broken wall clock (timesyncd disabled + NTP blocked).
# ---

# Trusted Substrate — broken OS clock / wrong date

| Field | Value |
|-------|--------|
| **status** | `fixed` (overlay + post-build SoT; metal proof after rootfs rebuild) |
| **date** | `2026-09-10` |
| **product_id** | `trusted-substrate` |
| **also_affects** | `desktop-client` (taskbar clock, EBrowser policy TTL skew) |
| **symptom** | Seat date/time wrong or stuck; Desktop clock incorrect; possible auth/policy TTL failures |
| **failure layers** | systemd unit enablement; pre-license nft egress; timezone default |
| **root cause** | `systemd-timesyncd` (and networkd/resolved) present but **disabled** in Buildroot image; pre-license nft default-deny dropped **UDP/123**; `/etc/localtime` → Etc/UTC. Not a missing «time package». |
| **fix** | Enable timesyncd/networkd/resolved in overlay + post-build; allow `udp dport 123` in prelicense.nft; default TZ Europe/Moscow |
| **verification** | `bash pack-organization/trusted-substrate/scripts/selftest-air-enroll-egress.sh`; post-build NTP/timesyncd gates; metal `timedatectl` NTP synchronized + `Europe/Moscow` |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |

## Do not

- Add chrony while timesyncd is already built (dual client / kickstart-only habit).
- Patch live USB or `timedatectl set-time` as install SoT.
- Widen pre-license egress beyond UDP/123 for «time».
