# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-errors — Trusted Substrate AMD metal: GPU software path, silent audio, RU XKB, tty policy supersession.
# ---

# Trusted Substrate — AMD GPU lag / silent audio / no RU

| Field | Value |
|-------|--------|
| **status** | `fixed` (Buildroot SoT overlay + fragments + post-build gates; metal proof after rootfs rebuild/flash) |
| **date** | `2026-09-10` |
| **product_id** | `trusted-substrate` |
| **also_affects** | `desktop-client` (WebKit sticky compositing-off; EBrowser stage bounds under labwc) |
| **symptom** | AMD laptop: slow/pixman UI, no sound, no RU keyboard; EBrowser/Meet stages fullscreened |
| **failure layers** | kernel config (AMDGPU/HDA codecs off); Mesa without radeonsi; kiosk forced pixman; users.table missing audio; labwc ToggleFullscreen on `identifier=*` |
| **root cause** | Image baked for Intel/simpledrm path only; kiosk always set `WLR_RENDERER=pixman`; HDA codecs disabled so cards empty |
| **fix** | `linux-gpu-audio.fragment` + Mesa radeonsi/LLVM + amdgpu firmware + aplay; kiosk `choose_wlr_renderer` / XKB us,ru / clear WebKit sticky; title-scoped fullscreen; `audio` group; post-build fail-closed |
| **verification** | `bash pack-organization/trusted-substrate/scripts/selftest-installer.sh`; metal: `lsmod\|rg amdgpu`, `aplay -l`, Alt+Shift RU |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |

**Policy supersession (2026-09-27):** the public production image again masks
tty2–6. The earlier tty2 unmask fixed a documentation/product mismatch at that
time; current break-glass access requires a separate signed maintenance profile.
GPU, audio, XKB, and window-scope fixes remain unchanged.

## Do not

- Live-patch kernel/firmware onto metal as install SoT.
- Force pixman when a real DRM GPU driver is bound.
- ToggleFullscreen every toplevel (`identifier=*`) — breaks parented stages.
- Enable any tty maintenance console in the public image; use the signed
  maintenance profile instead.
