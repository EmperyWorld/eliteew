# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---

# OTA install failed on Trusted Substrate (pkexec/rpm absent)

| Field | Value |
|-------|--------|
| **status** | `fixed` |
| **date** | `2026-09-09` |
| **product_id** | `desktop-client` |
| **also_affects** | `trusted-substrate` |
| **severity** | metal `192.168.8.10` Buildroot TS; OTA 0.5.24 verify OK, UI «права» |

## Symptom

In-app OTA downloads and verifies `0.5.24`, then fails with admin-rights style copy. Metal has no `pkexec`, `rpm`, or `dnf`.

## Failure layers

1. Elevation: `install_rpm_pkexec` only — Polkit agent / binary absent on TS kiosk.
2. Package manager: client is bake-time binary under `/usr/bin`, not an RPM DB package.
3. UX: `package_install_failed` blamed «права администратора».

## Root cause

Linux OTA assumed Fedora retail (`pkexec` + `dnf`/`rpm`) for all hosts.

## Fix

Capability branch in `updater_recovery`: retail keeps pkexec path; TS uses userspace RPM extract + `sudo -n` binary install (same layout as factory bake).

## Verification

```text
cargo test -p desktop-client rpm_payload updater_recovery
# metal: after one-time binary push of fixed client, in-app OTA to next TREE
```

## Recommendations

- Do not add Polkit to TS for OTA.
- Prefer capability probes over hostname detection.
- First uptake on already-deployed metal needs one manual/bake binary push (chicken-egg until fixed client is present).
