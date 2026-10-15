# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fixed-error — reboot loses entitlement (keyring corrupted by WG peer INI).
# ---

# reboot entitlement unseal fail (keyring WG INI)

| Field | Value |
|-------|--------|
| **product_id** | `trusted-substrate` |
| **status** | `fixed` |
| **date** | `2026-09-08` |
| **also_affects** | `desktop_client` |
| **canon** | `documentation/product/desktop/ELITEEW-TRUSTED-SUBSTRATE.md` |
| **readiness** | `documentation/reference/solution-readiness/README.md` (registry retired) |
| **commit** | `e3a68d10e` |

## Symptom

After reboot, launcher asks for access file again: `store_error` / `entitlement_unseal_fail`.

## Failure layers

1. `capsule_store::store_peer_conf` wrote raw WireGuard INI (`[Interface]`/`[Peer]`) into gnome-keyring text `login.keyring`
2. On next boot daemon: `keyring was in an invalid or unrecognized format`
3. `eliteew-ts-secrets-up` fell back to new `login_1.keyring` with a **new** seal KEK
4. Existing `entitlement/v1.sealed` could not AEAD-unseal → `store_error`

## Root cause

Gnome-keyring file format treats lines starting with `[` as sections; storing multiline WG conf as a secret corrupts `login.keyring`.

## What we did

- Live metal: repaired `login.keyring` (drop corrupt peer item + truncated item); restored device/KEK items; quarantined `login_1`
- Client: store/load peer conf as single-line `eliteew_peer_keyring_b64_v1:` base64 wire format (`capsule_store.rs`)

## Recommendations

- Never store raw WG INI in gnome-keyring text backend
- After repair, re-import `.ecap` once to restore sealed peer (peer item was removed as corruptor)

## Verification

```text
journal: no "invalid or unrecognized format" after repair
cargo test capsule_store — keyring_b64_roundtrip_hides_ini_brackets ok
```

## Residual risk

Metal still needs the rebuilt **`pnpm build:linux`** Desktop Client RPM (b64 wire). Until that binary is installed, a Capsule re-import on the old client can re-corrupt `login.keyring` on next reboot.
