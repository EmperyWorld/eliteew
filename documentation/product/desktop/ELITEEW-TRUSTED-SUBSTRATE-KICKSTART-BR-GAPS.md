# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Historical Fedora W1 lessons checked against the living Buildroot SoT.
# ---

# Trusted Substrate — kickstart → Buildroot SoT gaps (2026-09-09)

**Edition / pack:** organization · `pack-organization/trusted-substrate/`  
**Historical sources:** the retired Fedora kickstart and RPM staging scripts
under `trash/`; living evidence is fixed-errors plus Buildroot fragments and
`post-build.sh`.

## Closed this wave

| Item | BR status |
|------|-----------|
| Tray `libayatana-appindicator` / `libappindicator` | **COVERED** — `bake-tauri-tray-libs-into-target.sh` + `payload-tauri-runtime.env` |
| TS-GAP-07 Air / pre-license egress | **COVERED** — Buildroot overlay `nft/prelicense.nft` + `eliteew-ts-air-enroll-resolve` + systemd wants + `post-build.sh` gate + `pack-organization/trusted-substrate/scripts/selftest-air-enroll-egress.sh`. **Live SoT 2026-09-10:** rebake+USB flash sha256 `ce32ff0cf0e042f69bae67aa9314fb2763f3acaaf98def5bd5864568aa35de69` (Desktop Client pin **0.5.31**). W2 `payload-templates` sketch remains opt-in legacy only (not Air SoT). |

## Still open (priority)

| ID | Gap | Severity | Notes |
|----|-----|----------|-------|
| TS-GAP-01 | Mesa `radeonsi` / AMD DRI | HIGH on AMD metal | Frag only iris/svga/virgl/swrast |
| TS-GAP-02 | Firmware beyond `i915` | HIGH AMD / MED other | No `LINUX_FIRMWARE_AMD*` |
| TS-GAP-05 | Capsule MIME cache (`update-mime-database`) | MED | xml in overlay; cache may omit `.ecap` |
| TS-GAP-06 | `eliteew-ts-handoff-apply-peer` | MED | Kickstart payload; BR overlay has status/tunnel only |
| TS-GAP-03 | `mesa-vulkan-drivers` | MED | Not in frag |
| TS-GAP-04 | Broad `@hardware-support` firmware | MED | Wi‑Fi/BT blobs |
| TS-GAP-08–10 | Full Xorg DDX / glx-utils / nss | LOW | Not needed for Wayland+Tauri SoT |

## Residual ops

After ayatana rebake: flash/reinstall metal; confirm `/tmp/runtime-*/eliteew-ts-app.log` has no appindicator panic.

Air pre-license: rebuild canonical `rootfs.tar.gz` so overlay lands on metal. Optional later: tear down `eliteew_ts_prelicense` after license/W-transport is up (post-activation policy switch) — not required for first Air enablement.
