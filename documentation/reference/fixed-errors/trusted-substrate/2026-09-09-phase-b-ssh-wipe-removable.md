# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---

# Phase B: repair if-missing keys / wipe || true / removable wipeable

| Field | Value |
|-------|--------|
| **status** | fixed |
| **date** | 2026-09-09 |
| **product_id** | trusted-substrate |
| **also_affects** | — |
| **severity** | install SoT / OpenSSH / GUI disk pick |

## Symptom

Audit C5/C6/M1: repair kept existing host keys; apply continued after failed wipe; GUI listed second USB as install target.

## Failure layers

1. **Repair** — `if [[ ! -f ssh_host_ed25519_key ]]` left clone/stale keys.
2. **Apply** — `wipefs -a || true` / `dd || true` allowed GPT on unclean wipe.
3. **GUI** — `removable` ignored in `disk_skip_reason`.

## Root cause

Incomplete key lifecycle on repair; wipe treated as best-effort; disk allowlist omitted removable policy.

## Fix

- Repair: always `rm` + `ssh-keygen -A -f` (chroot+/dev/null fallback).
- Apply: wipefs/dd die on failure before sfdisk.
- GUI: skip removable with explicit reason (internal disks only).

## Verification

```bash
bash pack-organization/trusted-substrate/scripts/selftest-installer.sh
```

## Recommendations

Ship rebuilt `eliteew-ts-installer` via next flash/rebake for B4 on live USB; apply B3 can be stamped on live without full rebake.
