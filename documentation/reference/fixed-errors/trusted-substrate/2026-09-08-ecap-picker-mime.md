# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — Capsule .ecap hidden in OS file picker on labwc/portal.
# ---

# .ecap hidden in file chooser (portal / octet-stream)

| Field | Value |
|-------|--------|
| **product_id** | `trusted-substrate` |
| **status** | `fixed` |
| **date** | `2026-09-08` |
| **also_affects** | `desktop_client` (connection-agent picker) |
| **canon** | `documentation/product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md` |
| **commit** | `e3a68d10e` |

## Symptom

Activation file picker does not list `*.ecap` (JSON correctly rejected). Capsule files exist on disk with readable permissions.

## Failure layers

1. GIO content-type for unregistered `*.ecap` → `application/octet-stream`
2. xdg-desktop-portal + rfd extension filter hides non-matching MIME
3. Kiosk did not force native GTK chooser (`GTK_USE_PORTAL`)

## Root cause

Unregistered Capsule extension treated as anonymous binary; portal filter path hid files — not chmod/SELinux.

## What we did

- MIME package `application/vnd.eliteew.capsule` → `*.ecap` (Buildroot overlay runs `update-mime-database`)
- Kiosk `GTK_USE_PORTAL=0` (native GTK pattern filter)
- connection-agent: start picker in `~/EliteEW/Import`; do not rely solely on portal MIME filter (validate EECAP3 after pick)

## Recommendations

- Do not ship retail “accept open JSON as capsule”
- Keep MIME + `GTK_USE_PORTAL=0` on substrate; client rebuild still needed for Import-default / filter-less pick on metal RPM

## Verification

```text
gio/python content-type on metal → application/vnd.eliteew.capsule
client environ GTK_USE_PORTAL=0
bash pack-organization/trusted-substrate/scripts/selftest-installer.sh → pass (MIME + GTK asserts)
```

## Residual risk

Installed Desktop Client RPM on metal may still use old rfd filter until next client bake; MIME + native GTK is the live mitigation.
