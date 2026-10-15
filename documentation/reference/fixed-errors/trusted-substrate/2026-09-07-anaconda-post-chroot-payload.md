# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error: chrooted kickstart %post cannot see eliteew-ts-payload on media.
# ---

# trusted-substrate — Anaconda %post empty /run/install/repo

| Field | Value |
|-------|--------|
| **status** | `fixed` · historical Fedora carrier retired |
| **date** | `2026-09-07` |
| **product_id** | `trusted-substrate` |
| **symptom** | `ScriptError`: `ERROR: eliteew-ts-payload not found on install media` + `ls /run/install/repo` → `total 0` |
| **failure layer** | Kickstart `%post` environment / Anaconda install-media mount boundary |
| **root cause** | Chrooted `%post` does not expose ISO content at `/run/install/repo`; directory may exist empty. Payload is on media (`/eliteew-ts-payload`) and is readable during package install / installer env only. |
| **fix** | `%post --nochroot` copies from `/run/install/repo/eliteew-ts-payload` (and mount-* fallbacks) into `/mnt/sysimage/...`; require `PAYLOAD_MARKER.txt`; enable units with `systemctl --root=` |
| **verification** | Historical evidence only; current product verification is the Buildroot image/QEMU/metal path. |
| **also_affects** | `pack-organization/kiosk-fedora-iso` uses the same chrooted pattern (out of this wave scope unless expanded) |

## Recommendations

- Do not carry Anaconda chroot assumptions into Buildroot post-build or installer code.
- Detect payload by `PAYLOAD_MARKER.txt`, not only `-d` on a possibly empty stub.
