# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error: Fedora Server DVD kickstart package names / missing Xorg&WG.
# ---

# trusted-substrate — Server DVD package match failures during Anaconda

| Field | Value |
|-------|--------|
| **status** | `fixed` · historical Fedora carrier retired |
| **date** | `2026-09-07` |
| **product_id** | `trusted-substrate` |
| **symptom** | Anaconda `NonCriticalInstallationError`: no match for `fuse`, `wireguard-tools`, `@base-x`; later `gtk cannot be initialized` |
| **failure layer** | Install media package set / kickstart `%packages` vs Fedora Server DVD comps |
| **root cause** | Server DVD has `fuse3` not `fuse`; no `@base-x` group in Server comps; no `wireguard-tools`/Xorg on media; install often DVD-only so online fedora repos never satisfied the names |
| **fix** | The historical Fedora carrier used `fuse3`, explicit Xorg packages, and a bundled local package repository. The carrier is now retired. |
| **verification** | Historical evidence only; current product verification is the Buildroot image/QEMU/metal path. |
| **also_affects** | metal pilot install journey |

## Recommendations

- Do not revive distro-package assumptions in the Buildroot product image.
- If the historical carrier is inspected, treat its package findings as archive evidence, not a runnable release path.
